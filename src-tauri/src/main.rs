// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;
use sysinfo::System;
use uuid::Uuid;
use winreg::enums::*;
use winreg::RegKey;use std::fs;
use std::path::PathBuf;
use dirs;

#[command]
fn get_hardware_info() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_count = sys.cpus().len();
    let total_memory = sys.total_memory();
    let hostname = System::host_name().unwrap_or("unknown".to_string());

    format!("{}|{}|{}", cpu_count, total_memory, hostname)
}

#[command]
fn get_device_id() -> String {
    if let Some(machine_guid) = get_machine_guid() {
        return device_id_from_machine_guid(&machine_guid);
    }

    // fallback kalau gagal
    // Uuid::new_v4().to_string()
    get_or_create_device_id_file()
}

fn get_machine_guid() -> Option<String> {
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let path = "SOFTWARE\\Microsoft\\Cryptography";

    if let Ok(key) = hklm.open_subkey(path) {
        if let Ok(guid) = key.get_value::<String, _>("MachineGuid") {
            return Some(guid);
        }
    }
    None
}

fn get_appdata_path() -> PathBuf {
    let mut path = dirs::data_dir().unwrap();
    path.push("qr-absen-app");
    path
}

fn get_or_create_device_id_file() -> String {
    let mut path = get_appdata_path();
    fs::create_dir_all(&path).ok();

    path.push("device_id.txt");

    // kalau sudah ada → baca
    if let Ok(id) = fs::read_to_string(&path) {
        return id.trim().to_string();
    }

    // kalau belum → generate & simpan
    let new_id = Uuid::new_v4().to_string();
    let _ = fs::write(&path, &new_id);

    new_id
}

fn device_id_from_machine_guid(machine_guid: &str) -> String {
    // namespace bebas, tapi harus tetap (hardcode)
    // let namespace = Uuid::NAMESPACE_DNS;
    let namespace = Uuid::new_v5(&Uuid::NAMESPACE_DNS, b"qr-absen-app");

    let uuid = Uuid::new_v5(&namespace, machine_guid.as_bytes());

    uuid.to_string()
}

fn main() {
    std::env::set_var(
        "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS", 
        "--no-sandbox --disable-gpu"
    );

    std::env::set_var(
        "WEBVIEW2_RELEASE_CHANNEL_PREFERENCE",
        "1"
    );
    
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            get_hardware_info,
            get_device_id
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}