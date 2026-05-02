import { invoke } from "@tauri-apps/api/core";

export async function getDeviceFingerprint() {
    // 1. UUID persistent
    let uuid = localStorage.getItem("device_uuid");

    if (!uuid) {
        uuid = crypto.randomUUID();
        localStorage.setItem("device_uuid", uuid);
    }

    // 2. Rust hardware info (CPU, RAM, hostname)
    const hardware = await invoke<string>("get_hardware_info");

    // 3. browser info
    const nav = [
        navigator.userAgent,
        navigator.language,
        navigator.platform,
        screen.width + "x" + screen.height,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.hardwareConcurrency,
    ].join("|");

    // 4. combine all entropy
    const raw = `${uuid}|${hardware}|${nav}`;

    // 5. hash ringan (base64 biar konsisten)
    const fingerprint = btoa(raw);

    return fingerprint;
}