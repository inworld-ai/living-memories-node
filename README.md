# Living Memories

Create talking-photo experiences powered by Inworld's Voice Clone, TTS, and Node.js Runtime, combined with video generation from Runway ML. This template demonstrates two key features: an interactive Memory Companion and LipSync video generation.

[![Watch the video](https://img.youtube.com/vi/FLKn-U0TEjw/maxresdefault.jpg)](https://youtu.be/FLKn-U0TEjw)

## Prerequisites

- Node.js (v18 or higher)
- npm
- [Inworld AI API Key](https://platform.inworld.ai/)
- [Voice Clone & Get VoiceId](https://platform.inworld.ai/)
- [Runway ML Account email](https://runwayml.com/) (for LipSync Generation)
- [UseAPI Token](https://useapi.net/) (for LipSync Generation)
- [UseAPI & LipSync setup](https://useapi.net/docs/start-here/setup-runwayml) (for LipSync Generation)
- [Runway ML API Key](https://docs.dev.runwayml.com/guides/using-the-api/) (for Memory Companion)

## Get Started

### Step 1: Clone the Repository

```bash
git clone https://github.com/inworld-ai/living-memories-node.git
cd living-memories-node
```

### Step 2: Install Dependencies

```bash
npm install
```

> **Note**: This project uses `@inworld/runtime` v0.8.0. Make sure to run `npm install` to get the correct version.

### Step 3: Configure Environment Variables

Duplicate `env.example` to `.env` in the root directory.

Get your API key from the [Inworld Portal](https://platform.inworld.ai/).

### Step 4: Run the Application

```bash
npm run dev
```

### Step 5: Access the Application

Open your browser and navigate to: **http://localhost:3000**

You'll be automatically redirected to the Memory Companion page.

## Repo Structure

```
Living-Memories_Node/
├── src/              # Source code
│   ├── server.ts     # Express server with Inworld Runtime integration
│   └── tsconfig.json # TypeScript configuration
├── public/           # Static assets (HTML, CSS, JavaScript)
│   ├── lipsync.html  # LipSync generation interface
│   ├── lipsync.js    # LipSync client logic
│   ├── memory.html   # Memory Companion interface
│   ├── memory.js     # Memory Companion client logic
│   └── style.css     # Shared styles
├── uploads/          # User-uploaded images
├── README.md         # Documentation
├── package.json      # Dependencies
└── LICENSE           # MIT License
```

## Features

### 1. Memory Companion (`/memory`)

1. Enter your **Inworld API Key**, **Voice ID**, and **Runway API Key**
2. Enter your **Companion Configuration**
3. Upload an image you want to use to generate the video
4. (Optional) Add a text prompt to guide the animation
5. Generate an animated video from the image
6. Press and hold the button in the Step 3 area to record your voice
7. Chat with your companion using natural voice conversations

### 2. LipSync Generation (`/lipsync`)

1. Enter your **Inworld API Key**, **Voice ID**, **UseAPI Token**, and **Runway Email** that is linked with your UseAPI account
2. Upload a portrait image
3. Enter text for the character to speak
4. Generate TTS audio using Inworld's voice synthesis. Play it before generating the video to make sure that is the audio you want.
5. Generate a lip-synced video

## Troubleshooting

**Bug Reports**: [GitHub Issues](https://github.com/inworld/inworld-template/issues)

**General Questions**: For general inquiries and support, please email us at support@inworld.ai

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to contribute to this project.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
