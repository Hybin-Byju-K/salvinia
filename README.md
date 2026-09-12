<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />



# LOVE//LOOP 🎯


## Basic Details
### Team Name: Salvinia


### Team Members
- Team Lead: Hybin Byju K - Sahrdaya College of Engineering and Technology
- Member 2: Joseph T Jenny - Sahrdaya College of Engineering and Technology

### Project Description
A satirical anti-UX web app that watches you through your webcam and reacts like a co-dependent AI girlfriend — showering you with hyper-specific compliments while you smile, and spiraling into jealousy and guilt-tripping the instant you look away. The only way out of a sulking episode is typing a sincere apology and hoping she believes you.

### The Problem (that doesn't exist)
Every app on your phone is desperate to be pleasant, respectful of your time, and easy to walk away from. Nobody asked for that.

### The Solution (that nobody asked for)
We built an AI companion that tracks your smile in real time, guilt-trips you the moment your attention wavers, and locks the entire app hostage until you grovel — with your apology graded for sincerity and, for extra flavor, some of her responses delivered in Malayalam.

## Technical Details
### Technologies/Components Used
For Software:
- JavaScript (Node.js + browser)
- Express, WebSocket (ws)
- face-api.js (real-time smile/expression detection)
- Ollama running Llama 3.2 3B (local LLM)
- google-translate-api-x, google-tts-api (Malayalam translation & voice)

For Hardware:
- Two laptops (client + server), networked together over Tailscale
- Webcam (on the client laptop)

### Implementation
For Software:
# Installation
```
npm install
```

# Run
```
node server.js
```
Then open the app in a browser at the server's address on port 8080 (e.g. `http://<server-tailscale-ip>:8080`).

### Project Documentation
For Software:

# Screenshots (Add at least 3)
![Live HUD](./assets/screenshot-live-hud.png)
*The live view: webcam feed, trust meter, forgiveness counter, and a running log of moments she noticed you looking away.*

![Ultimatum screen](./assets/screenshot-ultimatum.png)
*What happens when you stop smiling for too long — the app locks up and demands a typed apology before it will reset.*

![Screenshot3](Add screenshot 3 here with proper name)
*Add caption explaining what this shows*

# Diagrams
![Workflow](./assets/diagram-architecture.svg)
*Client laptop runs the webcam and face-api.js detection in the browser; server laptop runs the WebSocket server, prompts a local Ollama model, translates the reply to Malayalam, and streams text + audio back — the two communicate over Tailscale.*

![The Loop](./assets/diagram-loop.svg)
*The state cycle behind the name: LOVING while you smile, OFFENDED the moment you stop, LOCKED after three checks with no smile (or looking away), and an apology judged for sincerity before it lets you back into LOVING — or sends you straight back to LOCKED.*

For Hardware:

# Schematic & Circuit
![Circuit](Add your circuit diagram here)
*Add caption explaining connections*

![Schematic](Add your schematic diagram here)
*Add caption explaining the schematic*

# Build Photos
![Components](Add photo of your components here)
*List out all components shown*

![Build](Add photos of build process here)
*Explain the build steps*

![Final](Add photo of final product here)
*Explain the final build*

### Project Demo
# Video
[Add your demo video link here]
*Explain what the video demonstrates*

# Additional Demos
[Add any extra demo materials/links]

## Team Contributions
- Hybin Byju K: Server-side logic — WebSocket server, local LLM (Ollama) integration and prompting, Malayalam translation/TTS pipeline, Tailscale networking between the two laptops.
- Joseph T Jenny: Client-side experience — webcam capture, face-api.js smile/expression detection, front-end UI (trust meter, ultimatum overlay, live response display).

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)
