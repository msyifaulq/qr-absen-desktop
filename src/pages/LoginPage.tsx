import { useEffect, useState } from "react";
import { Alert, Button, Form, Input, Card, message } from "antd";
import api from "../api";
import { getDeviceId } from "../utils/deviceId";
import { openUrl } from "@tauri-apps/plugin-opener";

export default function LoginPage({ onLogin }: any) {
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState<any>(null);
    const [deviceId, setDeviceId] = useState<string>("");
    const [exeUrl, setExeUrl] = useState<string>("");

    useEffect(() => {
        const init = async () => {
            // ambil dari localStorage
            let id = localStorage.getItem("device_id");
            if (id) {
                setDeviceId(id);
            }
            try {
                // ambil dari Tauri store (source utama)
                const realId = await getDeviceId();
                if (realId) {
                    setDeviceId(realId);
                    localStorage.setItem("device_id", realId);
                }
            } catch (err) {
                console.error("Gagal ambil deviceId:", err);
            }
        };

        init();
    }, []);

    useEffect(() => {
        const fetchExe = async () => {
            try {
                const res = await api.get("/api/desktop/download/latest");
                setExeUrl(res?.data?.exe_url || "");
            } catch (err) {
                console.error("Gagal ambil exe url:", err);
            }
        };

        fetchExe();
    }, []);

    const copyDeviceId = async () => {
        await navigator.clipboard.writeText(deviceId);
        message.success("Device ID dicopy");
    };

    const onFinish = async (values: { username: string; password: string }) => {
        setLoading(true);
        setAlert(null);

        try {
            const res = await api.post("/api/login/desktop", {
                username: values.username,
                password: values.password,
                device_id: deviceId,
                versi: __APP_VERSION__,
            });

            if (res.data.status) {
                const today = new Date().toISOString().slice(0, 10); // format YYYY-MM-DD
                localStorage.setItem("login_date", today);
                localStorage.setItem("lokasi", res.data.data.lokasi_qr);
                localStorage.setItem("token", res.data.data.xx_api_token);
                localStorage.setItem("did", res.data.data.did);
                onLogin();
            } else {
                setAlert({
                    type: "error",
                    message: res.data?.message || "Login gagal",
                });
            }
        } catch (err: any) {
            setAlert({
                type: "error",
                message: err?.response?.data?.message || "Login gagal",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <Card className="shadow-lg text-center" style={{ width: 400 }}>
                <h2 style={{ textAlign: "center", marginBottom: 20, color: "#000" }}>
                    Login
                </h2>

                <Form name="login" onFinish={onFinish} layout="vertical">
                    <Form.Item
                        label="Username"
                        name="username"
                        rules={[{ required: true, message: "Masukkan username!" }]}
                    >
                        <Input />
                    </Form.Item>

                    <Form.Item
                        label="Password"
                        name="password"
                        rules={[{ required: true, message: "Masukkan password!" }]}
                    >
                        <Input.Password />
                    </Form.Item>

                    <Form.Item>
                        <Button loading={loading} type="primary" htmlType="submit" block>
                            Login
                        </Button>
                    </Form.Item>

                    <Form.Item>
                        <Button
                            type="dashed"
                            block
                            disabled={!exeUrl}
                            onClick={async () => {
                                await openUrl(exeUrl);
                            }}
                        >
                            Download Installer Latest Version
                        </Button>
                    </Form.Item>

                    <Form.Item>
                        <div className="flex items-center gap-2">
                            <span className="text-xs flex-1 truncate">
                                {deviceId ? deviceId : "Device ID tidak tersedia"}
                            </span>

                            <Button
                                size="small"
                                onClick={copyDeviceId}
                                disabled={!deviceId}
                            >
                                Copy
                            </Button>
                        </div>
                    </Form.Item>

                    {alert && !loading && (
                        <Form.Item>
                            <Alert type={alert.type} message={alert.message} />
                        </Form.Item>
                    )}
                </Form>

                <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#999" }}>
                    v{__APP_VERSION__} • Build {__BUILD_DATE__}
                </div>
            </Card>
        </div>
    );
}