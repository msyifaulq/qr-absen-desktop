// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;
use sysinfo::System;

#[command]
fn get_hardware_info() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_count = sys.cpus().len();
    let total_memory = sys.total_memory();
    let hostname = System::host_name().unwrap_or("unknown".to_string());

    format!("{}|{}|{}", cpu_count, total_memory, hostname)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_hardware_info])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}