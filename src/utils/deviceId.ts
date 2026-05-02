import { load } from "@tauri-apps/plugin-store";

export async function getDeviceId() {
    try {
        console.log("INIT DEVICE ID");
        const store = await load("device.json");
        console.log("STORE READY");
        let deviceId = await store.get<string>("device_id");
        console.log("FROM STORE:", deviceId);
        if (deviceId) {
            localStorage.setItem("device_id", deviceId);
            return deviceId;
        }
        deviceId = crypto.randomUUID();
        console.log("GENERATED:", deviceId);
        await store.set("device_id", deviceId);
        await store.save();
        localStorage.setItem("device_id", deviceId);

        return deviceId;
    } catch (err) {
        console.error("STORE ERROR:", err);
        let id = localStorage.getItem("device_id");
        if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem("device_id", id);
        }
        return id;
    }
}