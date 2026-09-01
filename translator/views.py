from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse, JsonResponse
from .models import User, SignVideo, TranslationHistory
from datetime import datetime
import whisper
import os
import uuid
import requests

# ============================================================
# GLOBAL WHISPER MODEL — Load once at server startup
# ============================================================

_whisper_model = None

def get_whisper_model():
    """Load the Whisper base model once and return it for all requests."""
    global _whisper_model
    if _whisper_model is None:
        print("[Whisper] Loading model (base)...")
        try:
            _whisper_model = whisper.load_model("base")
            print("[Whisper] Model loaded successfully.")
        except Exception as e:
            print(f"[Whisper] Failed to load model: {e}")
            raise RuntimeError(f"Whisper model could not be loaded: {e}")
    return _whisper_model


# ============================================================
# HELPER — Greeting
# ============================================================

def get_greeting():
    hour = datetime.now().hour
    if 5 <= hour < 12:
        return "Good Morning"
    elif 12 <= hour < 17:
        return "Good Afternoon"
    elif 17 <= hour < 21:
        return "Good Evening"
    else:
        return "Good Night"


# ============================================================
# HELPER — Role Decorators / Guards
# ============================================================

def require_login(request):
    """Returns a redirect if user is not logged in, else None."""
    if "user_id" not in request.session:
        return redirect("login")
    return None


def require_admin(request):
    """Returns a redirect if user is not an Admin, else None."""
    check = require_login(request)
    if check:
        return check
    if request.session.get("role") != "Admin":
        return redirect("user_home")
    return None


# ============================================================
# HELPER — Database-Aware Word Processing
# ============================================================

def get_db_vocabulary():
    """Return a set of all lowercase words in the SignVideo database."""
    return set(word.lower() for word in SignVideo.objects.values_list("word", flat=True))


def process_with_ollama(text, db_vocab):
    """
    Send transcribed text to Ollama for NLP keyword extraction.
    The prompt is database-aware: it tells Ollama to preserve words
    that exist in the sign-language vocabulary, even if they are
    normally considered stopwords (e.g. 'I', 'Can', 'You').
    """
    url = "http://127.0.0.1:11434/api/generate"

    # Build a readable list of db words to pass in the prompt
    vocab_list = ", ".join(sorted(db_vocab)) if db_vocab else "(none)"

    prompt = f"""You are a keyword extractor for a Speech-to-Indian-Sign-Language (ISL) system.

SIGN LANGUAGE DATABASE VOCABULARY (these words have sign videos available):
{vocab_list}

USER INPUT (spoken sentence):
{text}

YOUR TASK:
Extract the words from the USER INPUT that are useful for sign language translation.

STRICT RULES:
1. Use ONLY words that appear in the USER INPUT.
2. Do NOT invent or add any words.
3. IMPORTANT: If a word from the USER INPUT exists in the SIGN LANGUAGE DATABASE VOCABULARY (case-insensitive), you MUST keep it — even if it is normally a stopword (e.g. "I", "Can", "You", "And", "But", "How", "My").
4. Remove words that do NOT appear in the SIGN LANGUAGE DATABASE VOCABULARY and are generic filler words (e.g. "the", "a", "an", "is", "am", "are", "was", "were", "to", "of", "for", "in", "on", "at", "it").
5. Preserve the original sentence order.
6. Return ONLY a comma-separated list of words.
7. Do NOT explain, do NOT add punctuation other than commas.
8. If only one word should be kept, return just that word.

Now extract keywords from the USER INPUT:
{text}
"""

    try:
        response = requests.post(
            url,
            json={
                "model": "phi3:mini",
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0
                }
            },
            timeout=60
        )

        if response.status_code == 200:
            result = response.json()
            return result.get("response", "").strip()

    except Exception as e:
        print(f"[Ollama] Error: {e}")

    return ""


def smart_word_matching(text, db_vocab):
    """
    Database-aware word matching preserving ISL sentence sequence.

    Algorithm:
    1. Tokenize input speech preserving spoken word order.
    2. Try Ollama for intelligent keyword extraction (database-aware prompt).
    3. Ensure ANY word existing in the SignVideo database (such as 'I', 'Can', 'You')
       is ALWAYS preserved.
    4. If Ollama is unavailable/fails, fallback to keeping all DB words plus
       non-stopword content words for unknown-word detection.
    5. Return words in spoken sentence order.
    """
    # Step 1 — Normalize the input sentence into individual word tokens
    import re
    raw_tokens = re.findall(r"[a-zA-Z0-9']+", text)
    tokens = [t.strip("'\".,!?;:") for t in raw_tokens if t.strip("'\".,!?;:")]

    print(f"[Matching] Input tokens: {tokens}")

    # Step 2 — Attempt Ollama extraction
    ollama_output = process_with_ollama(text, db_vocab)
    print(f"[Ollama] Raw output: {ollama_output}")

    ollama_words_lower = []
    if ollama_output:
        raw_ollama = re.findall(r"[a-zA-Z0-9']+", ollama_output)
        ollama_words_lower = [w.strip("'\".,!?;:").lower() for w in raw_ollama if w.strip("'\".,!?;:")]

    print(f"[Ollama] Parsed words: {ollama_words_lower}")

    # Step 3 — Filter stopwords only when Ollama is unavailable
    COMMON_STOPWORDS = {
        "the", "a", "an", "is", "am", "are", "was", "were",
        "to", "of", "for", "in", "on", "at", "it", "this", "that"
    }

    final_words = []
    for token in tokens:
        token_lower = token.lower()
        in_db = token_lower in db_vocab
        in_ollama = token_lower in ollama_words_lower

        if in_db or in_ollama:
            final_words.append(token_lower)
        elif not ollama_words_lower and token_lower not in COMMON_STOPWORDS:
            # Fallback when Ollama is unavailable/empty
            final_words.append(token_lower)

    print(f"[Matching] Final words to look up: {final_words}")
    return final_words


# ============================================================
# VIEW — index
# ============================================================

def index(request):
    return HttpResponse("Welcome to Speech to Sign Language Converter")


# ============================================================
# VIEW — Login
# ============================================================

def login_view(request):

    if request.method == "POST":

        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")

        if not email or not password:
            return render(request, "login.html", {
                "error": "Please fill in all fields."
            })

        try:
            user = User.objects.get(email=email, password=password)

            request.session["user_id"] = user.id
            request.session["role"] = user.role
            request.session["name"] = user.first_name

            if user.role == "Admin":
                return redirect("admin_home")
            else:
                return redirect("user_home")

        except User.DoesNotExist:
            return render(request, "login.html", {
                "error": "Invalid email or password. Please try again."
            })

    return render(request, "login.html")


# ============================================================
# VIEW — Logout (properly clears session)
# ============================================================

def logout_view(request):
    request.session.flush()
    return redirect("login")


# ============================================================
# VIEW — Register
# ============================================================

def register(request):

    if request.method == "POST":

        first_name = request.POST.get("first_name", "").strip()
        last_name = request.POST.get("last_name", "").strip()
        email = request.POST.get("email", "").strip()
        password = request.POST.get("password", "")
        confirm_password = request.POST.get("confirm_password", "")
        role = request.POST.get("role", "User")

        # Validate required fields
        if not first_name or not last_name or not email or not password:
            return render(request, "register.html", {
                "error": "All fields are required."
            })

        # Check passwords match
        if password != confirm_password:
            return render(request, "register.html", {
                "error": "Passwords do not match. Please try again."
            })

        # Check email already exists
        if User.objects.filter(email=email).exists():
            return render(request, "register.html", {
                "error": "An account with this email already exists. Please log in."
            })

        # Save user (password stored as-is per project requirements)
        User.objects.create(
            first_name=first_name,
            last_name=last_name,
            email=email,
            password=password,
            role=role
        )

        return redirect("login")

    return render(request, "register.html")


# ============================================================
# VIEW — User Home (translation page)
# ============================================================

def user_home(request):
    guard = require_login(request)
    if guard:
        return guard

    context = {
        "greeting": get_greeting(),
        "name": request.session.get("name", ""),
    }

    return render(request, "home.html", context)


# ============================================================
# VIEW — User Profile
# ============================================================

def profile(request):
    guard = require_login(request)
    if guard:
        return guard

    user = User.objects.get(id=request.session["user_id"])

    return render(request, "profile.html", {
        "user": user
    })


# ============================================================
# VIEW — Translation History (user-specific)
# ============================================================

def history_view(request):
    guard = require_login(request)
    if guard:
        return guard

    user = User.objects.get(id=request.session["user_id"])
    history = TranslationHistory.objects.filter(user=user).order_by("-created_at")[:50]

    return render(request, "history.html", {
        "history": history,
        "user": user,
    })


# ============================================================
# VIEW — Admin Home
# ============================================================

def admin_home(request):
    guard = require_admin(request)
    if guard:
        return guard

    # Handle video upload
    if request.method == "POST":
        word = request.POST.get("word", "").strip()
        video = request.FILES.get("video")

        if word and video:
            # Check if word already exists
            if SignVideo.objects.filter(word__iexact=word).exists():
                # Pass error back
                hour = datetime.now().hour
                context = {
                    "greeting": get_greeting(),
                    "total_users": User.objects.filter(role="User").count(),
                    "total_videos": SignVideo.objects.count(),
                    "total_history": TranslationHistory.objects.count(),
                    "videos": SignVideo.objects.all().order_by("word"),
                    "history": TranslationHistory.objects.order_by("-created_at").select_related("user")[:10],
                    "upload_error": f"A sign video for '{word}' already exists. Use Edit to update it.",
                }
                return render(request, "adminhome.html", context)

            SignVideo.objects.create(word=word, video=video)
            return redirect("admin_home")

    context = {
        "greeting": get_greeting(),
        "total_users": User.objects.filter(role="User").count(),
        "total_videos": SignVideo.objects.count(),
        "total_history": TranslationHistory.objects.count(),
        "videos": SignVideo.objects.all().order_by("word"),
        "history": TranslationHistory.objects.order_by("-created_at").select_related("user")[:10],
    }

    return render(request, "adminhome.html", context)


# ============================================================
# VIEW — Edit Video (Admin only)
# ============================================================

def edit_video(request, id):
    guard = require_admin(request)
    if guard:
        return guard

    video = get_object_or_404(SignVideo, id=id)

    if request.method == "POST":
        new_word = request.POST.get("word", "").strip()

        if new_word:
            video.word = new_word

        if request.FILES.get("video"):
            # Delete old video file before replacing
            if video.video:
                old_path = video.video.path
                if os.path.exists(old_path):
                    os.remove(old_path)
            video.video = request.FILES.get("video")

        video.save()
        return redirect("admin_home")

    return render(request, "edit_video.html", {
        "video": video
    })


# ============================================================
# VIEW — Delete Video (Admin only)
# ============================================================

def delete_video(request, id):
    guard = require_admin(request)
    if guard:
        return guard

    video = get_object_or_404(SignVideo, id=id)

    if video.video:
        video.video.delete(save=False)

    video.delete()

    return redirect("admin_home")


# ============================================================
# VIEW — Whisper Test (quick debug endpoint)
# ============================================================

def whisper_test(request):
    try:
        model = get_whisper_model()
        result = model.transcribe("test.m4a")
        text = result["text"]
        return HttpResponse(f"Transcription: {text}")
    except Exception as e:
        return HttpResponse(f"Error: {e}", status=500)


# ============================================================
# VIEW — Whisper + Ollama + Sign Video Matching
# ============================================================

def whisper_view(request):

    if request.method != "POST":
        return JsonResponse({"error": "POST request required"}, status=405)

    # Require login
    if "user_id" not in request.session:
        return JsonResponse({"error": "Authentication required"}, status=403)

    audio_file = request.FILES.get("audio")

    if not audio_file:
        return JsonResponse({"error": "No audio received"}, status=400)

    # Use a unique temp file to prevent race conditions
    temp_filename = f"temp_audio_{uuid.uuid4().hex}.webm"
    audio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", temp_filename)
    audio_path = os.path.normpath(audio_path)

    with open(audio_path, "wb+") as destination:
        for chunk in audio_file.chunks():
            destination.write(chunk)

    try:

        # ==============================
        # Step 1 — Whisper Transcription
        # ==============================

        model = get_whisper_model()  # Reuses loaded model

        result = model.transcribe(
            audio_path,
            language="en",
            task="transcribe",
            fp16=False
        )

        text = result["text"].strip()
        print(f"[Whisper] Transcribed: {text}")

        if not text:
            return JsonResponse({"error": "Could not recognize speech. Please try again."})


        # ==============================
        # Step 2 — Get DB Vocabulary
        # ==============================

        db_vocab = get_db_vocabulary()
        print(f"[DB] Vocabulary ({len(db_vocab)} words): {sorted(db_vocab)}")


        # ==============================
        # Step 3 — Smart Word Matching
        # (Database-aware Ollama + fallback)
        # ==============================

        matched_word_keys = smart_word_matching(text, db_vocab)
        print(f"[Pipeline] Words to look up: {matched_word_keys}")


        # ==============================
        # Step 4 — Find Sign Videos
        # ==============================

        sign_videos = []
        unknown_words = []

        for word_key in matched_word_keys:
            try:
                sign = SignVideo.objects.get(word__iexact=word_key)
                sign_videos.append({
                    "word": sign.word,
                    "video": sign.video.url
                })
            except SignVideo.DoesNotExist:
                if word_key:
                    unknown_words.append(word_key)

        print(f"[Result] Sign videos: {[v['word'] for v in sign_videos]}")
        print(f"[Result] Unknown words: {unknown_words}")


        # ==============================
        # Step 5 — Save Translation History
        # ==============================

        try:
            user = User.objects.get(id=request.session["user_id"])
            matched_str = ", ".join([v["word"] for v in sign_videos])
            TranslationHistory.objects.create(
                user=user,
                speech_text=text,
                matched_words=matched_str,
            )
            print(f"[History] Saved for user: {user.first_name}")
        except Exception as hist_err:
            print(f"[History] Error saving history: {hist_err}")


        # ==============================
        # Step 6 — Return Response
        # ==============================

        return JsonResponse({
            "text": text,
            "processed_words": matched_word_keys,
            "sign_videos": sign_videos,
            "unknown_words": unknown_words,
        })

    except Exception as e:
        print(f"[Error] whisper_view: {e}")
        return JsonResponse({"error": str(e)}, status=500)

    finally:
        if os.path.exists(audio_path):
            os.remove(audio_path)