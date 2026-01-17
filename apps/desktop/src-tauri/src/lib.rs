use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

static IS_RECORDING: AtomicBool = AtomicBool::new(false);
static TRIGGER_KEYS: Lazy<Mutex<Vec<String>>> =
    Lazy::new(|| Mutex::new(vec!["fn".to_string(), "capslock".to_string()]));

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TranscriptionHistory {
    text: String,
    timestamp: u64,
}

static HISTORY: Lazy<Mutex<Vec<TranscriptionHistory>>> = Lazy::new(|| Mutex::new(Vec::new()));

#[tauri::command]
fn get_trigger_keys() -> Vec<String> {
    TRIGGER_KEYS.lock().unwrap().clone()
}

#[tauri::command]
fn set_trigger_keys(keys: Vec<String>) {
    let mut trigger_keys = TRIGGER_KEYS.lock().unwrap();
    *trigger_keys = keys;
}

#[tauri::command]
fn add_to_history(text: String) {
    let mut history = HISTORY.lock().unwrap();
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

    history.insert(0, TranscriptionHistory { text, timestamp });

    if history.len() > 20 {
        history.pop();
    }
}

#[tauri::command]
fn get_history() -> Vec<TranscriptionHistory> {
    HISTORY.lock().unwrap().clone()
}

#[tauri::command]
fn clear_history() {
    HISTORY.lock().unwrap().clear();
}

#[tauri::command]
async fn show_bubble(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
async fn hide_bubble(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[tauri::command]
fn is_recording() -> bool {
    IS_RECORDING.load(Ordering::SeqCst)
}

#[tauri::command]
async fn start_recording(app: AppHandle) {
    if !IS_RECORDING.load(Ordering::SeqCst) {
        IS_RECORDING.store(true, Ordering::SeqCst);
        let _ = app.emit("recording-start", ());
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[tauri::command]
async fn stop_recording(app: AppHandle) {
    if IS_RECORDING.load(Ordering::SeqCst) {
        IS_RECORDING.store(false, Ordering::SeqCst);
        let _ = app.emit("recording-stop", ());
    }
}

fn setup_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let quit_item = MenuItem::with_id(app, "quit", "Quit VoiceFlow", true, Some("CmdOrCtrl+Q"))?;
    let record_item = MenuItem::with_id(app, "record", "Start Recording", true, Some("CmdOrCtrl+R"))?;
    let settings_item = MenuItem::with_id(app, "settings", "Settings...", true, Some("CmdOrCtrl+,"))?;

    let menu = Menu::with_items(app, &[&record_item, &settings_item, &quit_item])?;

    let icon_bytes = include_bytes!("../icons/icon.png");
    let icon = Image::from_bytes(icon_bytes)?;

    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "quit" => {
                println!("[voiceflow] Quitting...");
                app.exit(0);
            }
            "record" => {
                println!("[voiceflow] Record clicked");
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "settings" => {
                println!("[voiceflow] Settings clicked");
                if let Some(window) = app.get_webview_window("settings") {
                    let _ = window.show();
                    let _ = window.set_focus();
                } else {
                    let _ = WebviewWindowBuilder::new(
                        app,
                        "settings",
                        WebviewUrl::App("/settings".into()),
                    )
                    .title("VoiceFlow Settings")
                    .inner_size(400.0, 500.0)
                    .resizable(false)
                    .build();
                }
            }
            _ => {}
        })
        .on_tray_icon_event(|_tray, event| {
            if let TrayIconEvent::DoubleClick { .. } = event {
                println!("[voiceflow] Tray double-clicked");
            }
        })
        .build(app)?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    println!("[voiceflow] Starting VoiceFlow...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            println!("[voiceflow] Setting up app...");

            // Setup tray
            if let Err(e) = setup_tray(app.handle()) {
                eprintln!("[voiceflow] Failed to setup tray: {}", e);
            }

            // Setup global shortcut (Cmd+Shift+Space to toggle recording)
            let app_handle = app.handle().clone();
            let shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::Space);

            let shortcut_plugin = tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |_app, _shortcut, event| {
                    if event.state() == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        let is_recording = IS_RECORDING.load(Ordering::SeqCst);
                        if is_recording {
                            println!("[voiceflow] Shortcut: stopping recording");
                            IS_RECORDING.store(false, Ordering::SeqCst);
                            let _ = app_handle.emit("recording-stop", ());
                        } else {
                            println!("[voiceflow] Shortcut: starting recording");
                            IS_RECORDING.store(true, Ordering::SeqCst);
                            let _ = app_handle.emit("recording-start", ());
                            if let Some(window) = app_handle.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build();

            if let Err(e) = app.handle().plugin(shortcut_plugin) {
                eprintln!("[voiceflow] Failed to setup global shortcut plugin: {}", e);
            } else {
                // Register the shortcut
                if let Err(e) = app.global_shortcut().register(shortcut) {
                    eprintln!("[voiceflow] Failed to register shortcut: {}", e);
                } else {
                    println!("[voiceflow] Global shortcut Cmd+Shift+Space registered");
                }
            }

            println!("[voiceflow] App setup complete!");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_trigger_keys,
            set_trigger_keys,
            add_to_history,
            get_history,
            clear_history,
            show_bubble,
            hide_bubble,
            is_recording,
            start_recording,
            stop_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
