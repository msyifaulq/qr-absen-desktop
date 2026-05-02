import { useState } from "react";

import LoginPage from "./pages/LoginPage";
import QrCodePage from "./pages/QrCodePage";

import "antd/dist/reset.css";

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
    // const [isLogin, setIsLogin] = useState(
    //     !!localStorage.getItem("token")
    // );

    if (!isLogin) {
        return <LoginPage onLogin={() => setIsLogin(true)} />;
    }

    return <QrCodePage />;
}

export default App;