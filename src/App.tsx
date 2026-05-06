import { useEffect, useState } from "react";

import LoginPage from "./pages/LoginPage";
import QrCodePage from "./pages/QrCodePage";

import "antd/dist/reset.css";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Modal } from "antd";
import api from "./api";

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
    // 🔥 CHECK UPDATE SAAT APP START
    useEffect(() => {
        async function checkUpdate() {
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

                if (!update) return;

                setMustUpdate(true);

                const platformKey = "windows-x86_64";
                const platform = update?.platforms?.[platformKey];
                console.log("UPDATE platform:", platform);

                const exeRes = await api.get("/desktop/download/latest");
                const exeUrl = exeRes?.data?.exe_url;

                Modal.confirm({
                    title: "Update Tersedia 🚨",
                    content: `Versi ${update.version} tersedia. Kamu harus update untuk melanjutkan.`,
                    okText: "Update",
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

                            loading.destroy();

                            Modal.success({
                                title: "Update Selesai",
                                content: "Aplikasi akan restart...",
                                okButtonProps: { style: { display: "none" } }
                            });

                            setTimeout(async () => {
                                await relaunch();
                            }, 1500);

                        } catch (err) {
                            console.error("AUTO UPDATE FAILED:", err);

                            loading?.destroy?.();

                            Modal.error({
                                title: "Update Gagal",
                                content: (
                                    <div>
                                        <p>Auto update gagal dijalankan.</p>
                                        <p>Silakan download installer manual.</p>
                                    </div>
                                ),
                                okText: "Download .exe",
                                cancelText: "Keluar",

                                onOk: () => {
                                    window.open(exeUrl, "_blank");
                                },

                                onCancel: async () => {
                                    await relaunch();
                                }
                            });
                        }
                    }
                });

            } catch (err) {
                console.error("Update error:", err);

                loading?.destroy?.();

                const exeRes = await api.get("/desktop/download/latest");
                const exeUrl = exeRes?.data?.exe_url;

                Modal.error({
                    title: "Update Gagal",
                    content: (
                        <div>
                            <p>Update gagal dilakukan otomatis.</p>
                            <p>Silakan download manual.</p>
                        </div>
                    ),
                    okText: "Download .exe",
                    onOk: () => {
                        // fallback global
                        window.open(exeUrl, "_blank");
                    }
                });
            } finally {
                setCheckingUpdate(false);
            }
        }

        checkUpdate();
    }, []);

    // 🔥 BLOCK SEMUA UI SAAT CHECK UPDATE
    if (checkingUpdate) {
        return null; // atau splash screen
    }

    // 🔥 BLOCK UI kalau wajib update
    if (mustUpdate) {
        return null;
    }

    if (!isLogin) {
        return <LoginPage onLogin={() => setIsLogin(true)} />;
    }

    return <QrCodePage />;
}

export default App;