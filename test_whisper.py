import whisper

print("Loading Whisper model...")

model = whisper.load_model("base")

print("Transcribing audio...")

result = model.transcribe("test.m4a")

print("Transcription:")
print(result["text"])