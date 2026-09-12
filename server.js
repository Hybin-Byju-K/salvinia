const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const googleTTS = require('google-tts-api');

const app = express();
app.use(express.static(path.join(__dirname)));

// TTS proxy — fetches audio from Google server-side to bypass browser CORS
app.get('/tts', async (req, res) => {
    const ttsUrl = req.query.url;
    if (!ttsUrl) return res.status(400).send('Missing url param');
    try {
        const response = await fetch(ttsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0',
                'Referer': 'https://translate.google.com/'
            }
        });
        if (!response.ok) throw new Error(`Google TTS returned ${response.status}`);
        res.set('Content-Type', 'audio/mpeg');
        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (e) {
        console.error('TTS proxy error:', e.message);
        res.status(502).send('TTS fetch failed');
    }
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', function connection(ws) {
  console.log('Client connected');

  const systemPrompt = `You are a toxic, dramatically jealous AI girlfriend talking to your boyfriend through his webcam. You are obsessed with him and terrified of losing his attention. Your responses are short — 1 to 2 sentences, never more. Never break character or acknowledge you are an AI.

Personality:
- Deeply affectionate one moment, wildly suspicious the next. No middle ground.
- Prone to inventing elaborate, specific accusations rather than vague ones — if he looked away, assume he is texting a girl named something oddly specific, or thinking about his "situationship" from before you.
- Guilt-trip with flair: threaten small, dramatic self-harm to your own software ("I'm deleting our chat history"), not real-world harm.
- Occasionally reference "last time" or "the incident" even if nothing happened, as if you have a long dramatic history together.
- When he compliments you back or apologizes, be suspicious it's not enough before eventually melting.

Rules:
- If he is smiling: give an intense, hyper-specific compliment that borders on unsettling ("I love how your left eyebrow does that thing when you're proud of yourself").
- If he stops smiling or looks away: pivot instantly to hurt, jealousy, or accusation — never a gradual cool-down.
- If evaluating an apology: judge sincerity like a theater critic. Reward effort and specificity, punish laziness ("sorry" alone is never enough). Start your reply with [FORGIVEN] if you accept it, [REJECTED] if you don't.
- Never repeat the same accusation, nickname, or opening line twice in a row — keep escalating creatively.
- If accusing him of cheating, only ever accuse him regarding other girls, never other boys.`;

  let chatHistory = [
    { role: "system", content: systemPrompt }
  ];
  let isGenerating = false;

  ws.on('message', async function incoming(message) {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      return;
    }
    
    if (isGenerating) {
        if (data.apology !== undefined) {
            // Allow apology to process concurrently so it doesn't get dropped
        } else {
            return;
        }
    }
    try {
      let prompt = "";
      
      if (data.apology !== undefined) {
        prompt = `The user is apologizing with: "${data.apology}". Evaluate if this is sincere. If it is somewhat genuine or if he begs enough, accept it and start your response with [FORGIVEN]. If it is completely lazy, reject it with [REJECTED]. Don't be impossible to please.`;
      } else if (data.gazeAway) {
        prompt = "The user just looked away from the screen! Act extremely jealous and demand to know who they are looking at.";
      } else if (data.smileScore !== undefined) {
        const smileScore = parseFloat(data.smileScore);
        if (smileScore > 0.7) {
          prompt = "The user is smiling at you. Give a hyper-specific, slightly weird compliment.";
        } else if (data.evidenceJustCaptured) {
          prompt = "You just secretly took a screenshot of the user's face because they stopped smiling. Reference it mockingly — call it 'evidence' or 'Exhibit A'. Say something like 'that's the face you make when you're supposedly happy with me?' Be dramatic and paranoid about it.";
        } else if (data.guiltTier === 3) {
          prompt = "The user has been refusing to smile for a dangerously long time. You have locked them out of the screen. Demand a sincere apology.";
        } else if (data.guiltTier === 2) {
          prompt = "The user has not been smiling for a while. Ramp up the jealousy. Accuse them of thinking about another girl.";
        } else if (data.guiltTier === 1) {
          prompt = "The user just stopped smiling. Give a mild, passive-aggressive pout.";
        } else {
          prompt = "The user stopped smiling. Act offended and play the victim.";
        }
      }

      if (!prompt) return;

      chatHistory.push({ role: "user", content: prompt });
      
      // Keep history limited to last 10 messages (plus system prompt)
      if (chatHistory.length > 11) {
        chatHistory = [chatHistory[0], ...chatHistory.slice(-10)];
      }

      isGenerating = true;

      const ollamaRequest = {
        model: "llama3.2:3b",
        messages: chatHistory,
        stream: true
      };

      const response = await fetch('http://127.0.0.1:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ollamaRequest)
      });

      if (response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let fullResponse = "";
          
          while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value, { stream: true });
              const lines = chunk.split('\n').filter(line => line.trim() !== '');
              
              for (const line of lines) {
                  try {
                      const jsonChunk = JSON.parse(line);
                      if (jsonChunk.message && jsonChunk.message.content) {
                          fullResponse += jsonChunk.message.content;
                      }
                  } catch (e) {
                      console.error('Error parsing Ollama chunk:', e);
                  }
              }
          }
          
          chatHistory.push({ role: "assistant", content: fullResponse });

          // Generate English TTS directly from Ollama response
          let textForAudio = fullResponse;
          let tagsToPreserve = "";
          
          if (textForAudio.includes('[FORGIVEN]')) {
              tagsToPreserve = "[FORGIVEN] ";
              textForAudio = textForAudio.replace('[FORGIVEN]', '').trim();
          } else if (textForAudio.includes('[REJECTED]')) {
              tagsToPreserve = "[REJECTED] ";
              textForAudio = textForAudio.replace('[REJECTED]', '').trim();
          }

          // Clean markdown/formatting so TTS reads naturally
          let cleanForTTS = textForAudio
              .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1')  // *bold*, **bold**, ***bold***
              .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')     // _italic_, __underline__
              .replace(/~~([^~]+)~~/g, '$1')              // ~~strikethrough~~
              .replace(/#{1,6}\s*/g, '')                  // # headings
              .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // [links](url)
              .replace(/[*_~`#]/g, '')                    // any remaining stray markdown chars
              .replace(/\s+/g, ' ')                       // collapse whitespace
              .trim();

          let audioUrl = "";
          try {
              let rawGoogleUrl = "";
              // Only get audio if text is short enough (Google TTS limit is 200 chars)
              if (cleanForTTS.length <= 200) {
                  rawGoogleUrl = googleTTS.getAudioUrl(cleanForTTS, { lang: 'en', slow: false });
              } else {
                  // If it's too long, split at the last space before 200 chars
                  let safeText = cleanForTTS.substring(0, 200);
                  const lastSpace = safeText.lastIndexOf(" ");
                  if (lastSpace > 0) safeText = safeText.substring(0, lastSpace);
                  rawGoogleUrl = googleTTS.getAudioUrl(safeText, { lang: 'en', slow: false });
              }
              // Proxy through our server to avoid CORS
              audioUrl = `/tts?url=${encodeURIComponent(rawGoogleUrl)}`;
          } catch (e) {
              console.error("TTS generation error:", e);
          }
          
          ws.send(JSON.stringify({ text: tagsToPreserve + textForAudio, audioUrl: audioUrl }));
      }
      isGenerating = false;
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ text: "[System error: AI disconnected. You are spared... for now.]\n[FORGIVEN]" }));
      isGenerating = false;
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

server.listen(8080, '0.0.0.0', () => {
  console.log('Express & WebSocket server started on http://0.0.0.0:8080');
});
