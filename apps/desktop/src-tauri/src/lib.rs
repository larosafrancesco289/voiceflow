use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};

#[cfg(target_os = "macos")]
use tauri_nspanel::WebviewWindowExt as NSPanelWebviewWindowExt;
#[cfg(target_os = "macos")]
use tauri_nspanel::objc2::{runtime::NSObjectProtocol, ClassType, Message};

static IS_RECORDING: AtomicBool = AtomicBool::new(false);

fn append_e2e_log(event: &str) {
    let Ok(path) = std::env::var("VOICEFLOW_E2E_LOG") else {
        return;
    };

    let timestamp_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default();

    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(file, "{timestamp_ms} {event}");
    }
}

// NSPanel that floats over fullscreen apps without stealing focus
#[cfg(target_os = "macos")]
tauri_nspanel::panel!(FloatingBubblePanel {
    config: {
        can_become_key_window: false,
        can_become_main_window: false,
        is_floating_panel: true,
    }
});

/// Convert a window to an NSPanel that can appear over fullscreen apps
#[cfg(target_os = "macos")]
fn setup_macos_panel(window: &tauri::WebviewWindow) {
    use tauri_nspanel::objc2_app_kit::{NSWindowCollectionBehavior, NSWindowStyleMask};

    let Ok(panel) = window.to_panel::<FloatingBubblePanel<_>>() else {
        return;
    };

    // Level 25 floats above fullscreen (NSMainMenuWindowLevel is 24)
    panel.set_level(25);
    panel.set_style_mask(NSWindowStyleMask::NonactivatingPanel | NSWindowStyleMask::Resizable);
    panel.set_collection_behavior(
        NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::FullScreenAuxiliary,
    );
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShortcutConfig {
    pub modifiers: Vec<String>,
    pub key: String,
}

impl Default for ShortcutConfig {
    fn default() -> Self {
        Self {
            modifiers: vec!["Alt".to_string()],
            key: "Space".to_string(),
        }
    }
}

impl ShortcutConfig {
    fn to_shortcut(&self) -> Option<Shortcut> {
        let mut mods = Modifiers::empty();
        for m in &self.modifiers {
            match m.to_lowercase().as_str() {
                "alt" | "option" => mods |= Modifiers::ALT,
                "ctrl" | "control" => mods |= Modifiers::CONTROL,
                "shift" => mods |= Modifiers::SHIFT,
                "super" | "cmd" | "command" | "meta" => mods |= Modifiers::SUPER,
                _ => {}
            }
        }

        let code = match self.key.to_lowercase().as_str() {
            "space" => Code::Space,
            "a" => Code::KeyA,
            "b" => Code::KeyB,
            "c" => Code::KeyC,
            "d" => Code::KeyD,
            "e" => Code::KeyE,
            "f" => Code::KeyF,
            "g" => Code::KeyG,
            "h" => Code::KeyH,
            "i" => Code::KeyI,
            "j" => Code::KeyJ,
            "k" => Code::KeyK,
            "l" => Code::KeyL,
            "m" => Code::KeyM,
            "n" => Code::KeyN,
            "o" => Code::KeyO,
            "p" => Code::KeyP,
            "q" => Code::KeyQ,
            "r" => Code::KeyR,
            "s" => Code::KeyS,
            "t" => Code::KeyT,
            "u" => Code::KeyU,
            "v" => Code::KeyV,
            "w" => Code::KeyW,
            "x" => Code::KeyX,
            "y" => Code::KeyY,
            "z" => Code::KeyZ,
            "1" => Code::Digit1,
            "2" => Code::Digit2,
            "3" => Code::Digit3,
            "4" => Code::Digit4,
            "5" => Code::Digit5,
            "6" => Code::Digit6,
            "7" => Code::Digit7,
            "8" => Code::Digit8,
            "9" => Code::Digit9,
            "0" => Code::Digit0,
            "f1" => Code::F1,
            "f2" => Code::F2,
            "f3" => Code::F3,
            "f4" => Code::F4,
            "f5" => Code::F5,
            "f6" => Code::F6,
            "f7" => Code::F7,
            "f8" => Code::F8,
            "f9" => Code::F9,
            "f10" => Code::F10,
            "f11" => Code::F11,
            "f12" => Code::F12,
            _ => return None,
        };

        Some(Shortcut::new(if mods.is_empty() { None } else { Some(mods) }, code))
    }

    fn display_string(&self) -> String {
        let mut parts = Vec::new();
        for m in &self.modifiers {
            match m.to_lowercase().as_str() {
                "alt" | "option" => parts.push("\u{2325}"),
                "ctrl" | "control" => parts.push("\u{2303}"),
                "shift" => parts.push("\u{21E7}"),
                "super" | "cmd" | "command" | "meta" => parts.push("\u{2318}"),
                _ => {}
            }
        }
        parts.push(&self.key);
        parts.join(" ")
    }
}

pub struct ShortcutManager {
    config: ShortcutConfig,
    config_path: PathBuf,
}

#[derive(Default)]
struct ServerManager {
    child: Option<CommandChild>,
}

impl ShortcutManager {
    fn new(config_dir: PathBuf) -> Self {
        let config_path = config_dir.join("shortcut.json");
        let config = Self::load_config(&config_path).unwrap_or_default();
        Self { config, config_path }
    }

    fn load_config(path: &PathBuf) -> Option<ShortcutConfig> {
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    }

    fn save_config(&self) -> Result<(), String> {
        if let Some(parent) = self.config_path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = serde_json::to_string_pretty(&self.config).map_err(|e| e.to_string())?;
        fs::write(&self.config_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn get_config(&self) -> ShortcutConfig {
        self.config.clone()
    }

    fn set_config(&mut self, config: ShortcutConfig) -> Result<(), String> {
        self.config = config;
        self.save_config()
    }
}

fn ensure_sidecar_running(app: &AppHandle) -> Result<(), String> {
    let server_state = app.state::<Mutex<ServerManager>>();
    let mut server_manager = server_state
        .lock()
        .map_err(|e| e.to_string())?;

    if server_manager.child.is_some() {
        return Ok(());
    }

    let (mut rx, child) = app
        .shell()
        .sidecar("voiceflow-server")
        .map_err(|e| format!("Failed to prepare sidecar: {e}"))?
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {e}"))?;

    let pid = child.pid();
    server_manager.child = Some(child);
    drop(server_manager);
    append_e2e_log("server-started");

    let app_handle = app.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    eprintln!("[voiceflow-server:{pid}] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Stderr(line) => {
                    eprintln!(
                        "[voiceflow-server:{pid}][stderr] {}",
                        String::from_utf8_lossy(&line)
                    );
                }
                CommandEvent::Error(error) => {
                    eprintln!("[voiceflow-server:{pid}][error] {error}");
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[voiceflow-server:{pid}] terminated: {payload:?}");
                    append_e2e_log("server-terminated");
                }
                _ => {}
            }
        }

        let server_state = app_handle.state::<Mutex<ServerManager>>();
        if let Ok(mut manager) = server_state.lock() {
            let tracked_pid = manager.child.as_ref().map(CommandChild::pid);
            if tracked_pid == Some(pid) {
                manager.child = None;
            }
        };
    });

    Ok(())
}

fn stop_sidecar(app: &AppHandle) -> Result<(), String> {
    let child = {
        let server_state = app.state::<Mutex<ServerManager>>();
        let mut manager = server_state
            .lock()
            .map_err(|e| e.to_string())?;
        manager.child.take()
    };

    if let Some(child) = child {
        if let Err(error) = child.kill() {
            eprintln!("[voiceflow-server] Failed to stop sidecar: {error}");
        } else {
            append_e2e_log("server-stopped");
        }
    }

    Ok(())
}

fn position_bubble(app: &AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) else {
        return;
    };

    let screen = monitor.size();
    let screen_pos = monitor.position();
    let margin = 24;
    let x = screen_pos.x + ((screen.width as i32 - size.width as i32) / 2);
    let y = screen_pos.y + screen.height as i32 - size.height as i32 - margin;
    let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
}

fn focus_and_bring_to_front(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
    // Toggle always-on-top to ensure window comes to front
    let _ = window.set_always_on_top(true);
    let _ = window.set_always_on_top(false);
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        position_bubble(app);
        let _ = window.show();
        append_e2e_log("bubble-shown");
    }
}

#[tauri::command]
async fn show_bubble(app: AppHandle) {
    show_main_window(&app);
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

        thread::sleep(Duration::from_millis(10));

        let script = r#"
            tell application "System Events"
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

#[tauri::command]
async fn get_current_shortcut(app: AppHandle) -> Result<ShortcutConfig, String> {
    let state = app.state::<Mutex<ShortcutManager>>();
    let manager = state.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_config())
}

#[tauri::command]
async fn set_shortcut(app: AppHandle, modifiers: Vec<String>, key: String) -> Result<(), String> {
    let new_config = ShortcutConfig { modifiers, key };

    // Validate the shortcut can be created
    let new_shortcut = new_config.to_shortcut()
        .ok_or_else(|| "Invalid shortcut configuration".to_string())?;

    // Get current shortcut to unregister
    let current_shortcut = {
        let state = app.state::<Mutex<ShortcutManager>>();
        let manager = state.lock().map_err(|e| e.to_string())?;
        manager.get_config().to_shortcut()
    };

    // Unregister old shortcut
    if let Some(old_shortcut) = current_shortcut {
        let _ = app.global_shortcut().unregister(old_shortcut);
    }

    // Register new shortcut
    if let Err(e) = app.global_shortcut().register(new_shortcut) {
        // Try to re-register old shortcut on failure
        if let Some(old_shortcut) = current_shortcut {
            let _ = app.global_shortcut().register(old_shortcut);
        }
        return Err(format!("Failed to register shortcut: {}", e));
    }

    // Save new config
    {
        let state = app.state::<Mutex<ShortcutManager>>();
        let mut manager = state.lock().map_err(|e| e.to_string())?;
        manager.set_config(new_config.clone())?;
    }

    // Update tray menu text
    update_tray_menu_text(&app, &new_config);

    Ok(())
}

/// Placeholder for dynamic tray menu updates (not supported in Tauri 2.x)
fn update_tray_menu_text(_app: &AppHandle, _config: &ShortcutConfig) {}

fn show_or_create_main_app(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main-app") {
        focus_and_bring_to_front(&window);
        return;
    }

    let builder = WebviewWindowBuilder::new(app, "main-app", WebviewUrl::App("/main".into()))
        .title("VoiceFlow")
        .inner_size(400.0, 520.0)
        .resizable(false)
        .center()
        .focused(true);

    if let Ok(window) = builder.build() {
        focus_and_bring_to_front(&window);
    }
}

#[tauri::command]
async fn show_main_app(app: AppHandle) {
    show_or_create_main_app(&app);
}

#[tauri::command]
async fn ensure_server_running(app: AppHandle) -> Result<(), String> {
    ensure_sidecar_running(&app)
}

#[tauri::command]
async fn stop_server(app: AppHandle) -> Result<(), String> {
    stop_sidecar(&app)
}

fn setup_tray(app: &AppHandle, shortcut_display: &str) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit VoiceFlow", true, Some("CmdOrCtrl+Q"))?;
    let record_text = format!("Hold {} to Record", shortcut_display);
    let record_item = MenuItem::with_id(app, "record", &record_text, true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;

    let menu = Menu::with_items(app, &[&record_item, &settings_item, &quit_item])?;

    let icon_bytes = include_bytes!("../icons/tray-icon.png");
    let icon = Image::from_bytes(icon_bytes)?;

    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "record" => show_main_window(app),
            "settings" => {
                // Open the main app window (which has Settings tab)
                show_or_create_main_app(app);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder.setup(|app| {
            let config_dir = app.path().app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let shortcut_manager = ShortcutManager::new(config_dir);
            let shortcut_config = shortcut_manager.get_config();
            let shortcut_display = shortcut_config.display_string();

            app.manage(Mutex::new(shortcut_manager));
            app.manage(Mutex::new(ServerManager::default()));
            append_e2e_log("app-started");

            if let Err(e) = ensure_sidecar_running(app.handle()) {
                eprintln!("[voiceflow] Failed to start sidecar: {e}");
            }

            if let Err(e) = setup_tray(app.handle(), &shortcut_display) {
                eprintln!("[voiceflow] Failed to setup tray: {}", e);
            }

            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                setup_macos_panel(&window);
            }

            let app_handle = app.handle().clone();
            let shortcut = shortcut_config.to_shortcut()
                .unwrap_or_else(|| Shortcut::new(Some(Modifiers::ALT), Code::Space));

            let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |_app, _shortcut, event| {
                    match event.state() {
                        ShortcutState::Pressed => {
                            if !IS_RECORDING.load(Ordering::SeqCst) {
                                IS_RECORDING.store(true, Ordering::SeqCst);
                                append_e2e_log("shortcut-pressed");
                                let _ = app_handle.emit("recording-start", ());
                                show_main_window(&app_handle);
                            }
                        }
                        ShortcutState::Released => {
                            if IS_RECORDING.load(Ordering::SeqCst) {
                                IS_RECORDING.store(false, Ordering::SeqCst);
                                append_e2e_log("shortcut-released");
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
        .on_window_event(|window, event| {
            // Handle dock click on macOS - show main app when all windows are closed
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Keep main-app alive so state is preserved and dock reopen is instant.
                if window.label() == "main-app" {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            show_bubble,
            hide_bubble,
            resize_main_window,
            paste_from_clipboard,
            get_current_shortcut,
            set_shortcut,
            show_main_app,
            ensure_server_running,
            stop_server,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // Handle macOS dock click (reopen event)
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { has_visible_windows, .. } = event {
                if !has_visible_windows {
                    show_or_create_main_app(app_handle);
                }
            }

            if let tauri::RunEvent::Exit = event {
                append_e2e_log("app-exit");
                let _ = stop_sidecar(app_handle);
            }
        });
}
