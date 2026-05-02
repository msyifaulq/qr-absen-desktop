import Echo from "laravel-echo";
import Pusher from "pusher-js";

window.Pusher = Pusher;

window.Echo = new Echo({
    broadcaster: "reverb",
    wsHost: "jeoffice.doran.id",
    wsPort: 80,
    wssPort: 443,
    key: "qtvcsva7cfyrbujewvtd",
    forceTLS: false,
    enabledTransports: ["ws", "wss"],
});