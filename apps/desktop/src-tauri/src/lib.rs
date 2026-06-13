// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod commands {
    #[tauri::command]
    pub fn greet(name: &str) -> String {
        format!("Hello, {}! You've been greeted from Rust!", name)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![commands::greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    // The command's logic in isolation. The full IPC path (with the real ACL)
    // is covered by the end-to-end suite against the running app.
    #[test]
    fn greet_formats_the_name() {
        assert_eq!(
            super::commands::greet("Tauri"),
            "Hello, Tauri! You've been greeted from Rust!"
        );
    }
}
