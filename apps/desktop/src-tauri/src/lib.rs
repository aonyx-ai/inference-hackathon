// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
pub mod commands {
    #[tauri::command]
    pub fn greet(name: &str) -> String {
        format!("Hello, {}! You've been greeted from Rust!", name)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // Dev-only tooling plugins — never compiled into release builds.
    #[cfg(debug_assertions)]
    {
        // Agent automation: lets AI agents drive the running app over a socket.
        builder = builder.plugin(tauri_plugin_mcp::init_with_config(
            tauri_plugin_mcp::PluginConfig::new("Inference Hackathon".to_string())
                .start_socket_server(true)
                .socket_path(std::path::PathBuf::from("/tmp/tauri-mcp.sock")),
        ));

        // The embedded WebDriver server (for E2E) is additionally gated behind
        // the `webdriver` feature so it is only linked when running tests.
        #[cfg(feature = "webdriver")]
        {
            builder = builder.plugin(tauri_plugin_webdriver::init());
        }
    }

    builder
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
