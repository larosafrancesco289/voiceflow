use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager, PhysicalPosition, Position, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

#[cfg(target_os = "macos")]
use tauri_nspanel::WebviewWindowExt as NSPanelWebviewWindowExt;
#[cfg(target_os = "macos")]
use tauri_nspanel::objc2::{runtime::NSObjectProtocol, ClassType, Message};

static IS_RECORDING: AtomicBool = AtomicBool::new(false);

// Define a custom panel type for the overlay bubble.
// This panel can appear over fullscreen applications.
#[cfg(target_os = "macos")]
tauri_nspanel::panel!(FloatingBubblePanel {
    config: {
        // Panel should not become key window (won't steal focus)
        can_become_key_window: false,
        // Panel should not become main window
        can_become_main_window: false,
        // This is a floating panel
        is_floating_panel: true,
    }
});

/// Convert a window to an NSPanel that can appear over fullscreen apps.
/// This is macOS-specific and required for overlay functionality since Big Sur.
#[cfg(target_os = "macos")]
fn setup_macos_panel(window: &tauri::WebviewWindow) {
    use tauri_nspanel::objc2_app_kit::{NSWindowCollectionBehavior, NSWindowStyleMask};

    // Convert the Tauri window to an NSPanel
    if let Ok(panel) = window.to_panel::<FloatingBubblePanel<_>>() {
        // Window level: higher than most windows, including fullscreen apps
        // NSMainMenuWindowLevel (24) + 1 = 25, which floats above fullscreen
        panel.set_level(25);

        // Style mask: panel won't steal focus and is resizable
        let style_mask = NSWindowStyleMask::NonactivatingPanel | NSWindowStyleMask::Resizable;
        panel.set_style_mask(style_mask);

        // Collection behavior: visible on all spaces, stays in place, can appear over fullscreen
        let collection_behavior = NSWindowCollectionBehavior::CanJoinAllSpaces
            | NSWindowCollectionBehavior::Stationary
            | NSWindowCollectionBehavior::FullScreenAuxiliary;
        panel.set_collection_behavior(collection_behavior);
    }
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

fn position_bubble(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let monitor = window
            .current_monitor()
            .ok()
            .flatten()
            .or_else(|| window.primary_monitor().ok().flatten());

        if let (Some(monitor), Ok(size)) = (monitor, window.outer_size()) {
            // Use full monitor size (not work_area) so it works in fullscreen apps
            let screen = monitor.size();
            let screen_pos = monitor.position();
            let margin = 24; // Padding from bottom edge
            let x = screen_pos.x + ((screen.width as i32 - size.width as i32) / 2);
            let y = screen_pos.y + screen.height as i32 - size.height as i32 - margin;
            let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
        }
    }
}

/// Focus a window and bring it to front using always-on-top toggle trick
fn focus_and_bring_to_front(window: &tauri::WebviewWindow) {
    let _ = window.show();
    let _ = window.set_focus();
    let _ = window.set_always_on_top(true);
    let _ = window.set_always_on_top(false);
}

/// Show the main overlay bubble without stealing focus.
/// For NSPanel windows, we just show - the panel level handles layering.
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        position_bubble(app);
        // For the overlay bubble, just show it without stealing focus
        // The NSPanel configuration handles appearing above other windows
        let _ = window.show();
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

/// Updates tray menu text after hotkey change.
/// Note: Tauri 2.x doesn't easily support dynamic tray menu updates.
/// The hotkey change takes effect immediately; tray text updates on restart.
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
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Initialize NSPanel plugin on macOS for fullscreen overlay support
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder.setup(|app| {
            // Initialize shortcut manager with config directory
            let config_dir = app.path().app_config_dir()
                .unwrap_or_else(|_| PathBuf::from("."));
            let shortcut_manager = ShortcutManager::new(config_dir);
            let shortcut_config = shortcut_manager.get_config();
            let shortcut_display = shortcut_config.display_string();

            // Store the manager in app state
            app.manage(Mutex::new(shortcut_manager));

            // Setup tray with current shortcut display
            if let Err(e) = setup_tray(app.handle(), &shortcut_display) {
                eprintln!("[voiceflow] Failed to setup tray: {}", e);
            }

            // Convert main window to NSPanel for fullscreen overlay support on macOS
            #[cfg(target_os = "macos")]
            if let Some(window) = app.get_webview_window("main") {
                setup_macos_panel(&window);
            }

            let app_handle = app.handle().clone();

            // Get the shortcut from config, fallback to default
            let shortcut = shortcut_config.to_shortcut()
                .unwrap_or_else(|| Shortcut::new(Some(Modifiers::ALT), Code::Space));

            let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |_app, _shortcut, event| {
                    match event.state() {
                        ShortcutState::Pressed => {
                            if !IS_RECORDING.load(Ordering::SeqCst) {
                                IS_RECORDING.store(true, Ordering::SeqCst);
                                let _ = app_handle.emit("recording-start", ());
                                show_main_window(&app_handle);
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
        .on_window_event(|window, event| {
            // Handle dock click on macOS - show main app when all windows are closed
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                // Just hide instead of close for the main-app window
                if window.label() == "main-app" {
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
        });
}
