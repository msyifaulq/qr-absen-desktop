import { invoke } from "@tauri-apps/api/core";

export async function getDeviceId() {
    let cached = localStorage.getItem("device_id");
    if (cached) return cached;

    try {
        const deviceId = await invoke<string>("get_device_id");
        localStorage.setItem("device_id", deviceId);
        return deviceId;
    } catch (err) {
        console.error("DEVICE ID ERROR:", err);

        const fallback = crypto.randomUUID();
        localStorage.setItem("device_id", fallback);
        return fallback;
    }
}