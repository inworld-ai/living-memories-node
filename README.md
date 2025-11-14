# Living Memories_Node Template

Create talking-photo experiences powered by Inworld's Voice Clone, Inworld TTS, and the Inworld Node.js Runtime, combined with video generation from Runway.

## Prerequisites
- Node.js >= 18.x
- [Inworld AI API Key](https://studio.inworld.ai/)
- [Voice Clone & VoiceId](https://platform.inworld.ai/) -> TTS
- [Runway ML Account email](https://runwayml.com/) (for LipSync Generation)
- [UseAPI Token](https://useapi.net/) (for LipSync Generation)
- [UseAPI & Lipsync setup](https://useapi.net/docs/start-here/setup-runwayml) (For LipSync Generation)
- [Runway ML API Key](https://docs.dev.runwayml.com/guides/using-the-api/) (for Memory Companion)


## Installation & Setup

```bash
# 1. Install dependencies
npm install

# 2. Start server
npm run dev
```

## Access Application

Open browser: **http://localhost:3000**

You'll be redirected to the LipSync page.

## Features

### LipSync Generation (`/lipsync`)
1. Enter your Inworld API Key + UseAPI Token
2. Upload an image
3. Enter text to speak
4. Generate TTS audio
5. Create lip-sync video

### Memory Companion (`/memory`)
1. Enter your Inworld API Key + Runway API Key
2. Upload an image and optional add a text prompt
3. Generate animation
4. Press & hold to record voice
5. Chat with AI using voice


## Troubleshooting

**Problem**: API validation fails\
**Solution**: Double-check your API key

**Problem**: Video generation takes too long\
**Solution**: This is normal - Memory video generation usually takes 15-45s，Lip sync video generation usually takes 1min ~ 2.5min. 

**Problem**: Voice recording doesn't work\
**Solution**: Grant microphone permissions

