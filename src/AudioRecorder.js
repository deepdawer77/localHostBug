import React, { useEffect, useRef, useState } from "react";

const AudioRecorder = () => {
  const ws = useRef(null);
  const [recording, setRecording] = useState(false);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const recognition = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");

    ws.current.onopen = () => {
      console.log("✅ WebSocket connected");
      setConnected(true);
    };

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("📝 Received data:", data);

        if (data.type === "tts_audio") {
          if (data.text && data.text.length > 0) {
            setMessages((prev) => [
              ...prev,
              { role: "ai", text: data.text },
            ]);
          }

          if (data.audio && data.audio.length > 0) {
            const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
            audio.play().catch((error) => {
              console.error("❌ Error playing audio:", error);
            });
          }
        } else if (data.type === "error") {
          setMessages((prev) => [
            ...prev,
            { role: "error", text: data.message },
          ]);
        }
      } catch (err) {
        console.log("📝 Plain server response:", event.data);
        setMessages((prev) => [...prev, { role: "ai", text: event.data }]);
      }
    };

    ws.current.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
      setConnected(false);
    };

    ws.current.onclose = () => {
      console.log("🔌 WebSocket disconnected");
      setConnected(false);
    };

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = "en-US";

      recognition.current.onresult = (event) => {
        const text = event.results[0][0].transcript;
        console.log("🎤 Recognized text:", text);

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ text }));
          setMessages((prev) => [...prev, { role: "user", text }]);
        }
      };

      recognition.current.onerror = (event) => {
        console.error("❌ Recognition error:", event.error);
        setRecording(false);
      };

      recognition.current.onend = () => {
        console.log("⏹ Recognition ended");
        setRecording(false);
      };
    } else {
      console.error("❌ Speech recognition not supported in this browser");
    }

    return () => {
      if (ws.current) ws.current.close();
      if (recognition.current) recognition.current.abort();
    };
  }, []);

  const startRecording = () => {
    if (recording || !connected) return;
    try {
      recognition.current?.start();
      setRecording(true);
    } catch (err) {
      console.error("❌ Start error:", err);
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    recognition.current?.stop();
    setRecording(false);
  };

  const sendTextMessage = (e) => {
    e.preventDefault();
    const text = e.target.elements.textInput.value.trim();
    if (text && connected) {
      ws.current.send(JSON.stringify({ text }));
      setMessages((prev) => [...prev, { role: "user", text }]);
      e.target.reset();
    }
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>🎤 Air India Voice Assistant</h1>

      <div style={{ marginBottom: "20px" }}>
        <span style={{ color: connected ? "green" : "red" }}>
          {connected ? "✅ Connected to server" : "❌ Disconnected from server"}
        </span>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <button
          onClick={startRecording}
          disabled={recording || !connected}
          style={{
            padding: "10px 20px",
            marginRight: "10px",
            backgroundColor: recording ? "#ccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: recording || !connected ? "not-allowed" : "pointer",
          }}
        >
          {recording ? "🔴 Recording..." : "🎙 Start Speaking"}
        </button>
        <button
          onClick={stopRecording}
          disabled={!recording}
          style={{
            padding: "10px 20px",
            backgroundColor: !recording ? "#ccc" : "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: !recording ? "not-allowed" : "pointer",
          }}
        >
          ⏹ Stop Speaking
        </button>
      </div>

      <div
        style={{
          height: "400px",
          overflowY: "auto",
          border: "1px solid #ddd",
          borderRadius: "4px",
          padding: "10px",
          marginBottom: "20px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              textAlign: msg.role === "user" ? "right" : "left",
              margin: "10px 0",
            }}
          >
            <div
              style={{
                display: "inline-block",
                padding: "10px 15px",
                borderRadius: "18px",
                maxWidth: "70%",
                backgroundColor:
                  msg.role === "user"
                    ? "#e1ffc7"
                    : msg.role === "error"
                    ? "#ffcccb"
                    : "#fff",
                color: msg.role === "error" ? "#d8000c" : "black",
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
              }}
            >
              <strong>
                {msg.role === "user"
                  ? "You: "
                  : msg.role === "ai"
                  ? "AI: "
                  : "Error: "}
              </strong>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={sendTextMessage} style={{ display: "flex" }}>
        <input
          type="text"
          name="textInput"
          placeholder="Type a message..."
          disabled={!connected}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "4px",
            border: "1px solid #ddd",
            marginRight: "10px",
          }}
        />
        <button
          type="submit"
          disabled={!connected}
          style={{
            padding: "10px 20px",
            backgroundColor: connected ? "#2196F3" : "#ccc",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: connected ? "pointer" : "not-allowed",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default AudioRecorder;
