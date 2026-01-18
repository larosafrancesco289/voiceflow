use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

static IS_RECORDING: AtomicBool = AtomicBool::new(false);

fn position_bubble(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten());

        if let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) {
            let work_area = monitor.work_area();
            let margin = 8;
            let x = work_area.position.x + ((work_area.size.width as i32 - size.width as i32) / 2);
            let y = work_area.position.y
                + work_area.size.height as i32
                - size.height as i32
                - margin;
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }
    }
}

#[tauri::command]
async fn show_bubble(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        position_bubble(&app);
        let _ = window.show();
        // Don't focus - keep focus on the previous app
    }
}

#[tauri::command]
async fn hide_bubble(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
async fn resize_main_window(app: AppHandle, width: f64, height: f64, centered: bool) {
    if let Some(window) = app.get_webview_window("main") {
        use tauri::LogicalSize;
        let _ = window.set_size(LogicalSize::new(width, height));
        if centered {
            let _ = window.center();
        }
    }
}

#[tauri::command]
async fn paste_from_clipboard() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        use std::thread;
        use std::time::Duration;

        // Minimal delay before paste
        thread::sleep(Duration::from_millis(10));

        // Use AppleScript to activate frontmost app and paste
        let script = r#"
            tell application "System Events"
                set frontApp to name of first application process whose frontmost is true
                keystroke "v" using command down
            end tell
        "#;

        let result = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("Failed to run osascript: {}", e))?;

        if !result.status.success() {
            let stderr = String::from_utf8_lossy(&result.stderr);
            eprintln!("[voiceflow] Paste failed: {}", stderr);
            return Err(stderr.to_string());
        }
    }
    Ok(())
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit VoiceFlow", true, Some("CmdOrCtrl+Q"))?;
    let record_item = MenuItem::with_id(app, "record", "Hold ⌥ Space to Record", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;

    let menu = Menu::with_items(app, &[&record_item, &settings_item, &quit_item])?;

    let icon_bytes = include_bytes!("../icons/tray-icon.png");
    let icon = Image::from_bytes(icon_bytes)?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "record" => {
                if let Some(window) = app.get_webview_window("main") {
                    position_bubble(app);
                    let _ = window.show();
                }
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.set_focus();
                } else if let Ok(window) = WebviewWindowBuilder::new(
                    app,
                    "settings",
                    WebviewUrl::App("/settings".into()),
                )
                .title("VoiceFlow Settings")
                .inner_size(400.0, 500.0)
                .resizable(false)
                .always_on_top(true)
                .build()
                {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            if let Err(e) = setup_tray(app.handle()) {
                eprintln!("[voiceflow] Failed to setup tray: {}", e);
            }

            let app_handle = app.handle().clone();
            let shortcut = Shortcut::new(Some(Modifiers::ALT), Code::Space);

            let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |_app, _shortcut, event| {
                    use tauri_plugin_global_shortcut::ShortcutState;

                    match event.state() {
                        ShortcutState::Pressed => {
                            if !IS_RECORDING.load(Ordering::SeqCst) {
                                IS_RECORDING.store(true, Ordering::SeqCst);
                                let _ = app_handle.emit("recording-start", ());
                                if let Some(window) = app_handle.get_webview_window("main") {
                                    position_bubble(&app_handle);
                                    let _ = window.show();
                                }
                            }
                        }
                        ShortcutState::Released => {
                            if IS_RECORDING.load(Ordering::SeqCst) {
                                IS_RECORDING.store(false, Ordering::SeqCst);
                                let _ = app_handle.emit("recording-stop", ());
                            }
                        }
                    }
                })
                .build();

            if let Err(e) = app.handle().plugin(shortcut_plugin) {
                eprintln!("[voiceflow] Failed to setup global shortcut plugin: {}", e);
            } else if let Err(e) = app.global_shortcut().register(shortcut) {
                eprintln!("[voiceflow] Failed to register shortcut: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            show_bubble,
            hide_bubble,
            resize_main_window,
            paste_from_clipboard,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
