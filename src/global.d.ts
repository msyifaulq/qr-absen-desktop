import Pusher from "pusher-js";

declare global {
    interface Window {
        Pusher: typeof Pusher;
        Echo: any;
    }
    
    const __APP_VERSION__: string;
    const __BUILD_DATE__: string;
}

export {};