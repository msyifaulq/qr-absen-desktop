import { useEffect, useState, useRef, useCallback } from "react";
import { Alert, Button, Card, QRCode, Spin, Tooltip, Tag } from "antd";
import { LogoutOutlined, ReloadOutlined } from "@ant-design/icons";
import api from "../api";

export default function QrCodePage() {
    const [qr, setQr] = useState<{ qr: string; ttl: number } | null>(null);
    const [countdown, setCountdown] = useState(30);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Opsi 1: Auto Switch (ON/OFF)
    const [autoSwitch, setAutoSwitch] = useState<boolean>(() => {
        return localStorage.getItem("qr_auto_switch") !== "0";
    });

    // Opsi 2: Default Configured Mode ('websocket' | 'api')
    const [configuredMode, setConfiguredMode] = useState<"websocket" | "api">(() => {
        return (localStorage.getItem("qr_mode") as "websocket" | "api") || "websocket";
    });

    // Mode aktif saat ini (bisa beralih ke 'api' jika auto-switch aktif dan WS bermasalah)
    const [activeMode, setActiveMode] = useState<"websocket" | "api">(() => {
        return (localStorage.getItem("qr_mode") as "websocket" | "api") || "websocket";
    });

    const lokasi = localStorage.getItem("lokasi");
    const did = localStorage.getItem("did");
    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sinkronkan mode aktif jika configuredMode atau autoSwitch berubah dari backend
    useEffect(() => {
        if (!autoSwitch) {
            setActiveMode(configuredMode);
        } else {
            // Jika autoSwitch ON dan WS connected, pastikan kembali ke configuredMode
            const pusher = window.Echo?.connector?.pusher;
            if (pusher && pusher.connection.state === "connected") {
                setActiveMode(configuredMode);
            }
        }
    }, [configuredMode, autoSwitch]);

    const handleRefresh = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMessage(null);

            // Cek status koneksi Pusher
            const pusher = window.Echo?.connector?.pusher;
            if (pusher) {
                const state = pusher.connection.state;
                console.log("Status WebSocket saat refresh:", state);
                if (state === "connected") {
                    if (autoSwitch && configuredMode === "websocket") {
                        setActiveMode("websocket");
                    }
                } else if (state !== "connecting") {
                    console.log("Mencoba menghubungkan ulang WebSocket...");
                    pusher.connect();
                }
            }

            // Batas waktu tunggu (timeout 8 detik)
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            refreshTimeoutRef.current = setTimeout(() => {
                setLoading(false);

                if (autoSwitch && activeMode === "websocket") {
                    console.warn("⚠️ WebSocket timeout, otomatis beralih ke mode API Polling...");
                    setActiveMode("api");
                    setErrorMessage("WebSocket lambat merespons. Otomatis beralih ke mode API Langsung.");
                } else {
                    setErrorMessage(
                        "Waktu tunggu habis. Server belum merespons. Silakan klik Refresh QR lagi."
                    );
                }
            }, 8000);

            // Request ke API backend
            const res = await api.get("/api/qr-absen");

            // Update setting jika server mengirimkan setting terbaru
            const serverAutoSwitch = res?.data?.qr_auto_switch ?? res?.data?.data?.qr_auto_switch;
            const serverMode = res?.data?.qr_mode ?? res?.data?.data?.qr_mode;

            if (serverAutoSwitch !== undefined) {
                const sw = Boolean(serverAutoSwitch);
                setAutoSwitch(sw);
                localStorage.setItem("qr_auto_switch", sw ? "1" : "0");
            }

            if (serverMode && (serverMode === "websocket" || serverMode === "api")) {
                setConfiguredMode(serverMode);
                localStorage.setItem("qr_mode", serverMode);
                if (!serverAutoSwitch) {
                    setActiveMode(serverMode);
                }
            }

            // Baca data QR dari HTTP response
            const data = res?.data?.data || res?.data;
            const qrToken = data?.qr || res?.data?._qr;
            const ttl = data?.ttl || res?.data?.ttl || 30;

            if (qrToken) {
                if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                }
                setQr({
                    qr: qrToken + "",
                    ttl: ttl,
                });
                setCountdown(ttl);
                setLoading(false);
                setErrorMessage(null);
            }
        } catch (err: any) {
            console.error("Gagal trigger refresh:", err);
            if (refreshTimeoutRef.current) {
                clearTimeout(refreshTimeoutRef.current);
            }
            setLoading(false);

            if (autoSwitch && activeMode === "websocket") {
                console.warn("⚠️ Request gagal, auto-switch ke mode API Polling");
                setActiveMode("api");
            }

            setErrorMessage(
                err?.response?.data?.message ||
                "Tidak dapat terhubung ke server. Kemungkinan server sedang down atau terjadi gangguan jaringan."
            );
        }
    }, [activeMode, autoSwitch, configuredMode]);

    useEffect(() => {
        if (!lokasi) return;
        console.log("LD:", lokasi + did);
    }, [lokasi, did]);

    // 🔥 PUSHER CONNECTION MONITOR (Selalu aktif memantau koneksi WebSocket)
    useEffect(() => {
        const pusher = window.Echo?.connector?.pusher;
        if (!pusher) return;

        const handleStateChange = (states: any) => {
            console.log("WS STATE CHANGE:", states.previous, "->", states.current);
            if (states.current === "unavailable" || states.current === "failed" || states.current === "disconnected") {
                if (autoSwitch) {
                    console.warn("⚠️ WebSocket terputus, otomatis beralih ke Mode API Polling");
                    setActiveMode("api");
                    setErrorMessage("Koneksi WebSocket terputus. Sistem beralih ke Mode API Langsung.");
                } else {
                    setErrorMessage("Koneksi WebSocket terputus. Mencoba menghubungkan kembali...");
                }
            } else if (states.current === "connected") {
                console.log("✅ WS CONNECTED (dari state_change)");
                setErrorMessage(null);
                if (autoSwitch && configuredMode === "websocket") {
                    console.log("🔄 Mengembalikan mode ke WebSocket...");
                    setActiveMode("websocket");
                }
            }
        };

        const handleConnected = () => {
            console.log("✅ WS CONNECTED EVENT");
            setErrorMessage(null);
            if (autoSwitch && configuredMode === "websocket") {
                console.log("🔄 Mengembalikan mode ke WebSocket...");
                setActiveMode("websocket");
            }
            handleRefresh();
        };

        const handleError = (err: any) => {
            console.error("❌ WS ERROR:", err);
            if (autoSwitch) {
                console.warn("⚠️ WebSocket error, otomatis beralih ke Mode API Polling");
                setActiveMode("api");
            }
        };

        pusher.connection.bind("state_change", handleStateChange);
        pusher.connection.bind("connected", handleConnected);
        pusher.connection.bind("error", handleError);

        return () => {
            pusher.connection.unbind("state_change", handleStateChange);
            pusher.connection.unbind("connected", handleConnected);
            pusher.connection.unbind("error", handleError);
        };
    }, [autoSwitch, configuredMode, handleRefresh]);

    // 🔥 CHANNEL SUBSCRIPTION (Hanya aktif saat di mode websocket)
    useEffect(() => {
        if (!lokasi || activeMode !== "websocket") return;

        const [kantor, lantai] = lokasi.split("_");
        const channelName = `absensi.${kantor}.${lantai}.${did}`;
        const channel = window.Echo.channel(channelName);

        channel.subscribed(() => {
            console.log("✅ JOINED CHANNEL:", channelName);
            handleRefresh();
        });

        channel.error((err: any) => {
            console.error("❌ CHANNEL ERROR:", err);
            if (autoSwitch) {
                setActiveMode("api");
            }
        });

        channel
            .listen(".qr-code-absen-generated", (e: any) => {
                console.log("QR GENERATED (WS):", e);

                if (refreshTimeoutRef.current) {
                    clearTimeout(refreshTimeoutRef.current);
                }

                setQr({
                    qr: e.qr + "",
                    ttl: e.ttl || 30,
                });

                setCountdown(e.ttl || 30);
                setLoading(false);
                setErrorMessage(null);
            })
            .listen(".qr-code-absen-used", () => {
                console.log("QR USED -> tunggu generate baru");
            });

        return () => {
            window.Echo.leave(channelName);
        };
    }, [lokasi, activeMode, did, autoSwitch, handleRefresh]);

    // Initial load saat pertama buka halaman jika belum ada QR
    useEffect(() => {
        if (!qr && !loading) {
            handleRefresh();
        }
    }, []);

    // Countdown & Auto Polling Timer
    useEffect(() => {
        if (!qr) return;
        setCountdown(qr.ttl);

        const interval = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    // Ketika countdown habis:
                    // Jika di mode API, otomatis ambil QR baru
                    if (activeMode === "api") {
                        console.log("⏱️ Countdown habis di mode API, me-refresh QR...");
                        handleRefresh();
                    }
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [qr, activeMode, handleRefresh]);

    // Fallback timer jika di mode websocket tapi tidak ada event yang masuk
    useEffect(() => {
        if (!qr || activeMode !== "websocket") return;

        const timer = setTimeout(() => {
            console.log("⚠️ Fallback trigger (WebSocket belum kirim event)");
            handleRefresh();
        }, (qr.ttl + 2) * 1000 + Math.random() * 2000);

        return () => clearTimeout(timer);
    }, [qr, activeMode, handleRefresh]);

    const handleLogout = async () => {
        localStorage.removeItem("lokasi");
        localStorage.removeItem("token");
        localStorage.removeItem("did");
        localStorage.removeItem("qr_auto_switch");
        localStorage.removeItem("qr_mode");
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-white">
            <div className="flex justify-center items-center min-h-screen">
                <div>
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold text-lg">
                                QR Code Absensi
                                {lokasi && (
                                    <span className="px-2 py-1 ">
                                        - {lokasi
                                            .replace(/_/g, " ")
                                            .replace(/\b\w/g, (char) => char.toUpperCase())}
                                    </span>
                                )}
                            </span>

                            {/* Status Mode Badge */}
                            <Tag color={activeMode === "websocket" ? "blue" : "orange"} className="font-medium">
                                Mode: {activeMode === "websocket" ? "WebSocket" : "API Langsung"}
                                {" "}(Auto-Switch: {autoSwitch ? "ON" : "OFF"})
                            </Tag>
                        </div>

                        <Tooltip title="Logout">
                            <Button
                                type="text"
                                icon={<LogoutOutlined />}
                                danger
                                onClick={handleLogout}
                            />
                        </Tooltip>
                    </div>

                    <Card className="text-center shadow-sm">
                        <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                            {lokasi ? (
                                <>
                                    {loading ? (
                                        <div className="flex flex-col items-center justify-center" style={{ width: 500, minHeight: 400 }}>
                                            <Spin size="large" />
                                            <p className="mt-4 text-gray-600 text-lg font-medium">
                                                Sabar, sedang menyiapkan QR Code...
                                            </p>
                                        </div>
                                    ) : errorMessage && !qr ? (
                                        <div className="flex flex-col items-center justify-center p-4" style={{ width: 500, minHeight: 400 }}>
                                            <Alert
                                                type="error"
                                                showIcon
                                                message="Kendala Koneksi Server"
                                                description={errorMessage}
                                                className="mb-4 text-left w-full"
                                            />
                                            <Button
                                                type="primary"
                                                size="large"
                                                icon={<ReloadOutlined />}
                                                onClick={handleRefresh}
                                            >
                                                Coba Hubungkan Ulang & Refresh QR
                                            </Button>
                                        </div>
                                    ) : qr ? (
                                        <>
                                            {errorMessage && (
                                                <Alert
                                                    type="warning"
                                                    showIcon
                                                    message={errorMessage}
                                                    className="mb-3 max-w-lg text-left"
                                                    closable
                                                    onClose={() => setErrorMessage(null)}
                                                />
                                            )}
                                            <QRCode value={qr.qr} size={500} />
                                            <p className="mt-4 font-medium text-gray-700">
                                                QR refresh dalam {countdown} detik
                                            </p>
                                            <Button
                                                type="primary"
                                                icon={<ReloadOutlined />}
                                                onClick={handleRefresh}
                                            >
                                                Refresh QR
                                            </Button>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center p-4" style={{ width: 500, minHeight: 400 }}>
                                            <Alert
                                                type="info"
                                                showIcon
                                                message="QR Code Belum Tersedia"
                                                description="Silakan klik tombol di bawah untuk memuat QR Code."
                                                className="mb-4 text-left w-full"
                                            />
                                            <Button
                                                type="primary"
                                                size="large"
                                                icon={<ReloadOutlined />}
                                                onClick={handleRefresh}
                                            >
                                                Muat QR Code
                                            </Button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <p>Lokasi belum disetting pada user</p>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}
