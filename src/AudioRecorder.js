import React, { useEffect, useRef, useState } from "react";

const AudioRecorder = () => {
  const ws = useRef(null);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognition = useRef(null);

  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000");

    ws.current.onopen = () => {
      console.log("✅ WebSocket connected");
    };

    ws.current.onmessage = (event) => {
      console.log("📝 Server Response:", event.data);
      setTranscript(event.data);
    };

    ws.current.onerror = (err) => {
      console.error("❌ WebSocket error:", err);
    };

    ws.current.onclose = () => {
      console.log("🔌 WebSocket disconnected");
    };

    // Initialize Web Speech Recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = false;
      recognition.current.interimResults = false;
      recognition.current.lang = 'en-US';  // Default to English
      
      recognition.current.onresult = (event) => {
        const text = event.results[0][0].transcript;
        console.log("Recognized text:", text);
        
        // Send the recognized text to server
        if (ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ text: text }));
        }
      };
      
      recognition.current.onerror = (event) => {
        console.error("Recognition error:", event.error);
        setRecording(false);
      };
      
      recognition.current.onend = () => {
        console.log("Recognition ended");
        setRecording(false);
      };
    } else {
      console.error("Speech recognition not supported in this browser");
    }

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (recognition.current) {
        recognition.current.abort();
      }
    };
  }, []);

  const startRecording = async () => {
    if (recording) return;
    
    if (recognition.current) {
      recognition.current.start();
      setRecording(true);
      console.log("🎙 Speech recognition started");
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    
    if (recognition.current) {
      recognition.current.stop();
      setRecording(false);
      console.log("⏹ Speech recognition stopped");
    }
  };

  return (
    <div>
      <h2>🎤 Speech Recognition</h2>
      <button onClick={startRecording} disabled={recording}>
        Start Speaking
      </button>
      <button onClick={stopRecording} disabled={!recording}>
        Stop Speaking
      </button>
      <p>🗣 Recognized Speech: {transcript}</p>
    </div>
  );
};

export default AudioRecorder;