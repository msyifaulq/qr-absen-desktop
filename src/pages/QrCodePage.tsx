import { useEffect, useState } from "react";
import { Button, Card, QRCode, Spin, Tooltip } from "antd";
import { LogoutOutlined } from "@ant-design/icons";
import api from "../api";

export default function QrCodePage() {
    const [qr, setQr] = useState<{ qr: string; ttl: number } | null>(null);
    const [countdown, setCountdown] = useState(30);
    const [loading, setLoading] = useState(false);

    const lokasi = localStorage.getItem("lokasi");
    const did = localStorage.getItem("did");

    useEffect(() => {
        if (!lokasi) return;

        console.log("LD:", lokasi + did);
    }, [lokasi, did]);

    // 🔥 LISTEN ECHO
    useEffect(() => {
        if (!lokasi) return;

        const [kantor, lantai] = lokasi.split("_");
        const channelName = `absensi.${kantor}.${lantai}.${did}`;
        const channel = window.Echo.channel(channelName);

        // ✅ cek koneksi websocket
        window.Echo.connector.pusher.connection.bind("state_change", (states: any) => {
            console.log("WS STATE:", states);
        });

        window.Echo.connector.pusher.connection.bind("connected", () => {
            console.log("✅ WS CONNECTED");
        });

        window.Echo.connector.pusher.connection.bind("error", (err: any) => {
            console.error("❌ WS ERROR:", err);
        });

        // ✅ cek berhasil join channel
        channel.subscribed(() => {
            console.log("✅ JOINED CHANNEL:", channelName);
            handleRefresh();
        });

        channel.error((err: any) => {
            console.error("❌ CHANNEL ERROR:", err);
        });

        // ✅ tangkap semua event (super penting)
        channel.listenToAll((event: string, data: any) => {
            console.log("🔥 EVENT MASUK:", event, data);
        });

        channel
            .listen(".qr-code-absen-generated", (e: any) => {
                console.log("QR GENERATED", e);

                setQr({
                    qr: e.qr + "",
                    ttl: e.ttl || 30,
                });

                setCountdown(e.ttl || 30);
                setLoading(false);
            })
            .listen(".qr-code-absen-used", () => {
                console.log("QR USED -> tunggu generate baru");
            });

        return () => {
            window.Echo.leave(`absensi.${kantor}.${lantai}.${did}`);
        };
    }, [lokasi]);

    useEffect(() => {
        if (!qr) return;

        const timer = setTimeout(() => {
            console.log("⚠️ fallback trigger");
            handleRefresh();
        }, (qr.ttl + 2) * 1000 + Math.random() * 3000);

        return () => clearInterval(timer);
    }, [qr]);

    // Countdown timer
    useEffect(() => {
        if (!qr) return;
        setCountdown(qr.ttl);

        const interval = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);

        return () => clearInterval(interval);
    }, [qr]);

    const handleRefresh = async () => {
        try {
            setLoading(true);
            await api.get("/api/qr-absen");
        } catch (err) {
            console.error("Gagal trigger refresh:", err);
        }
    };

    const handleLogout = async () => {
        localStorage.removeItem("lokasi");
        localStorage.removeItem("token");
        localStorage.removeItem("did");
        window.location.reload();
    };

    return (
        <>
            <div className="min-h-screen bg-white">
                <div className="flex justify-center items-center min-h-screen">
                    <div>
                        <div className="flex justify-between items-center mb-3">
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

                            <Tooltip title="Logout">
                                <Button
                                    type="text"
                                    icon={<LogoutOutlined />}
                                    danger
                                    onClick={handleLogout}
                                />
                            </Tooltip>
                        </div>

                        <Card className="text-center">
                            <div style={{ height: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>

                                {lokasi ? (
                                    <>
                                        {loading ? (
                                            <div className="flex flex-col items-center justify-center" style={{ width: 500 }}>
                                                <Spin size="large" />
                                                <p className="mt-4 text-gray-600 text-lg font-medium">
                                                    Sabar, sedang menyiapkan QR Code...
                                                </p>
                                            </div>
                                        ) : qr ? (
                                            <>
                                                <QRCode value={qr.qr} size={500} />
                                                <p className="mt-4">
                                                    QR refresh dalam {countdown} detik
                                                </p>
                                            </>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center" style={{ width: 500 }}>
                                                <Spin size="large" />
                                                <p className="mt-4 text-gray-600 text-lg font-medium">
                                                    Sabar, sedang menyiapkan QR Code...
                                                </p>
                                            </div>
                                        )}

                                        <Button type="primary" onClick={handleRefresh}>
                                            Refresh QR
                                        </Button>
                                    </>
                                ) : (
                                    <p>Lokasi belum disetting pada user</p>
                                )}

                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </>
    );
}