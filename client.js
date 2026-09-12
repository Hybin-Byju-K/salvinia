const video = document.getElementById('webcam');
const aiResponseDiv = document.getElementById('ai-response');
const ultimatumOverlay = document.getElementById('ultimatum-overlay');
const ultimatumInput = document.getElementById('ultimatum-input');
const trustBarFill = document.getElementById('trust-bar-fill');
const trustPct = document.getElementById('trust-pct');
const guiltLog = document.getElementById('guilt-log');
const forgivenCount = document.getElementById('forgiven-count');

let timesForgivenTotal = 0;
let gazeAwayTimestamps = []; // kept for relative time display

let ws;
let nonSmilingCount = 0;
let isOverlayActive = false;
let isMakeUpTaskActive = false;
let currentMakeUpTask = "";
let makeUpTaskRequiredCount = 0;
let makeUpTaskCurrentCount = 0;
const MAKE_UP_TASKS = [
    "you're the only one",
    "i am nothing without you",
    "please forgive me",
    "you are my whole world"
];
let textBuffer = "";
let displayQueue = [];
let isTyping = false;
let trustLevel = 1.0; // 0.0 – 1.0, starts full
let currentAudio = null; // Track current audio to prevent overlaps

// Ensure voices are loaded
window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();

function updateTrustMeter(targetScore) {
    // Asymmetric lerp — drains slow, recovers fast
    const lerpFactor = targetScore > trustLevel ? 0.2 : 0.08;
    trustLevel += (targetScore - trustLevel) * lerpFactor;
    trustLevel = Math.max(0, Math.min(1, trustLevel));

    const pct = Math.round(trustLevel * 100);
    trustBarFill.style.width = pct + '%';
    trustPct.textContent = pct + '%';

    // Colour shifts: green when happy, red when draining
    if (trustLevel > 0.6) {
        trustBarFill.style.background = 'linear-gradient(90deg, #ff4d4d, #ff884d)';
        trustBarFill.style.boxShadow = '0 0 10px #ff4d4d88';
    } else if (trustLevel > 0.3) {
        trustBarFill.style.background = 'linear-gradient(90deg, #cc0000, #ff4d4d)';
        trustBarFill.style.boxShadow = '0 0 14px #cc000099';
    } else {
        trustBarFill.style.background = 'linear-gradient(90deg, #660000, #cc0000)';
        trustBarFill.style.boxShadow = '0 0 18px #660000cc';
    }
}

let lastGuiltAt = 0;
function addGuiltReceipt() {
    const now = Date.now();
    // Debounce: don't log more than once every 2s to avoid flooding
    if (now - lastGuiltAt < 2000) return;
    lastGuiltAt = now;

    gazeAwayTimestamps.push(now);
    if (gazeAwayTimestamps.length > 50) gazeAwayTimestamps.shift();

    const item = document.createElement('div');
    item.className = 'guilt-item';
    item.dataset.ts = now;
    item.textContent = `👁 Noticed you looking away — just now`;
    guiltLog.prepend(item);

    // Keep max 8 entries
    while (guiltLog.children.length > 8) {
        guiltLog.removeChild(guiltLog.lastChild);
    }
}

// Tick relative timestamps every 5s
setInterval(() => {
    document.querySelectorAll('.guilt-item').forEach(el => {
        const ago = Math.round((Date.now() - parseInt(el.dataset.ts)) / 1000);
        if (ago < 60) el.textContent = `👁 Noticed you looking away — ${ago}s ago`;
        else el.textContent = `👁 Noticed you looking away — ${Math.round(ago/60)}m ago`;
    });
}, 5000);

// Screenshot evidence capture
let evidenceCaptured = false;
const evidenceCanvas = document.createElement('canvas');
const evidenceCtx = evidenceCanvas.getContext('2d');

function captureEvidence() {
    if (evidenceCaptured) return; // Only capture once per streak
    evidenceCaptured = true;

    evidenceCanvas.width = video.videoWidth || 640;
    evidenceCanvas.height = video.videoHeight || 480;
    evidenceCtx.drawImage(video, 0, 0, evidenceCanvas.width, evidenceCanvas.height);

    // Show the evidence thumbnail in the UI
    const existingEvidence = document.getElementById('evidence-panel');
    if (existingEvidence) existingEvidence.remove();

    const panel = document.createElement('div');
    panel.id = 'evidence-panel';

    const label = document.createElement('div');
    label.id = 'evidence-label';
    label.textContent = '🔍 EXHIBIT A';

    const img = document.createElement('img');
    img.src = evidenceCanvas.toDataURL('image/jpeg', 0.6);
    img.id = 'evidence-img';

    const caption = document.createElement('div');
    caption.id = 'evidence-caption';
    caption.textContent = `Captured: ${new Date().toLocaleTimeString()}`;

    panel.appendChild(label);
    panel.appendChild(img);
    panel.appendChild(caption);
    document.body.appendChild(panel);
}

// Initialize WebSocket
function initWebSocket() {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        aiResponseDiv.innerHTML += '\n[Connected]';
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.text) {
                let incomingText = data.text;
                
                if (incomingText.includes('[FORGIVEN]')) {
                    timesForgivenTotal++;
                    forgivenCount.textContent = timesForgivenTotal;
                    
                    isMakeUpTaskActive = true;
                    currentMakeUpTask = MAKE_UP_TASKS[Math.floor(Math.random() * MAKE_UP_TASKS.length)];
                    makeUpTaskRequiredCount = 3;
                    makeUpTaskCurrentCount = 0;
                    
                    document.getElementById('ultimatum-title').textContent = "Okay fine. I forgive you. BUT FIRST...";
                    document.getElementById('ultimatum-desc').textContent = `Type "${currentMakeUpTask}" 3 times to prove it. (0/3)`;
                    ultimatumInput.value = '';
                    ultimatumInput.placeholder = `Type: ${currentMakeUpTask}`;
                    
                    incomingText = incomingText.replace('[FORGIVEN]', '');
                } else if (incomingText.includes('[REJECTED]')) {
                    ultimatumInput.value = '';
                    incomingText = incomingText.replace('[REJECTED]', '');
                }

                if (incomingText.trim().length > 0) {
                    if (data.audioUrl) {
                        // Stop any currently playing audio first
                        if (currentAudio) {
                            currentAudio.pause();
                            currentAudio.currentTime = 0;
                        }
                        currentAudio = new Audio(data.audioUrl);
                        currentAudio.play().catch(e => console.error("Audio playback error:", e));
                    }
                    queueTextForDisplay(incomingText.trim() + "\n\n");
                }
            }
        } catch (e) {
            console.error(e);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error);
    };
    
    ws.onclose = () => {
        setTimeout(initWebSocket, 2000);
    };
}

function queueTextForDisplay(text) {
    for (let char of text) {
        displayQueue.push(char);
    }
    if (!isTyping) {
        aiResponseDiv.innerHTML += "\n";
        typeText();
    }
}

function typeText() {
    if (displayQueue.length === 0) {
        isTyping = false;
        return;
    }
    isTyping = true;
    aiResponseDiv.innerHTML += displayQueue.shift();
    aiResponseDiv.scrollTop = aiResponseDiv.scrollHeight;
    setTimeout(typeText, 35);
}

// Start webcam
async function startVideo() {
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Camera API is not available. Please ensure you are using HTTPS or localhost.");
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (err) {
        console.error("Error accessing webcam: ", err);
        aiResponseDiv.innerHTML = `\n[Camera Error: ${err.message}]\nCannot see you. Are you on localhost/HTTPS, or did you deny access?`;
    }
}

// Load face-api models and start detection loop
Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models')
]).then(() => {
    startVideo();
    initWebSocket();
}).catch((err) => {
    console.error("Error loading face-api models:", err);
    aiResponseDiv.innerHTML = `\n[Model Loading Error: ${err.message}]\nFailed to load AI face models.`;
});

let detectionInterval;
video.addEventListener('play', () => {
    if (detectionInterval) clearInterval(detectionInterval);
    detectionInterval = setInterval(async () => {
        if (isOverlayActive) return; // Pause detection while overlay is active

        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceExpressions();
        
        if (detections.length > 0) {
            const happyScore = detections[0].expressions.happy;
            
            // Update trust meter with live happy score
            updateTrustMeter(happyScore);

            const streakJustStarted = happyScore < 0.3 && nonSmilingCount === 0;

            // Toxic Loop Logic
            if (happyScore < 0.3) {
                if (nonSmilingCount === 0) {
                    captureEvidence(); // Snap the moment the streak begins
                }
                nonSmilingCount++;
            } else {
                nonSmilingCount = 0;
                evidenceCaptured = false; // Reset for next streak
                const ep = document.getElementById('evidence-panel');
                if (ep) ep.remove();
            }

            // Determine escalating tier
            let guiltTier = 0;
            if (nonSmilingCount >= 6) {
                guiltTier = 3; // Hostage lockout
                video.style.filter = "sepia(100%) hue-rotate(300deg) saturate(300%)"; // Deep red/toxic
            } else if (nonSmilingCount >= 3) {
                guiltTier = 2; // Full jealousy
                video.style.filter = "sepia(80%) hue-rotate(320deg) saturate(200%)";
            } else if (nonSmilingCount >= 1) {
                guiltTier = 1; // Mild pout
                video.style.filter = "sepia(40%) hue-rotate(340deg)";
            } else {
                video.style.filter = "none";
            }

            // Send score and tier to server
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ 
                    smileScore: happyScore, 
                    evidenceJustCaptured: streakJustStarted,
                    guiltTier: guiltTier
                }));
            }

            if (nonSmilingCount >= 6) {
                triggerUltimatum();
            }
        } else {
            // Gaze tracking: No face detected — drain trust hard
            updateTrustMeter(0);
            addGuiltReceipt();
            const nowTime = Date.now();
            if (nowTime - (window.lastGazeSent || 0) > 3000 && ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ gazeAway: true }));
                window.lastGazeSent = nowTime;
            }
            
            nonSmilingCount++;
            if (nonSmilingCount >= 6) {
                triggerUltimatum();
            }
        }
    }, 1000);
});

function triggerUltimatum() {
    isOverlayActive = true;
    ultimatumOverlay.style.display = 'flex';
    ultimatumInput.value = '';
    ultimatumInput.focus();
}

ultimatumInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const text = e.target.value.trim();
        if (!text) return;

        if (isMakeUpTaskActive) {
            if (text.toLowerCase() === currentMakeUpTask) {
                makeUpTaskCurrentCount++;
                if (makeUpTaskCurrentCount >= makeUpTaskRequiredCount) {
                    isMakeUpTaskActive = false;
                    ultimatumOverlay.style.display = 'none';
                    isOverlayActive = false;
                    nonSmilingCount = 0;
                    evidenceCaptured = false;
                    const ep = document.getElementById('evidence-panel');
                    if (ep) ep.remove();
                    ultimatumInput.value = '';
                    document.getElementById('ultimatum-title').textContent = "YOU STOPPED SMILING. DO YOU HATE ME?";
                    document.getElementById('ultimatum-desc').textContent = "Type your apology and press Enter.";
                    ultimatumInput.placeholder = "Beg properly...";
                } else {
                    document.getElementById('ultimatum-desc').textContent = `Type "${currentMakeUpTask}" 3 times to prove it. (${makeUpTaskCurrentCount}/3)`;
                    ultimatumInput.value = '';
                }
            } else {
                document.getElementById('ultimatum-desc').textContent = `WRONG. Type "${currentMakeUpTask}" 3 times to prove it. (${makeUpTaskCurrentCount}/3) - START OVER!`;
                makeUpTaskCurrentCount = 0;
                ultimatumInput.value = '';
            }
        } else {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ apology: text }));
                e.target.value = 'Evaluating sincerity...';
            }
        }
    }
});

// Panic dialog — fires when the user tries to close or navigate away
const panicMessages = [
    "Don't you dare leave me mid-sentence.",
    "Close this tab and I'm deleting everything. EVERYTHING.",
    "You were literally just looking at another girl and now you're leaving?",
    "I saw you reach for that X button. I saw it.",
    "Fine. Leave. I'll just sit here. Alone. Like always.",
];

window.addEventListener('beforeunload', (e) => {
    const msg = panicMessages[Math.floor(Math.random() * panicMessages.length)];
    e.preventDefault();
    e.returnValue = msg; // Triggers the native browser "Leave site?" dialog
    return msg;
});
