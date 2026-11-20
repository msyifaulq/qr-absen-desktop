import { useEffect, useState, useCallback } from "react";

import LoginPage from "./pages/LoginPage";
import QrCodePage from "./pages/QrCodePage";

import "antd/dist/reset.css";
import { check } from "@tauri-apps/plugin-updater";
import { exit } from "@tauri-apps/plugin-process";
import { Button, Card, Modal, Spin } from "antd";
import { DownloadOutlined, ReloadOutlined } from "@ant-design/icons";
import api from "./api";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getCurrentWindow } from "@tauri-apps/api/window";

const closeApp = async () => {
    try {
        await exit(0);
    } catch {
        try {
            await getCurrentWindow().close();
        } catch (e) {
            console.error("Gagal menutup aplikasi:", e);
        }
    }
};

const FALLBACK_DOWNLOAD_URL = "https://jeoffice.doran.id/api/desktop/download/latest?download=1";

function App() {
    const [isLogin, setIsLogin] = useState(() => {
        const token = localStorage.getItem("token");
        const loginDate = localStorage.getItem("login_date");

        if (!token || !loginDate) return false;

        const today = new Date().toISOString().slice(0, 10);

        // kalau beda hari → logout
        if (today !== loginDate) {
            localStorage.removeItem("token");
            localStorage.removeItem("login_date");
            return false;
        }

        return true;
    });

    const [checkingUpdate, setCheckingUpdate] = useState(true);
    const [mustUpdate, setMustUpdate] = useState(false);
    const [updateError, setUpdateError] = useState<{ message: string; exeUrl: string } | null>(null);

    // 🔥 CHECK UPDATE SAAT APP START
    const checkUpdate = useCallback(async () => {
        setCheckingUpdate(true);
        setUpdateError(null);
        let loading: any = null;

        type MyUpdate = {
            version: string;
            notes?: string;
            pub_date?: string;
            platforms?: {
                [key: string]: {
                    url: string;
                    exe_url?: string;
                    signature: string;
                };
            };
            downloadAndInstall: () => Promise<void>;
        };

        try {
            const update = await check() as unknown as MyUpdate;
            console.log("UPDATE RESULT:", update);

            if (!update) {
                setMustUpdate(false);
                setCheckingUpdate(false);
                return;
            }

            setMustUpdate(true);

            const platformKey = "windows-x86_64";
            const platform = update?.platforms?.[platformKey];
            console.log("UPDATE platform:", platform);

            Modal.confirm({
                title: "Update Tersedia 🚨",
                content: `Versi ${update.version} tersedia. Kamu harus update untuk melanjutkan.`,
                okText: "Update Otomatis",
                cancelButtonProps: { style: { display: "none" } },
                closable: false,
                mask: false,
                centered: true,

                onOk: async () => {
                    loading = Modal.info({
                        title: "Updating...",
                        content: "Sedang mengunduh dan menginstall update...",
                        okButtonProps: { style: { display: "none" } },
                        closable: false
                    });

                    try {
                        await update.downloadAndInstall();

                        loading?.destroy?.();

                        Modal.success({
                            title: "Update Selesai",
                            content: "Update telah berhasil dipasang. Aplikasi akan keluar, silakan buka kembali aplikasi secara manual.",
                            okText: "Tutup Aplikasi",
                            onOk: async () => {
                                await closeApp();
                            }
                        });

                        setTimeout(async () => {
                            await closeApp();
                        }, 2500);

                    } catch (err) {
                        console.error("AUTO UPDATE FAILED:", err);
                        loading?.destroy?.();

                        let exeUrl = platform?.exe_url || platform?.url || "";
                        try {
                            const exeRes = await api.get("/api/desktop/download/latest");
                            exeUrl = exeRes?.data?.exe_url || exeRes?.data?.download_url || exeUrl;
                        } catch (e) {
                            console.error("Gagal ambil exe url via API:", e);
                        }

                        const finalUrl = exeUrl || FALLBACK_DOWNLOAD_URL;
                        setUpdateError({
                            message: "Auto-update gagal diunduh atau dipasang. Kemungkinan terjadi kendala jaringan atau CORS di perangkat ini.",
                            exeUrl: finalUrl
                        });
                    }
                }
            });

        } catch (err) {
            console.error("Update check error:", err);
            loading?.destroy?.();

            let exeUrl = "";
            try {
                const exeRes = await api.get("/api/desktop/download/latest");
                exeUrl = exeRes?.data?.exe_url || exeRes?.data?.download_url || "";
            } catch (e) {
                console.error("Gagal ambil exe url:", e);
            }

            const finalUrl = exeUrl || FALLBACK_DOWNLOAD_URL;
            setUpdateError({
                message: "Gagal memeriksa pembaruan otomatis (terkendala jaringan/CORS). Silakan unduh installer versi terbaru secara manual.",
                exeUrl: finalUrl
            });
        } finally {
            setCheckingUpdate(false);
        }
    }, []);

    useEffect(() => {
        checkUpdate();
    }, [checkUpdate]);

    useEffect(() => {
        const handler = async (e: KeyboardEvent) => {
            const isShortcut =
                e.ctrlKey &&
                e.altKey &&
                e.shiftKey &&
                e.key.toLowerCase() === "d";
            if (isShortcut) {
                const appWindow: any = getCurrentWindow();
                await appWindow.openDevtools();
            }
        };
        window.addEventListener("keydown", handler);
        return () => {
            window.removeEventListener("keydown", handler);
        };
    }, []);

    // 1. Tampilan saat sedang cek update (anti-blank)
    if (checkingUpdate) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <Spin size="large" />
                <p className="mt-4 text-gray-600 font-medium">Memeriksa pembaruan aplikasi...</p>
            </div>
        );
    }

    // 2. Tampilan jika ada error update / CORS (solusi anti-blank dengan tombol manual download)
    if (updateError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
                <Card className="shadow-lg text-center max-w-md w-full p-6">
                    <div className="text-amber-500 mb-3 text-5xl">⚠️</div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">Pembaruan Diperlukan</h2>
                    <p className="text-gray-600 text-sm mb-4">
                        {updateError.message}
                    </p>
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-left text-xs text-amber-800 mb-5">
                        <p className="font-semibold mb-1">💡 Solusi Mudah:</p>
                        <p>Silakan klik tombol di bawah untuk mengunduh installer manual (.exe) melalui browser, lalu install untuk memperbarui aplikasi.</p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <Button
                            type="primary"
                            size="large"
                            icon={<DownloadOutlined />}
                            onClick={async () => {
                                await openUrl(updateError.exeUrl);
                            }}
                        >
                            Download Installer (.exe) Manual
                        </Button>
                        <Button
                            icon={<ReloadOutlined />}
                            onClick={checkUpdate}
                        >
                            Coba Lagi
                        </Button>
                        <Button danger type="text" onClick={closeApp}>
                            Tutup Aplikasi
                        </Button>
                    </div>
                </Card>
            </div>
        );
    }

    // 3. Tampilan jika wajib update tapi sedang menunggu konfirmasi (anti-blank)
    if (mustUpdate) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <Spin size="large" />
                <p className="mt-4 text-gray-600 font-medium">Pembaruan versi tersedia. Sedang memproses...</p>
            </div>
        );
    }

    if (!isLogin) {
        return <LoginPage onLogin={() => setIsLogin(true)} />;
    }

    return <QrCodePage />;
}

export default App;
