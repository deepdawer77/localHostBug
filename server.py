import base64
import io
import asyncio
import websockets
import json
from speech_to_text import recognize_from_base64

async def handle_audio(websocket):
    print("✅ Client connected")
    try:
        async for message in websocket:
            print("📥 Received message")
            try:
                data = json.loads(message)
                if "text" in data:
                    recognized_text = data["text"]
                    print("✅ Recognized Text:", recognized_text)
                    
                    # Here you would process the text with your Air India assistant
                    # For now, just echo it back
                    await websocket.send(recognized_text)
                elif "audio" in data:
                    print("⚠ Audio received but skipping conversion")
                    await websocket.send("Please use text mode instead")
                else:
                    print("⚠ No text or audio field in message")
            except json.JSONDecodeError:
                print("❌ Invalid JSON received")
    except websockets.exceptions.ConnectionClosed:
        print("❌ Client disconnected")
    except Exception as e:
        print(f"⚠ Error: {e}")

async def main():
    server = await websockets.serve(handle_audio, "localhost", 8000)
    print("🚀 WebSocket server started on ws://localhost:8000")
    print("🔴 Press Ctrl+C to stop the server")

    try:
        await asyncio.Future()  # keep running
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
