import { useEffect, useRef } from "react";

const WebSocketClient = () => {
    const ws = useRef(null);

    useEffect(() => {
        ws.current = new WebSocket("ws://localhost:8000");

        ws.current.onopen = () => {
            console.log("Connected to WebSocket Server");
        };

        ws.current.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        ws.current.onclose = () => {
            console.log("WebSocket Disconnected");
        };

        return () => {
            ws.current.close();
        };
    }, []);

    return null;
};

export default WebSocketClient;
