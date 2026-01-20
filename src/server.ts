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
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// TTS Prompt Template
const ttsPrompt = `## Task
You are a text-to-speech narrator. Convert the user's input text into a natural, engaging spoken format.

## Input Text
{{ userText }}

## Instructions
- Make the text sound natural when spoken
- Add appropriate pauses and emphasis
- Keep the same meaning but optimize for audio delivery
- Return ONLY the optimized text for speech synthesis

## Response
Return the text optimized for TTS:`;

// Create TTS processing node
class TTSProcessingNode extends CustomNode {
  async process(
    _context: ProcessContext,
    input: { text: string }
  ): Promise<GraphTypes.LLMChatRequest> {
    const renderedPrompt = await renderJinja(ttsPrompt, {
      userText: input.text,
    });
    
    return new GraphTypes.LLMChatRequest({
      messages: [
        {
          role: "system",
          content: renderedPrompt,
        },
      ],
    });
  }
}

// Function to create Inworld TTS graph with dynamic API key and voice ID
function createTTSGraph(apiKey: string, voiceId?: string) {
  // Generate unique IDs for each graph instance
  const timestamp = Date.now();
  const nodeId = `tts_node_${timestamp}`;
  const graphId = `tts_webapp_${timestamp}`;
  
  console.log(`Creating TTS node with speakerId: "${voiceId || 'default'}"`);
  
  const ttsNode = new RemoteTTSNode({
    id: nodeId,
    speakerId: voiceId || 'default', // Use user's voice ID or default
    modelId: 'inworld-tts-1.5-max', // Default TTS model
    sampleRate: 22050,
    temperature: 0.8,
    speakingRate: 1.0,
  });

  const graph = new GraphBuilder({ 
    id: graphId, 
    apiKey,
    enableRemoteConfig: false 
  })
    .addNode(ttsNode)
    .setStartNode(ttsNode)
    .setEndNode(ttsNode)
    .build();
    
  console.log(`Created TTS graph with ID: ${graphId}`);
  return graph;
}

// Routes
app.get('/', (req, res) => {
  res.redirect('/memory');
});

app.get('/lipsync', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'lipsync.html'));
});

app.get('/memory', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'memory.html'));
});

// Image upload endpoint
app.post('/upload-image', upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded' });
    }
    
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ 
      success: true, 
      imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname 
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Serve uploaded images
app.use('/uploads', express.static(uploadsDir));

// TTS processing endpoint
app.post('/process-tts', async (req, res) => {
  let ttsGraph = null;
  
  try {
    const { text, apiKey, voiceId } = req.body;
    
    console.log(`TTS Request - Text: "${text}", VoiceId: "${voiceId || 'default'}"`);
    
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text input is required' });
    }

    // Use provided API key or fall back to default
    const activeApiKey = apiKey || defaultApiKey;
    if (!activeApiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Create TTS graph with the provided API key and voice ID
    console.log('Creating TTS graph...');
    ttsGraph = createTTSGraph(activeApiKey, voiceId);
    
    console.log('Starting TTS generation...');
    const { outputStream } = await ttsGraph.start(text);
    
    let initialText = '';
    let resultCount = 0;
    let allAudioData: number[] = [];
    
    console.log('Processing TTS stream...');
    for await (const result of outputStream) {
      await result.processResponse({
        TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
          console.log('Received TTSOutputStream');
          for await (const chunk of ttsStream) {
            if (chunk.text) {
              initialText += chunk.text;
              console.log(`Text chunk: "${chunk.text}"`);
            }
            if (chunk.audio?.data) {
              // v0.8: audio data is base64-encoded, need to decode
              const decodedData = Buffer.from(chunk.audio.data as any, 'base64');
              const float32Array = new Float32Array(decodedData.buffer, decodedData.byteOffset, decodedData.byteLength / 4);
              const audioChunk = Array.from(float32Array);
              allAudioData = allAudioData.concat(audioChunk);
              console.log(`Audio chunk received: ${audioChunk.length} samples`);
            }
            resultCount++;
          }
        },
        default: (data: any) => {
          console.error('Unprocessed TTS response:', data);
        },
      });
    }

    console.log(`TTS processing complete - Text: "${initialText}", Audio samples: ${allAudioData.length}, Results: ${resultCount}`);

    // Check if we got audio data
    if (allAudioData.length === 0) {
      throw new Error('No audio data generated from TTS');
    }

    // Convert audio data to base64 for transmission
    const audioBuffer = new Float32Array(allAudioData);
    const audioBase64 = Buffer.from(audioBuffer.buffer).toString('base64');

    res.json({ 
      success: true, 
      originalText: text,
      processedText: initialText || text,
      audioData: audioBase64,
      sampleRate: 22050,
      voiceId: voiceId || 'default',
      resultCount,
      audioSamples: allAudioData.length
    });
    
  } catch (error) {
    console.error('TTS processing error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to process TTS',
      details: error instanceof Error ? error.stack : 'Unknown error'
    });
  } finally {
    // Graph cleanup is handled by stopInworldRuntime() on shutdown
  }
});

// LipSync generation endpoint using useapi Runway
app.post('/generate-lipsync', async (req, res) => {
  try {
    const { imageUrl, audioData, sampleRate, voiceId, useapiToken, runwayEmail } = req.body;
    
    console.log('LipSync generation request:', {
      imageUrl,
      audioDataSize: audioData ? audioData.length : 0,
      sampleRate,
      voiceId,
      useapiToken: useapiToken ? 'Provided' : 'Missing',
      runwayEmail: runwayEmail || 'Not provided'
    });

    if (!useapiToken) {
      return res.status(400).json({ error: 'UseAPI token is required' });
    }

    // Convert base64 audio data to WAV buffer
    const audioBuffer = convertBase64ToWav(audioData, sampleRate);
    
    // Get image buffer from uploaded file
    const imageBuffer = await getImageBuffer(imageUrl);
    
    // Step 1: Upload image asset
    console.log('📸 Uploading image asset...');
    const imageInfo = getImageInfo(imageUrl);
    const imageAssetId = await uploadAssetToUseapi(imageBuffer, imageInfo.contentType, imageInfo.fileName, useapiToken, runwayEmail);
    
    // Step 2: Upload audio asset
    console.log('🎵 Uploading audio asset...');
    const audioAssetId = await uploadAssetToUseapi(audioBuffer, 'audio/wav', `lipsync_audio_${Date.now()}.wav`, useapiToken, runwayEmail);
    
    // Step 3: Create lipsync task
    console.log('🎬 Creating lipsync task...');
    const taskId = await createLipsyncTask(imageAssetId, audioAssetId, useapiToken);
    
    // Step 4: Poll for result
    console.log('⏳ Polling for video generation result...');
    const videoUrl = await pollForVideoResult(taskId, useapiToken);
    
    res.json({
      success: true,
      videoUrl: videoUrl,
      taskId: taskId,
      message: 'LipSync video generated successfully'
    });
    
  } catch (error) {
    console.error('LipSync generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate LipSync video'
    });
  }
});

// Memory Companion - Animation generation endpoint using Runway Image-to-Video
app.post('/generate-animation', async (req, res) => {
  try {
    const { imageUrl, prompt, runwayApiKey } = req.body;
    
    console.log('Animation generation request:', {
      imageUrl,
      prompt: prompt?.substring(0, 100) + '...',
      runwayApiKey: runwayApiKey ? 'Provided' : 'Missing'
    });

    if (!runwayApiKey) {
      return res.status(400).json({ error: 'Runway API key is required' });
    }

    // Get image buffer and convert to base64 data URI
    const imageBuffer = await getImageBuffer(imageUrl);
    const base64Image = imageBuffer.toString('base64');
    const imageInfo = getImageInfo(imageUrl);
    const dataUri = `data:${imageInfo.contentType};base64,${base64Image}`;
    
    console.log('📸 Creating Runway image-to-video task...');
    
    // Create Runway image-to-video task (based on Unity script)
    const taskId = await createRunwayImageToVideoTask(dataUri, prompt, runwayApiKey);
    
    console.log('⏳ Polling for animation result...');
    
    // Poll for result
    const videoUrl = await pollRunwayTask(taskId, runwayApiKey);
    
    res.json({
      success: true,
      videoUrl: videoUrl,
      taskId: taskId,
      message: 'Animation generated successfully'
    });
    
  } catch (error) {
    console.error('Animation generation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate animation'
    });
  }
});

// Memory Companion - Voice chat endpoint using official Inworld Voice Agent template
app.post('/voice-chat', async (req, res) => {
  try {
    const { audioData, sampleRate, apiKey, voiceId, conversationHistory, personality, background, memories } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    if (!audioData) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    console.log('Voice chat request:', {
      audioDataSize: audioData.length,
      sampleRate: sampleRate || 16000,
      voiceId: voiceId || 'default',
      historyLength: conversationHistory?.length || 0,
      hasPersonality: !!personality,
      hasBackground: !!background,
      hasMemories: !!memories
    });

    // Create voice agent graph with audio input (following official template)
    const voiceGraph = await createVoiceAgentGraph(apiKey, voiceId, true, personality, background, memories);
    
    // Convert base64 audio to proper format for Inworld STT
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Ensure buffer length is multiple of 4 for Float32Array
    const alignedLength = Math.floor(audioBuffer.length / 4) * 4;
    const alignedBuffer = audioBuffer.slice(0, alignedLength);
    const audioFloat32 = new Float32Array(alignedBuffer.buffer, alignedBuffer.byteOffset, alignedLength / 4);
    
    // Convert to array and filter out any null/undefined values
    const audioArray = Array.from(audioFloat32).filter(val => val !== null && val !== undefined && !isNaN(val));
    
    // Find min/max without using spread operator to avoid stack overflow
    let minSample = audioArray[0] || 0;
    let maxSample = audioArray[0] || 0;
    let maxAmplitude = 0;
    
    for (let i = 0; i < audioArray.length; i++) {
        const sample = audioArray[i];
        if (sample < minSample) minSample = sample;
        if (sample > maxSample) maxSample = sample;
        const amplitude = Math.abs(sample);
        if (amplitude > maxAmplitude) maxAmplitude = amplitude;
    }
    
    console.log(`Audio data processed: ${audioArray.length} samples, range: ${minSample.toFixed(4)} to ${maxSample.toFixed(4)}`);
    
    // Validate audio data has content (not silent)
    console.log(`Audio max amplitude: ${maxAmplitude.toFixed(4)}`);
    
    if (maxAmplitude < 0.001) {
      console.warn('⚠️ Audio appears to be silent or very quiet');
    }
    
    // Create audio input following template structure
    const audioInput = {
      audio: {
        data: audioArray,
        sampleRate: sampleRate || 16000
      },
      interactionId: `interaction-${Date.now()}`,
      conversationHistory: conversationHistory || []
    };

    const { outputStream } = await voiceGraph.start(audioInput);
    
    let sttText = '';
    let llmResponse = '';
    let ttsAudioData: number[] = [];
    
    for await (const result of outputStream) {
      await result.processResponse({
        Content: (content: GraphTypes.Content) => {
          console.log('Received Content:', content);
          // Capture STT result - the first content should be from STT
          if (content.content && !sttText) {
            sttText = content.content;
            console.log('✅ STT Result captured:', sttText);
          }
        },
        TTSOutputStream: async (ttsStream: GraphTypes.TTSOutputStream) => {
          console.log('Received TTSOutputStream');
          for await (const chunk of ttsStream) {
            if (chunk.text) {
              llmResponse += chunk.text;
              console.log('TTS Text chunk:', chunk.text);
            }
            if (chunk.audio?.data) {
              // v0.8: audio data is base64-encoded, need to decode
              const decodedData = Buffer.from(chunk.audio.data as any, 'base64');
              const float32Array = new Float32Array(decodedData.buffer, decodedData.byteOffset, decodedData.byteLength / 4);
              const audioChunk = Array.from(float32Array);
              ttsAudioData = ttsAudioData.concat(audioChunk);
              console.log('TTS Audio chunk received:', audioChunk.length, 'samples');
            }
          }
        },
        default: (data: any) => {
          console.log('Unprocessed voice chat response type:', typeof data, Object.keys(data));
          // Log all response types to help debug what we're missing
          if (data && typeof data === 'object') {
            console.log('Response data keys:', Object.keys(data));
            console.log('Response data:', JSON.stringify(data, null, 2));
          }
        },
      });
    }
    
    console.log('Pipeline completed - STT:', sttText ? 'SUCCESS' : 'FAILED', 'LLM:', llmResponse ? 'SUCCESS' : 'FAILED', 'TTS Audio:', ttsAudioData.length, 'samples');

    // Graph cleanup is handled by stopInworldRuntime() on shutdown

    // Convert audio data to base64 for transmission
    const audioBuffer2 = new Float32Array(ttsAudioData);
    const audioBase64 = Buffer.from(audioBuffer2.buffer).toString('base64');

    // Return the actual STT result if captured, otherwise provide fallback
    const finalSTTText = sttText || (llmResponse ? "Speech recognized (STT output not captured)" : "STT failed - no speech detected");
    
    res.json({
      success: true,
      sttText: finalSTTText,
      llmResponse: llmResponse,
      ttsAudioData: audioBase64,
      sampleRate: 22050,
      timestamp: new Date().toISOString(),
      debug: {
        audioSamples: audioArray.length,
        maxAmplitude: maxAmplitude,
        sttCaptured: !!sttText,
        llmGenerated: !!llmResponse
      }
    });
    
  } catch (error) {
    console.error('Voice chat error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to process voice chat'
    });
  }
});


// Memory Companion - Text chat endpoint (for validation)
app.post('/memory-chat', async (req, res) => {
  try {
    const { message, apiKey, voiceId } = req.body;
    
    if (!apiKey) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Simple LLM test for validation
    const llmNode = new RemoteLLMChatNode({
      id: "validation-llm",
      provider: "openai", 
      modelName: "gpt-4o-mini",
      textGenerationConfig: { maxNewTokens: 50, temperature: 0.5 }
    });

    const testGraph = new GraphBuilder({ id: 'validation-test', apiKey })
      .addNode(llmNode)
      .setStartNode(llmNode)
      .setEndNode(llmNode)
      .build();

    const messages = [{
      role: "system",
      content: "Respond with 'Validation successful' if you can process this message."
    }, {
      role: "user", 
      content: message
    }];

    const { outputStream } = await testGraph.start(new GraphTypes.LLMChatRequest({ messages }));
    let response = '';
    
    for await (const result of outputStream) {
      result.processResponse({
        Content: (content: GraphTypes.Content) => {
          response = content.content;
        },
        default: (data: any) => {
          console.error('Unprocessed validation response:', data);
        },
      });
    }

    // Graph cleanup is handled by stopInworldRuntime() on shutdown

    res.json({
      success: true,
      response: response,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Memory chat validation error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to validate configuration'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
  console.log(`🔑 Default Inworld API Key: ${defaultApiKey ? 'Set' : 'Not Set'}`);
  console.log(`📝 API keys can also be provided via the frontend interface`);
});

// LipSync Pipeline Helper Functions
function convertBase64ToWav(base64AudioData: string, sampleRate: number): Buffer {
  // Convert base64 to Float32Array
  const binaryString = Buffer.from(base64AudioData, 'base64');
  const audioFloat32 = new Float32Array(binaryString.buffer);
  
  // Create WAV buffer
  const length = audioFloat32.length;
  const buffer = Buffer.alloc(44 + length * 2);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + length * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(length * 2, 40);
  
  // Convert float32 to int16
  let offset = 44;
  for (let i = 0; i < length; i++) {
    const sample = Math.max(-1, Math.min(1, audioFloat32[i]));
    buffer.writeInt16LE(sample * 0x7FFF, offset);
    offset += 2;
  }
  
  return buffer;
}

async function getImageBuffer(imageUrl: string): Promise<Buffer> {
  const imagePath = path.join(__dirname, '..', 'uploads', path.basename(imageUrl));
  return fs.readFileSync(imagePath);
}

function getImageInfo(imageUrl: string): { contentType: string; fileName: string } {
  const fileName = path.basename(imageUrl);
  const ext = path.extname(fileName).toLowerCase();
  
  // Map file extensions to MIME types (UseAPI supported formats)
  const mimeTypes: { [key: string]: string } = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.mpo': 'image/mpo'
  };
  
  const contentType = mimeTypes[ext] || 'image/jpeg'; // Default to JPEG if unknown
  const timestamp = Date.now();
  const baseName = path.parse(fileName).name;
  const newFileName = `lipsync_image_${timestamp}_${baseName}${ext}`;
  
  console.log(`Image info - Original: ${fileName}, Type: ${contentType}, New name: ${newFileName}`);
  
  return {
    contentType,
    fileName: newFileName
  };
}

async function uploadAssetToUseapi(
  fileBuffer: Buffer, 
  contentType: string, 
  fileName: string, 
  apiToken: string, 
  runwayEmail?: string
): Promise<string> {
  const baseUrl = 'https://api.useapi.net/v1/runwayml';
  let url = `${baseUrl}/assets/?name=${encodeURIComponent(fileName)}`;
  
  if (runwayEmail) {
    url += `&email=${encodeURIComponent(runwayEmail)}`;
  }
  
  console.log(`Uploading to: ${url}`);
  console.log(`Content-Type: ${contentType}, File size: ${fileBuffer.length} bytes`);
  
  const response = await fetch(url, {
    method: 'POST',
    body: fileBuffer,
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': contentType
    }
  });
  
  console.log(`Upload response status: ${response.status}`);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Upload failed response: ${errorText}`);
    throw new Error(`Upload failed: HTTP ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  console.log('Upload result:', result);
  
  const assetId = result.assetId || result.id;
  
  if (!assetId) {
    throw new Error('Upload succeeded but assetId missing in response');
  }
  
  console.log(`Upload successful, assetId: ${assetId}`);
  return assetId;
}

async function createLipsyncTask(imageAssetId: string, audioAssetId: string, apiToken: string): Promise<string> {
  const baseUrl = 'https://api.useapi.net/v1/runwayml';
  const url = `${baseUrl}/lipsync/create`;
  
  const body = {
    image_assetId: imageAssetId,
    audio_assetId: audioAssetId
  };
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create lipsync failed: HTTP ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.taskId) {
    throw new Error('Create lipsync succeeded but taskId missing');
  }
  
  return result.taskId;
}

async function pollForVideoResult(taskId: string, apiToken: string): Promise<string> {
  const baseUrl = 'https://api.useapi.net/v1/runwayml';
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  const pollInterval = 5000; // 5 seconds
  
  console.log(`Starting to poll for taskId: ${taskId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Don't encode the taskId - use it as-is since it's already in the correct format
    const url = `${baseUrl}/tasks/${taskId}`;
    
    console.log(`Polling attempt ${attempt + 1}/${maxAttempts} - URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Accept': 'application/json'
      }
    });
    
    console.log(`Poll response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Poll failed response: ${errorText}`);
      throw new Error(`Poll failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const status = result.status;
    
    console.log(`Task status: ${status}`);
    
    if (status === 'SUCCEEDED') {
      const videoUrl = result.artifacts?.[0]?.url;
      if (!videoUrl) {
        console.error('Task succeeded but no video URL in artifacts:', result);
        throw new Error('Task succeeded but video URL missing');
      }
      console.log(`✅ Video generation completed! URL: ${videoUrl}`);
      return videoUrl;
    }
    
    if (status === 'FAILED') {
      console.error('Task failed with result:', result);
      throw new Error(`Task failed: ${JSON.stringify(result)}`);
    }
    
    console.log(`⏳ Task still processing (${status}), waiting ${pollInterval/1000}s...`);
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error(`Polling timed out after ${maxAttempts} attempts (${(maxAttempts * pollInterval)/1000/60} minutes)`);
}

// Runway Image-to-Video Helper Functions (based on Unity script)
async function createRunwayImageToVideoTask(dataUri: string, prompt: string, apiKey: string): Promise<string> {
  const apiBase = 'https://api.dev.runwayml.com';
  const apiVersion = '2024-11-06';
  
  // Check data URI size (5MB limit as per Unity script)
  const dataUriBytes = Buffer.byteLength(dataUri, 'utf8');
  const fiveMB = 5 * 1024 * 1024;
  if (dataUriBytes > fiveMB) {
    console.warn(`Data URI is ${(dataUriBytes / (1024 * 1024)).toFixed(2)} MB (> 5 MB limit). Consider using smaller image.`);
  }
  
  const payload = {
    model: 'gen4_turbo',
    promptText: prompt,
    promptImage: dataUri,
    ratio: '1280:720',
    duration: 5
  };
  
  console.log('Creating Runway image-to-video task with payload:', {
    model: payload.model,
    promptLength: prompt.length,
    ratio: payload.ratio,
    duration: payload.duration,
    dataUriSize: `${(dataUriBytes / 1024).toFixed(1)}KB`
  });
  
  const response = await fetch(`${apiBase}/v1/image_to_video`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Runway-Version': apiVersion
    },
    body: JSON.stringify(payload)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Create task failed: HTTP ${response.status} - ${errorText}`);
  }
  
  const result = await response.json();
  
  if (!result.id) {
    throw new Error('Create task succeeded but task ID missing');
  }
  
  console.log(`Runway image-to-video task created: ${result.id}`);
  return result.id;
}

async function pollRunwayTask(taskId: string, apiKey: string): Promise<string> {
  const apiBase = 'https://api.dev.runwayml.com';
  const apiVersion = '2024-11-06';
  const maxAttempts = 150; // 5 minutes with 2-second intervals (like Unity script)
  const pollInterval = 2000; // 2 seconds
  
  console.log(`Starting to poll Runway task: ${taskId}`);
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const statusUrl = `${apiBase}/v1/tasks/${taskId}`;
    
    const response = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'X-Runway-Version': apiVersion
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Poll failed: HTTP ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    const status = result.status;
    
    console.log(`Polling attempt ${attempt + 1}/${maxAttempts}, status: ${status}`);
    
    if (status === 'SUCCEEDED') {
      if (result.output && result.output.length > 0) {
        const videoUrl = result.output[0];
        console.log(`✅ Animation generation completed! URL: ${videoUrl}`);
        return videoUrl;
      } else {
        throw new Error('Task succeeded but no output URLs');
      }
    }
    
    if (status === 'FAILED') {
      const errorMsg = result.error?.message || 'Unknown error';
      throw new Error(`Task failed: ${errorMsg}`);
    }
    
    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  throw new Error(`Polling timed out after ${maxAttempts} attempts (${(maxAttempts * pollInterval)/1000/60} minutes)`);
}

// Voice Agent Graph Creation (based on official Inworld template)
async function createVoiceAgentGraph(
  apiKey: string, 
  voiceId?: string, 
  withAudioInput: boolean = true,
  personality?: string,
  background?: string,
  memories?: string
) {
  const timestamp = Date.now();
  const postfix = withAudioInput ? '-with-audio-input' : '-with-text-input';
  const graphId = `voice-agent-${timestamp}${postfix}`;
  
  // Build system prompt from user input or default
  function buildSystemPrompt(): string {
    // Use user-provided values or default
    const finalPersonality = personality || DEFAULT_PERSONALITY;
    const finalBackground = background?.trim();
    const finalMemories = memories?.trim();
    
    let systemPrompt = finalPersonality;
    
    if (finalBackground) {
      systemPrompt += `\n\nBackground: ${finalBackground}`;
    }
    
    if (finalMemories) {
      systemPrompt += `\n\nMemories: ${finalMemories}`;
    }
    
    return systemPrompt;
  }
  
  // Custom node to build LLM chat request from conversation state
  class DialogPromptBuilderNode extends CustomNode {
    process(_context: ProcessContext, state: any): GraphTypes.LLMChatRequest {
      const conversationMessages = state.messages?.map((msg: any) => ({
        role: msg.role,
        content: msg.content,
      })) || [];

      return new GraphTypes.LLMChatRequest({
        messages: conversationMessages,
      });
    }
  }

  // Custom node to update state with user input
  class UpdateStateNode extends CustomNode {
    process(_context: ProcessContext, input: any): any {
      const { text, interactionId, conversationHistory } = input;
      
      // Create state with conversation history
      const messages = [
        {
          role: "system",
          content: buildSystemPrompt()
        },
        ...(conversationHistory || []),
        {
          role: 'user',
          content: text,
          id: interactionId,
        }
      ];
      
      return { messages };
    }
  }

  // Create node instances
  const dialogPromptBuilderNode = new DialogPromptBuilderNode({
    id: `dialog-prompt-builder-node${postfix}`,
  });
  const updateStateNode = new UpdateStateNode({ id: `update-state-node${postfix}` });

  const llmNode = new RemoteLLMChatNode({
    id: `llm-node${postfix}`,
    provider: "openai",
    modelName: "gpt-4o-mini",
    stream: true,
    textGenerationConfig: { maxNewTokens: 256, temperature: 0.8 },
  });

  const textChunkingNode = new TextChunkingNode({
    id: `text-chunking-node${postfix}`,
  });

  const ttsNode = new RemoteTTSNode({
    id: `tts-node${postfix}`,
    speakerId: voiceId || 'default',
    modelId: 'inworld-tts-1.5-max',
    sampleRate: 22050,
    temperature: 0.8,
    speakingRate: 1,
  });

  const graphBuilder = new GraphBuilder({
    id: graphId,
    apiKey,
    enableRemoteConfig: false,
  });

  graphBuilder
    .addNode(updateStateNode)
    .addNode(dialogPromptBuilderNode)
    .addNode(llmNode)
    .addNode(textChunkingNode)
    .addNode(ttsNode)
    .addEdge(updateStateNode, dialogPromptBuilderNode)
    .addEdge(dialogPromptBuilderNode, llmNode)
    .addEdge(llmNode, textChunkingNode)
    .addEdge(textChunkingNode, ttsNode);

  if (withAudioInput) {
    // Custom node to join STT result with original input metadata
    class TextInputNode extends CustomNode {
      process(_context: ProcessContext, audioInput: any, text: string): any {
        const { audio: _audio, ...rest } = audioInput;
        return { text, ...rest };
      }
    }

    // Custom node to extract audio data for STT processing
    class AudioFilterNode extends CustomNode {
      process(_context: ProcessContext, input: any): GraphTypes.Audio {
        return new GraphTypes.Audio({
          data: input.audio.data,
          sampleRate: input.audio.sampleRate,
        });
      }
    }

    // Audio input nodes (following official template exactly)
    const audioInputNode = new ProxyNode();
    const textInputNode = new TextInputNode();
    const audioFilterNode = new AudioFilterNode();
    const sttNode = new RemoteSTTNode(); // Use default STT configuration

    graphBuilder
      .addNode(audioInputNode)
      .addNode(audioFilterNode)
      .addNode(sttNode)
      .addNode(textInputNode)
      .addEdge(audioInputNode, textInputNode)
      .addEdge(audioInputNode, audioFilterNode)
      .addEdge(audioFilterNode, sttNode)
      .addEdge(sttNode, textInputNode)
      .addEdge(textInputNode, updateStateNode)
      .setStartNode(audioInputNode);
  } else {
    graphBuilder.setStartNode(updateStateNode);
  }

  graphBuilder.setEndNode(ttsNode);

  const graph = graphBuilder.build();
  console.log(`Created voice agent graph: ${graphId}`);
  return graph;
}

// Helper function to infer user input from AI response (since STT is working but not captured)
function inferUserInputFromAIResponse(aiResponse: string): string {
  if (!aiResponse) return "Speech processed";
  
  const response = aiResponse.toLowerCase();
  
  // Common patterns to infer what user might have said
  if (response.includes('weather')) {
    return "Asked about weather";
  }
  if (response.includes('not human') || response.includes("i'm an ai")) {
    return "Asked if you're human";
  }
  if (response.includes('help') || response.includes('assist')) {
    return "Asked for help";
  }
  if (response.includes('hello') || response.includes('hi there')) {
    return "Said hello";
  }
  if (response.includes("didn't come through") || response.includes("message might not")) {
    return "Audio unclear or silent";
  }
  
  // Default - extract key words from response
  const words = aiResponse.split(' ').slice(0, 3).join(' ');
  return `Said something about: ${words}`;
}

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  console.log(`\n🛑 ${signal} received, shutting down server...`);
  try {
    await stopInworldRuntime();
    console.log('✅ Inworld Runtime stopped successfully');
  } catch (error) {
    console.error('Error stopping Inworld Runtime:', error);
  }
  process.exit(0);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
