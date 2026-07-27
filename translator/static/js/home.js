// ==============================
// Speech to Sign - Home JS
// ==============================

console.log("NEW HOME.JS LOADED");


// ==============================
// Elements
// ==============================

const recordBtn = document.getElementById("record");
const speechText = document.getElementById("speech");
const videosContainer = document.getElementById("videos");

let mediaRecorder;
let audioChunks = [];


// ==============================
// Sign Video Queue
// ==============================

let signVideoQueue = [];
let currentVideoIndex = 0;


// ==============================
// Whisper Speech Recording
// ==============================

recordBtn.addEventListener("click", async () => {

    // ==========================
    // START RECORDING
    // ==========================

    if (!mediaRecorder || mediaRecorder.state === "inactive") {

        try {

            console.log("Starting microphone...");

            const stream =
                await navigator.mediaDevices.getUserMedia({
                    audio: true
                });

            audioChunks = [];

            mediaRecorder = new MediaRecorder(stream);


            // ==========================
            // Collect Audio Data
            // ==========================

            mediaRecorder.ondataavailable = (event) => {

                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                }

            };


            // ==========================
            // When Recording Stops
            // ==========================

            mediaRecorder.onstop = async () => {

                console.log("Recording stopped");


                // Stop microphone
                stream.getTracks().forEach(
                    track => track.stop()
                );


                speechText.innerHTML =
                    "⏳ Converting speech to text...";


                // ==========================
                // Create Audio File
                // ==========================

                const audioBlob = new Blob(
                    audioChunks,
                    {
                        type: "audio/webm"
                    }
                );


                console.log(
                    "Audio size:",
                    audioBlob.size
                );


                // ==========================
                // Prepare Form Data
                // ==========================

                const formData = new FormData();

                formData.append(
                    "audio",
                    audioBlob,
                    "recording.webm"
                );


                // ==========================
                // Get CSRF Token
                // ==========================

                const csrfElement =
                    document.querySelector(
                        "[name=csrfmiddlewaretoken]"
                    );


                if (!csrfElement) {

                    speechText.innerHTML =
                        "❌ CSRF token not found.";

                    recordBtn.disabled = false;

                    recordBtn.innerHTML =
                        '<i class="fa-solid fa-microphone"></i> Start Recording';

                    return;
                }


                const csrfToken =
                    csrfElement.value;


                // ==========================
                // Send Audio to Django
                // ==========================

                try {

                    console.log(
                        "Sending audio to Django..."
                    );


                    const response =
                        await fetch(
                            "/whisper/",
                            {
                                method: "POST",

                                headers: {
                                    "X-CSRFToken":
                                        csrfToken
                                },

                                body: formData
                            }
                        );


                    // ==========================
                    // Check Response
                    // ==========================

                    if (!response.ok) {

                        throw new Error(
                            "Server returned " +
                            response.status
                        );

                    }


                    const data =
                        await response.json();


                    console.log(
                        "Whisper response:",
                        data
                    );


                    // ==========================
                    // Display Transcription
                    // ==========================

                    if (data.text) {

                        speechText.innerHTML =
                            data.text;


                        // ==========================
                        // Display Sign Videos
                        // ==========================

                        displaySignVideos(
                            data.sign_videos,
                            data.unknown_words
                        );

                    }

                    else {

                        speechText.innerHTML =
                            "❌ " +
                            (
                                data.error ||
                                "Transcription failed."
                            );

                    }


                }

                catch (error) {

                    console.error(
                        "Whisper connection error:",
                        error
                    );


                    speechText.innerHTML =
                        "❌ Could not connect to server.";

                }


                // ==========================
                // Reset Button
                // ==========================

                recordBtn.disabled = false;

                recordBtn.innerHTML =
                    '<i class="fa-solid fa-microphone"></i> Start Recording';

                mediaRecorder = null;

            };


            // ==========================
            // Start Recording
            // ==========================

            mediaRecorder.start();


            console.log(
                "Recording started"
            );


            speechText.innerHTML =
                "🎤 Listening... Speak now.";


            recordBtn.innerHTML =
                '<i class="fa-solid fa-stop"></i> Stop Recording';

        }


        catch (error) {

            console.error(
                "Microphone error:",
                error
            );


            speechText.innerHTML =
                "❌ Microphone error: " +
                error.name;


            recordBtn.disabled = false;


            recordBtn.innerHTML =
                '<i class="fa-solid fa-microphone"></i> Start Recording';

        }

    }


    // ==========================
    // STOP RECORDING
    // ==========================

    else if (
        mediaRecorder.state === "recording"
    ) {

        console.log(
            "Stopping recording..."
        );


        speechText.innerHTML =
            "⏳ Processing audio...";


        recordBtn.disabled = true;


        recordBtn.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> Processing...';


        mediaRecorder.stop();

    }

});


// ==============================
// Display Sign Videos
// ==============================

function displaySignVideos(
    signVideos,
    unknownWords
) {

    console.log(
        "Sign videos:",
        signVideos
    );


    console.log(
        "Unknown words:",
        unknownWords
    );


    // ==========================
    // Clear Previous Output
    // ==========================

    videosContainer.innerHTML = "";


    // ==========================
    // Check Videos
    // ==========================

    if (
        !signVideos ||
        signVideos.length === 0
    ) {

        videosContainer.innerHTML = `
            <p>
                ⚠️ No matching sign videos found.
            </p>
        `;

        return;

    }


    // ==========================
    // Store Video Queue
    // ==========================

    signVideoQueue = signVideos;

    currentVideoIndex = 0;


    // ==========================
    // Create Video Player
    // ==========================

    const video =
        document.createElement("video");


    video.id =
        "signVideoPlayer";


    video.controls = true;

    video.playsInline = true;

    video.preload = "auto";

    video.style.width = "100%";


    // ==========================
    // Current Word
    // ==========================

    const wordLabel =
        document.createElement("p");


    wordLabel.id =
        "currentSignWord";


    wordLabel.innerHTML =
        "Preparing sign...";


    // ==========================
    // Add Video
    // ==========================

    videosContainer.appendChild(
        video
    );


    // ==========================
    // Add Word
    // ==========================

    videosContainer.appendChild(
        wordLabel
    );


    // ==========================
    // Replay Button
    // ==========================

    const replayBtn =
        document.createElement("button");


    replayBtn.id =
        "replaySign";


    replayBtn.innerHTML =
        '<i class="fa-solid fa-rotate-right"></i> Replay Translation';


    // ==========================
    // Replay Button Style
    // ==========================

    replayBtn.style.display =
        "block";

    replayBtn.style.margin =
        "20px auto";

    replayBtn.style.padding =
        "12px 25px";

    replayBtn.style.cursor =
        "pointer";


    // ==========================
    // Replay Button Click
    // ==========================

    replayBtn.addEventListener(
        "click",
        () => {

            console.log(
                "Replay Translation clicked"
            );


            currentVideoIndex = 0;


            wordLabel.innerHTML =
                "Preparing sign...";


            playNextSignVideo(
                video,
                wordLabel
            );

        }
    );


    // ==========================
    // Add Replay Button
    // ==========================

    videosContainer.appendChild(
        replayBtn
    );


    // ==========================
    // Play First Video
    // ==========================

    playNextSignVideo(
        video,
        wordLabel
    );


    // ==========================
    // Video Ended
    // ==========================

    video.addEventListener(
        "ended",
        () => {

            console.log(
                "Finished:",
                signVideoQueue[
                    currentVideoIndex
                ].word
            );


            currentVideoIndex++;


            // ==========================
            // More Videos
            // ==========================

            if (
                currentVideoIndex <
                signVideoQueue.length
            ) {

                playNextSignVideo(
                    video,
                    wordLabel
                );

            }


            // ==========================
            // Translation Completed
            // ==========================

            else {

                wordLabel.innerHTML =
                    "✅ Translation completed.";


                console.log(
                    "All sign videos completed."
                );

            }

        }
    );


    // ==========================
    // Unknown Words
    // ==========================

    if (
        unknownWords &&
        unknownWords.length > 0
    ) {

        const unknown =
            document.createElement("p");


        unknown.innerHTML =
            "⚠️ No sign video for: " +
            unknownWords.join(", ");


        videosContainer.appendChild(
            unknown
        );

    }

}


// ==============================
// Play Next Sign Video
// ==============================

function playNextSignVideo(
    video,
    wordLabel
) {

    const sign =
        signVideoQueue[
            currentVideoIndex
        ];


    if (!sign) {
        return;
    }


    console.log(
        "Playing:",
        sign.word
    );


    // ==========================
    // Display Current Word
    // ==========================

    wordLabel.innerHTML =
        "🤟 " + sign.word;


    // ==========================
    // Set Video
    // ==========================

    video.src =
        sign.video;


    video.load();


    // ==========================
    // Play Video
    // ==========================

    video.play().catch(
        error => {

            console.log(
                "Autoplay was blocked:",
                error
            );

        }
    );

}


// ==============================
// Greeting
// ==============================

const hour =
    new Date().getHours();


const heroTitle =
    document.querySelector(
        ".hero h1"
    );


if (heroTitle) {

    if (hour < 12) {

        heroTitle.innerHTML =
            "Good Morning 👋";

    }

    else if (hour < 18) {

        heroTitle.innerHTML =
            "Good Afternoon 👋";

    }

    else {

        heroTitle.innerHTML =
            "Good Evening 👋";

    }

}


// ==============================
// Card Hover Effect
// ==============================

const cards =
    document.querySelectorAll(
        ".card"
    );


cards.forEach(card => {

    card.addEventListener(
        "mouseenter",
        () => {

            card.style.transform =
                "translateY(-10px)";

        }
    );


    card.addEventListener(
        "mouseleave",
        () => {

            card.style.transform =
                "translateY(0px)";

        }
    );

});


// ==============================
// Page Loaded
// ==============================

window.onload = () => {

    console.log(
        "Speech to Sign Home Loaded Successfully."
    );

};