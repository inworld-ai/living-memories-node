import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';
import {
  GraphBuilder,
  GraphTypes,
  RemoteLLMChatNode,
  RemoteTTSNode,
  RemoteSTTNode,
  TextChunkingNode,
  ProxyNode,
  CustomNode,
  ProcessContext,
} from '@inworld/runtime/graph';
import { renderJinja } from '@inworld/runtime/primitives/llm';
import { stopInworldRuntime } from '@inworld/runtime';

const app = express();
const PORT = process.env.PORT || 3000;

// Check for API key (optional - can be provided via frontend)
const defaultApiKey = process.env.INWORLD_API_KEY;
if (!defaultApiKey) {
  console.warn(
    "INWORLD_API_KEY environment variable is not set. API key will need to be provided via the frontend."
  );
}

// Memory Companion System Prompt Configuration
const DEFAULT_PERSONALITY = "You are a helpful memory companion AI. You have a warm, friendly personality and can remember previous conversations. Provide thoughtful, engaging responses. Keep responses conversational and not too long.";

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit to handle large audio/video payloads
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Session management
interface SessionData {
  id: string;
  memories: string[];
  conversationHistory: Array<{role: string, content: string}>;
  graph?: ReturnType<GraphBuilder['build']>;
  apiKey: string;
  personality: string;
  voiceId?: string;
}

const sessions = new Map<string, SessionData>();

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Session creation endpoint
app.post('/api/session', async (req, res) => {
  try {
    const { apiKey, personality, voiceId } = req.body;
    const effectiveApiKey = apiKey || defaultApiKey;
    
    if (!effectiveApiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    const sessionId = Math.random().toString(36).substring(7);
    const sessionData: SessionData = {
      id: sessionId,
      memories: [],
      conversationHistory: [],
      apiKey: effectiveApiKey,
      personality: personality || DEFAULT_PERSONALITY,
      voiceId: voiceId
    };
    
    sessions.set(sessionId, sessionData);
    res.json({ sessionId });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Helper to build/rebuild graph for a session
function buildGraphForSession(session: SessionData): ReturnType<GraphBuilder['build']> {
  const memorySummary = session.memories.length > 0
    ? `\n\nPrevious memories:\n${session.memories.join('\n')}`
    : '';
  
  const systemPrompt = session.personality + memorySummary;
  
  // Build the graph using GraphBuilder
  const builder = new GraphBuilder();
  
  // Create LLM node
  const llmNode = new RemoteLLMChatNode({
    apiKey: session.apiKey,
    model: 'inworld-tess-2',
    systemPrompt
  });
  
  // Create TTS node if voice ID is provided
  let ttsNode: RemoteTTSNode | null = null;
  if (session.voiceId) {
    ttsNode = new RemoteTTSNode({
      apiKey: session.apiKey,
      speakerId: session.voiceId
    });
  }
  
  // Create STT node
  const sttNode = new RemoteSTTNode({
    apiKey: session.apiKey
  });
  
  // Build the graph
  if (ttsNode) {
    builder
      .addNode('stt', sttNode)
      .addNode('llm', llmNode)
      .addNode('tts', ttsNode)
      .addEdge('stt', 'llm')
      .addEdge('llm', 'tts');
  } else {
    builder
      .addNode('stt', sttNode)
      .addNode('llm', llmNode)
      .addEdge('stt', 'llm');
  }
  
  return builder.build();
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, message, audioData } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Build or get existing graph
    if (!session.graph) {
      session.graph = buildGraphForSession(session);
    }
    
    // Process the message through the graph
    const input = audioData ? { audio: audioData } : { text: message };
    
    // Add to conversation history
    session.conversationHistory.push({
      role: 'user',
      content: message || '[audio input]'
    });
    
    // Process through graph
    const context = new ProcessContext(input);
    const result = await session.graph.process(context);
    
    const responseText = result.text || result.response || 'I understand.';
    const responseAudio = result.audio || null;
    
    // Add to conversation history
    session.conversationHistory.push({
      role: 'assistant',
      content: responseText
    });
    
    res.json({
      response: responseText,
      audio: responseAudio,
      sessionId
    });
    
  } catch (error) {
    console.error('Error processing chat:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Memory management endpoints
app.post('/api/memory', async (req, res) => {
  try {
    const { sessionId, memory } = req.body;
    
    if (!sessionId || !memory) {
      return res.status(400).json({ error: 'Session ID and memory are required' });
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    session.memories.push(memory);
    // Invalidate graph so it gets rebuilt with new memories
    session.graph = undefined;
    
    res.json({ success: true, memoriesCount: session.memories.length });
  } catch (error) {
    console.error('Error adding memory:', error);
    res.status(500).json({ error: 'Failed to add memory' });
  }
});

app.get('/api/memory/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ memories: session.memories });
});

app.delete('/api/memory/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  session.memories = [];
  // Invalidate graph
  session.graph = undefined;
  
  res.json({ success: true });
});

// File upload endpoints
app.post('/api/upload/image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Read the uploaded file
    const imageBuffer = fs.readFileSync(req.file.path);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      imageData: `data:${mimeType};base64,${base64Image}`,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

app.post('/api/upload/video', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video file provided' });
    }
    
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Read the uploaded file and convert to base64
    const videoBuffer = fs.readFileSync(req.file.path);
    const base64Video = videoBuffer.toString('base64');
    const mimeType = req.file.mimetype;
    
    // Clean up the uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ 
      success: true, 
      videoData: `data:${mimeType};base64,${base64Video}`,
      filename: req.file.originalname
    });
  } catch (error) {
    console.error('Error uploading video:', error);
    res.status(500).json({ error: 'Failed to upload video' });
  }
});

// Lipsync endpoint
app.post('/api/lipsync', async (req, res) => {
  try {
    const { sessionId, text, audioData } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    const session = sessions.get(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (!session.voiceId) {
      return res.status(400).json({ error: 'Voice ID is required for lipsync' });
    }
    
    // If we have audio data, use it directly; otherwise generate TTS first
    let audioBuffer: Buffer;
    
    if (audioData) {
      // Convert base64 audio to buffer
      const base64Data = audioData.replace(/^data:audio\/[^;]+;base64,/, '');
      audioBuffer = Buffer.from(base64Data, 'base64');
    } else if (text) {
      // Generate TTS audio
      const ttsResponse = await fetch('https://api.inworld.ai/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.apiKey}`
        },
        body: JSON.stringify({
          text,
          voiceId: session.voiceId
        })
      });
      
      if (!ttsResponse.ok) {
        throw new Error(`TTS request failed: ${ttsResponse.statusText}`);
      }
      
      const ttsData = await ttsResponse.buffer();
      audioBuffer = ttsData;
    } else {
      return res.status(400).json({ error: 'Either text or audioData is required' });
    }
    
    // Generate lipsync data using Inworld API
    const formData = new FormData();
    formData.append('audio', audioBuffer, {
      filename: 'audio.wav',
      contentType: 'audio/wav'
    });
    formData.append('voiceId', session.voiceId);
    
    const lipsyncResponse = await fetch('https://api.inworld.ai/v1/lipsync', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.apiKey}`,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    if (!lipsyncResponse.ok) {
      throw new Error(`Lipsync request failed: ${lipsyncResponse.statusText}`);
    }
    
    const lipsyncData = await lipsyncResponse.json();
    
    res.json({
      success: true,
      lipsync: lipsyncData,
      audio: audioData || `data:audio/wav;base64,${audioBuffer.toString('base64')}`
    });
    
  } catch (error) {
    console.error('Error generating lipsync:', error);
    res.status(500).json({ error: 'Failed to generate lipsync data' });
  }
});

// Conversation history endpoint
app.get('/api/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({ history: session.conversationHistory });
});

// Session cleanup endpoint
app.delete('/api/session/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  // Clean up the graph if it exists
  if (session.graph) {
    try {
      await session.graph.stop();
    } catch (error) {
      console.error('Error stopping graph:', error);
    }
  }
  
  sessions.delete(sessionId);
  res.json({ success: true });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', sessions: sessions.size });
});

// Render Jinja template endpoint (for testing)
app.post('/api/render-template', async (req, res) => {
  try {
    const { template, variables } = req.body;
    
    if (!template) {
      return res.status(400).json({ error: 'Template is required' });
    }
    
    const rendered = await renderJinja(template, variables || {});
    res.json({ rendered });
  } catch (error) {
    console.error('Error rendering template:', error);
    res.status(500).json({ error: 'Failed to render template' });
  }
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
  
  // Stop all active graphs
  const stopPromises: Promise<void>[] = [];
  for (const [sessionId, session] of sessions.entries()) {
    if (session.graph) {
      stopPromises.push(
        session.graph.stop().catch(err => {
          console.error(`Error stopping graph for session ${sessionId}:`, err);
        })
      );
    }
  }
  
  await Promise.all(stopPromises);
  
  // Stop the Inworld runtime
  try {
    await stopInworldRuntime();
    console.log('Inworld runtime stopped.');
  } catch (error) {
    console.error('Error stopping Inworld runtime:', error);
  }
  
  console.log('Graceful shutdown complete.');
  process.exit(0);
}

// Start server
app.listen(PORT, () => {
  console.log(`Memory Companion server running on http://localhost:${PORT}`);
  console.log(`API Key: ${defaultApiKey ? 'configured' : 'not set (will need to be provided via frontend)'}`);
});

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
