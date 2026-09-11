// ============================================================
// Speech to Sign — home.js
// All features: recording, transcription, video queue, fallback
// ============================================================

console.log("[Speech2Sign] home.js loaded.");


// ============================================================
// DOM Elements
// ============================================================

const recordBtn       = document.getElementById("record");
const speechText      = document.getElementById("speech");
const videosContainer = document.getElementById("videos");
const wordChips       = document.getElementById("wordChips");
const processedSection= document.getElementById("processedWordsSection");
const signMsg         = document.getElementById("sign-message");


// ============================================================
// Recording State
// ============================================================

let mediaRecorder  = null;
let audioChunks    = [];


// ============================================================
// Sign Video Queue State
// ============================================================

let signVideoQueue    = [];
let currentVideoIndex = 0;
let videoElement      = null;
let wordLabel         = null;
let dotsContainer     = null;
let counterLabel      = null;


// ============================================================
// Record Button Click
// ============================================================

recordBtn.addEventListener("click", async () => {

    // ─── START RECORDING ───────────────────────────────────

    if (!mediaRecorder || mediaRecorder.state === "inactive") {

        try {

            console.log("[Mic] Requesting microphone...");

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            audioChunks  = [];
            mediaRecorder = new MediaRecorder(stream);


            // Collect audio chunks
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }
            };


            // When recording stops → process
            mediaRecorder.onstop = async () => {

                console.log("[Mic] Recording stopped.");

                // Stop mic tracks
                stream.getTracks().forEach(track => track.stop());

                speechText.innerHTML = "⏳ Processing speech...";

                // Build audio blob
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
                console.log("[Mic] Audio size:", audioBlob.size, "bytes");

                // Prepare form data
                const formData = new FormData();
                formData.append("audio", audioBlob, "recording.webm");

                // Get CSRF token
                const csrfEl = document.querySelector("[name=csrfmiddlewaretoken]");
                if (!csrfEl) {
                    speechText.innerHTML = "❌ CSRF token missing. Please reload the page.";
                    resetRecordButton();
                    return;
                }

                try {

                    console.log("[API] Sending to /whisper/ ...");

                    speechText.innerHTML = "⏳ Transcribing speech (Whisper)...";

                    const response = await fetch("/whisper/", {
                        method: "POST",
                        headers: { "X-CSRFToken": csrfEl.value },
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error("Server error: HTTP " + response.status);
                    }

                    const data = await response.json();

                    console.log("[API] Response:", data);


                    if (data.error) {
                        speechText.innerHTML = "❌ " + data.error;
                        clearVideoOutput();
                    } else if (data.text) {

                        // ── Display Recognized Speech ─────────────────────
                        speechText.innerHTML = `"${data.text}"`;

                        // ── Display Word Chips ────────────────────────────
                        displayWordChips(data.sign_videos || [], data.unknown_words || []);

                        // ── Display Sign Videos ───────────────────────────
                        displaySignVideos(data.sign_videos || [], data.unknown_words || []);

                    } else {
                        speechText.innerHTML = "❌ Could not recognize speech. Please try again.";
                        clearVideoOutput();
                    }

                } catch (err) {
                    console.error("[API] Error:", err);
                    speechText.innerHTML = "❌ Connection error: " + err.message;
                    clearVideoOutput();
                }

                resetRecordButton();

            }; // end onstop


            // ── Start Recording ───────────────────────────────

            mediaRecorder.start();

            console.log("[Mic] Recording started.");

            speechText.innerHTML = "🎤 Listening... Speak now, then click Stop.";

            recordBtn.innerHTML  = '<i class="fa-solid fa-stop"></i> Stop Recording';
            recordBtn.style.background = "#dc2626";

        } catch (err) {

            console.error("[Mic] Error:", err);
            speechText.innerHTML = "❌ Microphone error: " + err.name +
                ". Please allow microphone access.";
            resetRecordButton();

        }

    }

    // ─── STOP RECORDING ────────────────────────────────────

    else if (mediaRecorder.state === "recording") {

        speechText.innerHTML = "⏳ Processing audio...";

        recordBtn.disabled   = true;
        recordBtn.innerHTML  = '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';

        mediaRecorder.stop();

    }

});


// ============================================================
// Reset Record Button
// ============================================================

function resetRecordButton() {
    recordBtn.disabled = false;
    recordBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Start Recording';
    recordBtn.style.background = "";
    mediaRecorder = null;
}


// ============================================================
// Clear Video Output
// ============================================================

function clearVideoOutput() {
    videosContainer.innerHTML = `
        <p id="sign-message" style="color:#9ca3af;">
            Your sign language translation will appear here...
        </p>`;
    processedSection.style.display = "none";
    wordChips.innerHTML = "";
    signVideoQueue    = [];
    currentVideoIndex = 0;
    videoElement      = null;
}


// ============================================================
// Display Word Chips (matched + unknown)
// ============================================================

function displayWordChips(signVideos, unknownWords) {
    wordChips.innerHTML = "";

    if (signVideos.length === 0 && unknownWords.length === 0) {
        processedSection.style.display = "none";
        return;
    }

    signVideos.forEach(sv => {
        const chip = document.createElement("span");
        chip.className = "word-chip-matched";
        chip.innerHTML = `<i class="fa-solid fa-check" style="font-size:11px;"></i> ${sv.word}`;
        wordChips.appendChild(chip);
    });

    unknownWords.forEach(w => {
        if (w) {
            const chip = document.createElement("span");
            chip.className = "word-chip-unknown";
            chip.innerHTML = `<i class="fa-solid fa-question" style="font-size:11px;"></i> ${w}`;
            wordChips.appendChild(chip);
        }
    });

    processedSection.style.display = "block";
}


// ============================================================
// Display Sign Videos — Queue Player
// ============================================================

function displaySignVideos(signVideos, unknownWords) {

    videosContainer.innerHTML = "";

    if (!signVideos || signVideos.length === 0) {

        videosContainer.innerHTML = `
            <p style="color:#9ca3af;text-align:center;padding:30px 0;">
                ⚠️ No matching sign videos found for the recognized words.
            </p>`;

        // Still show unknown words
        appendUnknownBanner(unknownWords);
        return;
    }


    // ── Store Queue ─────────────────────────────────────────

    signVideoQueue    = signVideos;
    currentVideoIndex = 0;


    // ── Video Player ─────────────────────────────────────────

    const wrap = document.createElement("div");
    wrap.id = "videoPlayerWrap";

    videoElement         = document.createElement("video");
    videoElement.id      = "signVideoPlayer";
    videoElement.controls  = true;
    videoElement.playsInline = true;
    videoElement.preload   = "auto";
    videoElement.style.cssText = "width:100%;border-radius:12px;background:#000;max-height:340px;";
    wrap.appendChild(videoElement);


    // ── Word Label ───────────────────────────────────────────

    wordLabel         = document.createElement("p");
    wordLabel.id      = "currentSignWord";
    wordLabel.style.cssText =
        "font-size:1.2rem;font-weight:700;color:#1d4ed8;margin:14px 0 8px;text-align:center;";
    wrap.appendChild(wordLabel);


    // ── Progress Dots ─────────────────────────────────────────

    dotsContainer = document.createElement("div");
    dotsContainer.id = "videoDots";
    dotsContainer.style.cssText =
        "display:flex;gap:8px;justify-content:center;margin:12px 0 4px;flex-wrap:wrap;";

    signVideos.forEach((_, i) => {
        const dot = document.createElement("div");
        dot.className = "dot" + (i === 0 ? " active" : "");
        dot.style.cssText =
            "width:10px;height:10px;border-radius:50%;background:" +
            (i === 0 ? "#2563eb" : "#d1d5db") + ";transition:background 0.3s;cursor:pointer;";
        dot.title = signVideos[i].word;
        dot.addEventListener("click", () => {
            currentVideoIndex = i;
            playSignVideo(i);
        });
        dotsContainer.appendChild(dot);
    });

    wrap.appendChild(dotsContainer);


    // ── Counter ───────────────────────────────────────────────

    counterLabel = document.createElement("p");
    counterLabel.id = "videoCounter";
    counterLabel.style.cssText =
        "text-align:center;font-size:13px;color:#6b7280;margin-top:6px;";
    wrap.appendChild(counterLabel);


    // ── Navigation Buttons ────────────────────────────────────

    const navRow = document.createElement("div");
    navRow.className = "video-nav";
    navRow.style.cssText =
        "display:flex;gap:12px;justify-content:center;margin-top:12px;flex-wrap:wrap;";

    const prevBtn = document.createElement("button");
    prevBtn.id    = "prevVideoBtn";
    prevBtn.innerHTML = '<i class="fa-solid fa-backward-step"></i> Previous';
    prevBtn.style.cssText =
        "padding:10px 22px;border:none;border-radius:8px;cursor:pointer;" +
        "font-size:14px;font-weight:600;background:#e5e7eb;color:#374151;transition:0.2s;";
    prevBtn.addEventListener("click", () => {
        if (currentVideoIndex > 0) {
            currentVideoIndex--;
            playSignVideo(currentVideoIndex);
        }
    });

    const nextBtn = document.createElement("button");
    nextBtn.id    = "nextVideoBtn";
    nextBtn.innerHTML = 'Next <i class="fa-solid fa-forward-step"></i>';
    nextBtn.style.cssText =
        "padding:10px 22px;border:none;border-radius:8px;cursor:pointer;" +
        "font-size:14px;font-weight:600;background:#2563eb;color:#fff;transition:0.2s;";
    nextBtn.addEventListener("click", () => {
        if (currentVideoIndex < signVideoQueue.length - 1) {
            currentVideoIndex++;
            playSignVideo(currentVideoIndex);
        }
    });

    const replayBtn = document.createElement("button");
    replayBtn.id    = "replayVideoBtn";
    replayBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Replay All';
    replayBtn.style.cssText =
        "padding:10px 22px;border:none;border-radius:8px;cursor:pointer;" +
        "font-size:14px;font-weight:600;background:#10b981;color:#fff;transition:0.2s;";
    replayBtn.addEventListener("click", () => {
        currentVideoIndex = 0;
        playSignVideo(0);
    });

    navRow.appendChild(prevBtn);
    navRow.appendChild(nextBtn);
    navRow.appendChild(replayBtn);
    wrap.appendChild(navRow);


    // ── Video Ended: Auto-advance ─────────────────────────────

    videoElement.addEventListener("ended", () => {
        console.log("[Video] Ended:", signVideoQueue[currentVideoIndex].word);

        // Mark dot as done
        updateDots(currentVideoIndex, "done");

        currentVideoIndex++;

        if (currentVideoIndex < signVideoQueue.length) {
            playSignVideo(currentVideoIndex);
        } else {
            wordLabel.innerHTML = "✅ Translation completed!";
            console.log("[Video] All videos played.");
        }
    });


    // ── Append to DOM ─────────────────────────────────────────

    videosContainer.appendChild(wrap);


    // ── Unknown Words Banner ──────────────────────────────────

    appendUnknownBanner(unknownWords);


    // ── Play First Video ──────────────────────────────────────

    playSignVideo(0);

}


// ============================================================
// Play a specific video from the queue by index
// ============================================================

function playSignVideo(index) {

    const sign = signVideoQueue[index];
    if (!sign || !videoElement) return;

    console.log("[Video] Playing:", sign.word, "(" + (index + 1) + "/" + signVideoQueue.length + ")");

    // Update word label
    wordLabel.innerHTML = "🤟 " + sign.word;

    // Update counter
    if (counterLabel) {
        counterLabel.innerHTML =
            "Showing " + (index + 1) + " of " + signVideoQueue.length + " signs";
    }

    // Update dots
    updateDots(index, "active");

    // Set and play video
    videoElement.src = sign.video;
    videoElement.load();

    videoElement.play().catch(err => {
        console.warn("[Video] Autoplay blocked:", err.message,
            "— use the play button or click Next.");
    });

}


// ============================================================
// Update dot indicators
// ============================================================

function updateDots(activeIndex, activeState) {
    if (!dotsContainer) return;

    const dots = dotsContainer.querySelectorAll(".dot");

    dots.forEach((dot, i) => {
        dot.style.background = "#d1d5db";
        dot.className = "dot";

        if (i < activeIndex) {
            dot.style.background = "#10b981";
            dot.className = "dot done";
        } else if (i === activeIndex) {
            if (activeState === "done") {
                dot.style.background = "#10b981";
                dot.className = "dot done";
            } else {
                dot.style.background = "#2563eb";
                dot.className = "dot active";
            }
        }
    });
}


// ============================================================
// Append Unknown Words Banner
// ============================================================

function appendUnknownBanner(unknownWords) {
    if (!unknownWords || unknownWords.length === 0) return;

    // Filter blanks
    const filtered = unknownWords.filter(w => w && w.trim());
    if (filtered.length === 0) return;

    const banner = document.createElement("div");
    banner.id = "unknownWordsBanner";
    banner.style.cssText =
        "background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;" +
        "padding:14px 18px;margin-top:16px;font-size:14px;color:#92400e;";

    banner.innerHTML =
        `<i class="fa-solid fa-triangle-exclamation"></i>
         <strong>No sign video available for:</strong>
         <span style="margin-left:6px;">${filtered.join(", ")}</span>`;

    videosContainer.appendChild(banner);
}


// ============================================================
// Page Load
// ============================================================

window.addEventListener("load", () => {
    console.log("[Speech2Sign] Dashboard ready.");
});