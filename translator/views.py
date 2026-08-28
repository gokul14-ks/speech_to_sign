from django.shortcuts import render,redirect,get_object_or_404
from django.http import HttpResponse,JsonResponse
from .models import *
from datetime import datetime
import whisper
import os
import requests
# Create your views here.
def index(request):
    return HttpResponse("Welcome to Speech to Sign Language Converter")
def login_view(request):

    if request.method == "POST":

        email = request.POST.get("email")
        password = request.POST.get("password")

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
                "error": "Invalid Email or Password"
            })

    return render(request, "login.html")
def user_home(request):
    if "user_id" not in request.session:
        return redirect("login")

    hour = datetime.now().hour

    if 5 <= hour < 12:
        greeting = "Good Morning"
    elif 12 <= hour < 17:
        greeting = "Good Afternoon"
    elif 17 <= hour < 21:
        greeting = "Good Evening"
    else:
        greeting = "Good Night"

    context = {
        "greeting": greeting,
    }

    return render(request, "home.html", context)
def profile(request):

    if "user_id" not in request.session:
        return redirect("login")

    user = User.objects.get(id=request.session["user_id"])

    return render(request, "profile.html", {
        "user": user
    })
def register(request):

    if request.method == "POST":

        first_name = request.POST.get("first_name")
        last_name = request.POST.get("last_name")
        email = request.POST.get("email")
        password = request.POST.get("password")
        confirm_password = request.POST.get("confirm_password")
        role = request.POST.get("role")

        # Check if passwords match
        if password != confirm_password:
            return render(request, "register.html", {
                "error": "Passwords do not match."
            })

        # Check if email already exists
        if User.objects.filter(email=email).exists():
            return render(request, "register.html", {
                "error": "Email already exists."
            })

        # Save user
        User.objects.create(
            first_name=first_name,
            last_name=last_name,
            email=email,
            password=password,
            role=role
        )

        return redirect("login")

    return render(request, "register.html")
def admin_home(request):

    if "user_id" not in request.session:
        return redirect("login")

    # Handle video upload
    if request.method == "POST":

        word = request.POST.get("word")
        video = request.FILES.get("video")

        if word and video:
            SignVideo.objects.create(
                word=word,
                video=video
            )

            return redirect("admin_home")

    # Greeting
    hour = datetime.now().hour

    if 5 <= hour < 12:
        greeting = "Good Morning"
    elif 12 <= hour < 17:
        greeting = "Good Afternoon"
    elif 17 <= hour < 21:
        greeting = "Good Evening"
    else:
        greeting = "Good Night"

    context = {
        "greeting": greeting,
        "total_users": User.objects.filter(role="User").count(),
        "total_videos": SignVideo.objects.count(),
        "total_history": TranslationHistory.objects.count(),
        "videos": SignVideo.objects.all().order_by("word"),
        "history": TranslationHistory.objects.order_by("-created_at")[:5],
    }

    return render(request, "adminhome.html", context)
def edit_video(request, id):

    video = get_object_or_404(SignVideo, id=id)

    if request.method == "POST":

        video.word = request.POST.get("word")

        if request.FILES.get("video"):
            video.video = request.FILES.get("video")

        video.save()

        return redirect("admin_home")

    return render(request, "edit_video.html", {
        "video": video
    })
def delete_video(request, id):

    video = get_object_or_404(SignVideo, id=id)

    if video.video:
        video.video.delete(save=False)

    video.delete()

    return redirect("admin_home")
def whisper_test(request):
    model = whisper.load_model("base")

    result = model.transcribe("test.m4a")

    text = result["text"]

    return HttpResponse(text)
def process_with_ollama(text):

    url = "http://127.0.0.1:11434/api/generate"

    prompt = f"""
You are part of a Speech-to-Indian-Sign-Language system.

The user said:
"{text}"

Extract the important words that should be searched in a sign language video database.

Rules:
- Return only important words.
- Remove unnecessary words such as: the, a, an, is, am, are, was, were, to, of, can, could, please, I, you.
- Keep important nouns and verbs.
- Do not explain anything.
- Return only a comma-separated list.

Example:
Input: I want to go to the hospital
Output: want, go, hospital
"""

    response = requests.post(
        url,
        json={
            "model": "phi3:mini",
            "prompt": prompt,
            "stream": False
        },
        timeout=60
    )

    if response.status_code == 200:

        result = response.json()

        return result.get("response", "").strip()

    return ""
def whisper_view(request):

    if request.method != "POST":
        return JsonResponse({
            "error": "POST request required"
        })

    audio_file = request.FILES.get("audio")

    if not audio_file:
        return JsonResponse({
            "error": "No audio received"
        })

    audio_path = "temp_audio.webm"

    with open(audio_path, "wb+") as destination:

        for chunk in audio_file.chunks():
            destination.write(chunk)

    try:

        # ==============================
        # Whisper Speech Recognition
        # ==============================

        model = whisper.load_model("base")

        result = model.transcribe(
            audio_path,
            language="en",
            task="transcribe",
            fp16=False
        )

        text = result["text"].strip()

        print("Whisper text:", text)


        # ==============================
        # Ollama Text Processing
        # ==============================

        ollama_output = process_with_ollama(text)

        print("Ollama output:", ollama_output)


        # ==============================
        # Convert Ollama Output to Words
        # ==============================

        words = [
            word.strip().lower()
            for word in ollama_output.split(",")
            if word.strip()
        ]

        print("Processed words:", words)


        # ==============================
        # Find Sign Videos
        # ==============================

        sign_videos = []
        unknown_words = []

        for word in words:

            clean_word = word.strip(".,!?;:")

            try:

                sign = SignVideo.objects.get(
                    word__iexact=clean_word
                )

                sign_videos.append({
                    "word": sign.word,
                    "video": sign.video.url
                })

            except SignVideo.DoesNotExist:

                unknown_words.append(clean_word)


        print("Sign videos:", sign_videos)
        print("Unknown words:", unknown_words)


        # ==============================
        # Send Response
        # ==============================

        return JsonResponse({

            "text": text,

            "processed_words": words,

            "sign_videos": sign_videos,

            "unknown_words": unknown_words

        })


    except Exception as e:

        print("Whisper/Ollama error:", str(e))

        return JsonResponse({
            "error": str(e)
        })


    finally:

        if os.path.exists(audio_path):
            os.remove(audio_path)