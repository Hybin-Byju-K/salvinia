# The Toxic Validation Loop

A client/server web app hackathon project that simulates a "toxic, dramatically jealous AI girlfriend". The browser client tracks your facial expressions in real-time and streams your state over WebSockets to a Node/Express server. The server prompts a local LLM (Ollama) to generate dynamically escalating, jealous responses and streams text and TTS audio back to your browser.

## Features

- **Real-Time Face & Expression Tracking:** Uses `face-api.js` directly in the browser to detect if you are looking at the screen and if you are smiling.
- **Dynamic Trust Meter:** A visible HUD bar that slowly drains when you stop smiling or look away, and quickly recovers when you smile.
- **Escalating Guilt Tiers:** The longer you go without smiling or looking at the camera, the more jealous and toxic the AI's responses become.
- **Guilt Receipts & Evidence:** Logs timestamps whenever you look away, and captures screenshots of your face to use as "evidence" against you.
- **Hostage Lockout & Make-up Tasks:** If trust hits zero, the UI locks down with an ultimatum overlay. You must type a randomly generated apology phrase (e.g., *"you're the only one"*) 3 times to be forgiven.
- **Beforeunload Panic:** If you try to close the tab, she throws a dramatic native browser confirm dialog.
- **Seamless Local TTS:** Audio is generated dynamically via Google TTS and proxied through the Express server to bypass browser CORS policies.

## Tech Stack

- **Frontend:** Vanilla HTML / CSS / JS, WebSockets
- **Computer Vision:** `face-api.js`
- **Backend:** Node.js, Express, `ws` (WebSockets)
- **Local AI:** Ollama (`llama3.2:3b` or similar)
- **Audio:** `google-tts-api`

## Getting Started

1. **Start Ollama**
   Make sure you have [Ollama](https://ollama.ai/) installed and running a local model:
   ```bash
   ollama run llama3.2:3b
   ```

2. **Install Dependencies**
   ```bash
   npm install express ws google-tts-api
   ```

3. **Run the Server**
   ```bash
   node server.js
   ```

4. **Open the Client**
   Navigate to `http://localhost:8080` in your web browser. 
   *(Note: You must click anywhere on the page once to allow the browser's autoplay policies to play the audio).*

## Disclaimer
This project is a humorous hackathon experiment meant to demonstrate live webcam interactions, real-time WebSocket communication, and prompt engineering with local LLMs. It is not meant to be taken seriously!
