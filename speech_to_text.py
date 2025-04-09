import asyncio
import websockets
import azure.cognitiveservices.speech as speechsdk

# Azure STT Config
speech_config = speechsdk.SpeechConfig(subscription="YOUR_AZURE_KEY", region="centralindia")

async def handle_audio(websocket, path):
    print("✅ Client connected")  # Fix 1: Ensure this prints

    try:
        stream = speechsdk.audio.PushAudioInputStream()
        audio_config = speechsdk.audio.AudioConfig(stream=stream)
        speech_recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)

        print("🎙 Ready to receive audio...")

        async for audio_chunk in websocket:
            print("🔹 Receiving audio chunk...")
            stream.write(audio_chunk)  # Writing incoming audio chunks
        
        print("📌 Audio stream ended. Processing speech...")

        stream.close()
        result = speech_recognizer.recognize_once()  # STT processing
        
        if result.reason == speechsdk.ResultReason.RecognizedSpeech:
            text_output = result.text
            print("✅ Recognized Text:", text_output)
            await websocket.send(text_output)
        else:
            print("❌ No speech recognized")
            await websocket.send("No speech recognized")

    except websockets.exceptions.ConnectionClosed:
        print("❌ Client disconnected")
    except Exception as e:
        print(f"⚠ Error: {e}")

async def main():
    server = await websockets.serve(handle_audio, "0.0.0.0", 8000)  # Fix 2: Changed "localhost" to "0.0.0.0"
    print("🚀 WebSocket server started on ws://localhost:8000")
    print("🔴 Press Ctrl+C to stop the server")

    try:
        await asyncio.Future()  # Keep server running
    except asyncio.CancelledError:
        print("🛑 Server shutdown initiated")
    finally:
        server.close()
        await server.wait_closed()
        print("✅ Server stopped")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n🛑 Server stopped by user")
