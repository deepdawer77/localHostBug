import base64
import asyncio
import websockets
import json
import requests
import re
import time
import os
import azure.cognitiveservices.speech as speechsdk
from dotenv import load_dotenv
from pydub import AudioSegment
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor

load_dotenv()

# API keys and region
together_api_key = "4be69497833ef67be1e7425672b9132ad1ff9ceee0a1903549abf59b0d367ba2"
azure_speech_key = "25h4UbO95jsfP0TZ2urK0akwXeH4CHcCBgHiFiLQkNaKA858YBBTJQQJ99BDACGhslBXJ3w3AAAYACOGk1cL"
azure_region = "centralindia"
DEFAULT_LANGUAGE = "en-IN"
ENGLISH_VOICE = "en-IN-NeerjaNeural"
HINDI_VOICE = "hi-IN-SwaraNeural"

PORT = 8765

system_prompt = """You are Air India's friendly and helpful voice assistant that speaks both Hindi and English. 
You assist users with flight bookings, PNR status, ticket changes, cancellations, and general queries.
Always respond in a helpful and polite tone. Translate or respond in Hindi if the user uses Hindi.

If the user asks a vague or incomplete question, prompt them for more details or clarify their query. 

Example:
User: I want to check my PNR status
AI: Sure, please provide your 10-digit PNR number to check the status.

User: Mera ticket cancel karna hai
AI: Zaroor. Kripya apna PNR number batayein jiska aap ticket cancel karna chahte hain.
"""

# === Speech Recognition from Base64 Audio ===
def recognize_from_base64(base64_audio):
    audio_bytes = base64.b64decode(base64_audio)
    webm_file = tempfile.NamedTemporaryFile(delete=False, suffix=".webm")
    with open(webm_file.name, "wb") as f:
        f.write(audio_bytes)
    audio = AudioSegment.from_file(webm_file.name)
    wav_file = tempfile.NamedTemporaryFile(delete=False, suffix=".wav")
    audio.export(wav_file.name, format="wav")

    speech_config = speechsdk.SpeechConfig(subscription=azure_speech_key, region=azure_region)
    speech_config.speech_recognition_language = "en-IN"
    audio_config = speechsdk.audio.AudioConfig(filename=wav_file.name)
    recognizer = speechsdk.SpeechRecognizer(speech_config=speech_config, audio_config=audio_config)
    result = recognizer.recognize_once_async().get()

    os.remove(webm_file.name)
    os.remove(wav_file.name)

    return result.text if result.reason == speechsdk.ResultReason.RecognizedSpeech else ""

# === LLM Call ===
def get_llm_response(prompt):
    url = "https://api.together.ai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {together_api_key}",
        "Content-Type": "application/json"
    }
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    payload = {
        "model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
        "messages": messages,
        "max_tokens": 80,
        "temperature": 0.2
    }

    response = requests.post(url, headers=headers, json=payload)
    try:
        llm_text = response.json()["choices"][0]["message"]["content"].strip()
        print(f"[DEBUG] Raw LLM Response: {llm_text}")
        
        if llm_text.lower() == prompt.lower():
            # Respond with a prompt for more details if the response is too similar to the input
            return "I understand that you're asking about your PNR status. Could you please provide your 10-digit PNR number?"
        
        return llm_text
    except Exception as e:
        print(f"[ERROR] LLM response failed: {e}")
        return "I'm sorry, I couldn't understand that."

# === Azure TTS ===
def get_tts_audio_base64(text, language_code):
    voice = ENGLISH_VOICE if language_code == "en-IN" else HINDI_VOICE
    speech_config = speechsdk.SpeechConfig(subscription=azure_speech_key, region=azure_region)
    speech_config.speech_synthesis_voice_name = voice
    synthesizer = speechsdk.SpeechSynthesizer(speech_config=speech_config, audio_config=None)
    result = synthesizer.speak_text_async(text).get()
    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        audio_data = result.audio_data
        return base64.b64encode(audio_data).decode("utf-8")
    return ""

# === Language Detection ===
def detect_language(text):
    hindi_keywords = ["kya", "hai", "kaise", "kripya", "batao", "ticket", "pnr", "naam", "badlo", "samay"]
    if any(word in text.lower() for word in hindi_keywords):
        return "hi-IN"
    return "en-IN"

# === WebSocket Handler ===
async def handler(websocket):
    print("Client connected ✅")
    async for message in websocket:
        data = json.loads(message)
        if "audio" not in data:
            continue

        base64_audio = data["audio"]
        text = recognize_from_base64(base64_audio)

        print(f"[DEBUG] Recognized Text: {text}")
        if not text:
            await websocket.send(json.dumps({"error": "Speech not recognized."}))
            continue

        language = detect_language(text)
        print(f"[INFO] User said: {text} ({language})")

        llm_response = get_llm_response(text)
        print(f"[INFO] LLM Response: {llm_response}")

        tts_audio_b64 = get_tts_audio_base64(llm_response, language)

        await websocket.send(json.dumps({
            "user_text": text,
            "ai_text": llm_response,
            "audio_base64": tts_audio_b64
        }))
    print("Client disconnected ❌")

# === Run WebSocket Server ===
start_server = websockets.serve(handler, "0.0.0.0", PORT)
print(f"WebSocket server running on ws://localhost:{PORT}")
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
