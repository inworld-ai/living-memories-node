// Memory Companion Global State
let memoryUploadedImage = null;
let memoryConversationHistory = [];

// Memory Companion DOM Elements
const memoryApiKeyInput = document.getElementById('memoryApiKeyInput');
const memoryVoiceIdInput = document.getElementById('memoryVoiceIdInput');
const memoryRunwayTokenInput = document.getElementById('memoryRunwayTokenInput');
const toggleMemoryApiKeyBtn = document.getElementById('toggleMemoryApiKey');
const toggleMemoryRunwayTokenBtn = document.getElementById('toggleMemoryRunwayToken');
const validateMemoryConfigBtn = document.getElementById('validateMemoryConfig');
const memoryConfigStatus = document.getElementById('memoryConfigStatus');
const memoryPanels = document.getElementById('memoryPanels');

const memoryUploadArea = document.getElementById('memoryUploadArea');
const memoryImageInput = document.getElementById('memoryImageInput');
const memoryImagePreview = document.getElementById('memoryImagePreview');
const memoryPreviewImg = document.getElementById('memoryPreviewImg');
const removeMemoryImageBtn = document.getElementById('removeMemoryImage');
const memoryUploadStatus = document.getElementById('memoryUploadStatus');
const animationPromptInput = document.getElementById('animationPrompt');
const generateAnimationBtn = document.getElementById('generateAnimation');

const memoryVideoContent = document.getElementById('memoryVideoContent');
const memoryChatControls = document.getElementById('memoryChatControls');
const startVoiceChatBtn = document.getElementById('startVoiceChat');
const stopVoiceChatBtn = document.getElementById('stopVoiceChat');
const chatStatus = document.getElementById('chatStatus');

// Initialize the Memory Companion application
document.addEventListener('DOMContentLoaded', function() {
    console.log('Memory Companion page loaded');
    initializeMemoryCompanion();
});

// Memory Companion Functions
function initializeMemoryCompanion() {
    console.log('Initializing memory companion...');
    
    // Configuration event listeners
    if (toggleMemoryApiKeyBtn) {
        toggleMemoryApiKeyBtn.addEventListener('click', () => {
            const isPassword = memoryApiKeyInput.type === 'password';
            memoryApiKeyInput.type = isPassword ? 'text' : 'password';
            toggleMemoryApiKeyBtn.textContent = isPassword ? '🙈' : '👁️';
        });
    }
    
    if (toggleMemoryRunwayTokenBtn) {
        toggleMemoryRunwayTokenBtn.addEventListener('click', () => {
            const isPassword = memoryRunwayTokenInput.type === 'password';
            memoryRunwayTokenInput.type = isPassword ? 'text' : 'password';
            toggleMemoryRunwayTokenBtn.textContent = isPassword ? '🙈' : '👁️';
        });
    }
    
    if (memoryApiKeyInput) {
        memoryApiKeyInput.addEventListener('input', updateMemoryValidateButton);
    }
    
    if (memoryVoiceIdInput) {
        memoryVoiceIdInput.addEventListener('input', updateMemoryValidateButton);
    }
    
    if (validateMemoryConfigBtn) {
        validateMemoryConfigBtn.addEventListener('click', validateMemoryConfiguration);
    }
    
    // Image upload event listeners
    if (memoryUploadArea) {
        memoryUploadArea.addEventListener('click', () => memoryImageInput?.click());
        memoryUploadArea.addEventListener('dragover', handleMemoryDragOver);
        memoryUploadArea.addEventListener('dragleave', handleMemoryDragLeave);
        memoryUploadArea.addEventListener('drop', handleMemoryDrop);
    }
    
    if (memoryImageInput) {
        memoryImageInput.addEventListener('change', handleMemoryImageSelect);
    }
    
    if (removeMemoryImageBtn) {
        removeMemoryImageBtn.addEventListener('click', removeMemoryImage);
    }
    
    if (animationPromptInput) {
        animationPromptInput.addEventListener('input', updateGenerateAnimationButton);
    }
    
    if (generateAnimationBtn) {
        generateAnimationBtn.addEventListener('click', generateAnimation);
    }
    
    // Voice chat event listeners - Press and Hold
    if (startVoiceChatBtn) {
        startVoiceChatBtn.addEventListener('mousedown', startVoiceChat);
        startVoiceChatBtn.addEventListener('mouseup', stopVoiceChat);
        startVoiceChatBtn.addEventListener('mouseleave', stopVoiceChat); // Stop if mouse leaves button
        
        // Touch events for mobile
        startVoiceChatBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            startVoiceChat();
        });
        startVoiceChatBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            stopVoiceChat();
        });
    }
    
    
    // Initialize state
    updateMemoryValidateButton();
    console.log('Memory companion initialized successfully');
}

// Configuration Functions
function updateMemoryValidateButton() {
    if (!memoryApiKeyInput || !validateMemoryConfigBtn) return;
    
    const apiKey = memoryApiKeyInput.value.trim();
    const voiceId = memoryVoiceIdInput?.value.trim() || '';
    
    // Require both API key and Voice ID like in LipSync page
    if (apiKey.length >= 10 && voiceId.length >= 3) {
        validateMemoryConfigBtn.disabled = false;
        validateMemoryConfigBtn.style.opacity = '1';
    } else {
        validateMemoryConfigBtn.disabled = true;
        validateMemoryConfigBtn.style.opacity = '0.6';
    }
}

async function validateMemoryConfiguration() {
    const apiKey = memoryApiKeyInput?.value.trim();
    const voiceId = memoryVoiceIdInput?.value.trim();
    
    if (!apiKey) {
        showMemoryConfigStatus('❌ API Key is required', 'error');
        return;
    }
    
    if (!voiceId || voiceId.length < 3) {
        showMemoryConfigStatus('❌ Voice ID is required', 'error');
        return;
    }
    
    validateMemoryConfigBtn.disabled = true;
    validateMemoryConfigBtn.textContent = '⏳ Validating...';
    showMemoryConfigStatus('🔍 Validating Inworld configuration...', 'info');
    
    try {
        // Test the API key and Voice ID with a simple chat request
        const response = await fetch('/memory-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: 'Test validation',
                apiKey,
                voiceId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMemoryConfigStatus('✅ Inworld configuration validated successfully!', 'success');
            activateMemoryPanels();
            updateMemoryWorkflowStatus('image', 'active');
        } else {
            const shortError = getShortErrorMessage(data.error);
            showMemoryConfigStatus(`❌ Validation failed: ${shortError}`, 'error');
            validateMemoryConfigBtn.disabled = false;
            validateMemoryConfigBtn.textContent = 'Validate Inworld Config';
        }
    } catch (error) {
        console.error('Memory validation error:', error);
        const shortError = getShortErrorMessage(error.message || 'Network error');
        showMemoryConfigStatus(`❌ Validation failed: ${shortError}`, 'error');
        validateMemoryConfigBtn.disabled = false;
        validateMemoryConfigBtn.textContent = 'Validate Inworld Config';
    }
}

function activateMemoryPanels() {
    if (memoryPanels) {
        memoryPanels.classList.remove('disabled');
    }
    validateMemoryConfigBtn.textContent = 'Configuration Valid';
    validateMemoryConfigBtn.style.background = '#48bb78';
    
    // Enable voice chat immediately after validation
    if (memoryChatControls) {
        memoryChatControls.style.display = 'flex';
        showChatStatus('Voice chat ready - Press and hold to record', 'active');
    }
}

function showMemoryConfigStatus(message, type) {
    if (memoryConfigStatus) {
        memoryConfigStatus.textContent = message;
        memoryConfigStatus.className = `config-status ${type}`;
    }
}

// Utility Functions
function getShortErrorMessage(errorMessage) {
    if (!errorMessage) return 'Unknown error';
    
    const error = errorMessage.toLowerCase();
    
    if (error.includes('connection') || error.includes('timeout') || error.includes('network')) {
        return 'Connection failed';
    }
    
    if (error.includes('unauthorized') || error.includes('authentication') || error.includes('api key')) {
        return 'Invalid API key';
    }
    
    if (error.includes('graph') || error.includes('config') || error.includes('parse')) {
        return 'Configuration error';
    }
    
    const words = errorMessage.split(/[:;,]/)[0].trim();
    if (words.length > 30) {
        return words.substring(0, 27) + '...';
    }
    
    return words;
}

function updateMemoryWorkflowStatus(step, status) {
    const statusElement = document.getElementById(`memory${step.charAt(0).toUpperCase() + step.slice(1)}Status`);
    if (statusElement) {
        const icons = {
            pending: '⏳',
            active: '🔄',
            completed: '✅',
            error: '❌'
        };
        
        const messages = {
            image: 'Upload Image',
            animation: 'Generate Animation',
            chat: 'Start Voice Chat'
        };
        
        statusElement.className = `status-item ${status}`;
        statusElement.textContent = `${icons[status]} ${messages[step]}`;
    }
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: ${type === 'error' ? '#fef2f2' : type === 'success' ? '#f0fdf4' : '#f0f9ff'};
        color: ${type === 'error' ? '#dc2626' : type === 'success' ? '#059669' : '#0369a1'};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 500;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 300);
    }, 3000);
}

// Image Upload Functions
function handleMemoryDragOver(e) {
    e.preventDefault();
    memoryUploadArea.classList.add('dragover');
}

function handleMemoryDragLeave(e) {
    e.preventDefault();
    memoryUploadArea.classList.remove('dragover');
}

function handleMemoryDrop(e) {
    e.preventDefault();
    memoryUploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleMemoryImageFile(files[0]);
    }
}

function handleMemoryImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleMemoryImageFile(file);
    }
}

function handleMemoryImageFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showMemoryUploadStatus('Please select an image file', 'error');
        return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showMemoryUploadStatus('Image size must be less than 5MB', 'error');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        memoryPreviewImg.src = e.target.result;
        document.querySelector('#memoryUploadArea .upload-content').style.display = 'none';
        memoryImagePreview.style.display = 'block';
        
        // Enable generate button if conditions are met
        updateGenerateAnimationButton();
    };
    reader.readAsDataURL(file);

    // Upload to server
    uploadMemoryImageToServer(file);
}

function uploadMemoryImageToServer(file) {
    const formData = new FormData();
    formData.append('image', file);

    showMemoryUploadStatus('Uploading...', 'info');

    fetch('/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            memoryUploadedImage = data;
            showMemoryUploadStatus(`✅ Image uploaded: ${data.originalName}`, 'success');
            updateMemoryWorkflowStatus('image', 'completed');
            updateMemoryWorkflowStatus('animation', 'active');
            updateGenerateAnimationButton();
        } else {
            showMemoryUploadStatus(`❌ Upload failed: ${data.error}`, 'error');
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
        showMemoryUploadStatus('❌ Upload failed: Network error', 'error');
    });
}

function removeMemoryImage() {
    memoryUploadedImage = null;
    memoryPreviewImg.src = '';
    memoryImagePreview.style.display = 'none';
    document.querySelector('#memoryUploadArea .upload-content').style.display = 'block';
    memoryImageInput.value = '';
    memoryUploadStatus.textContent = '';
    memoryUploadStatus.className = 'upload-status';
    generateAnimationBtn.disabled = true;
    updateMemoryWorkflowStatus('image', 'pending');
    updateMemoryWorkflowStatus('animation', 'pending');
}

function showMemoryUploadStatus(message, type) {
    if (memoryUploadStatus) {
        memoryUploadStatus.textContent = message;
        memoryUploadStatus.className = `upload-status ${type}`;
    }
}

function updateGenerateAnimationButton() {
    const hasImage = memoryUploadedImage !== null;
    const runwayApiKey = memoryRunwayTokenInput?.value.trim();
    
    if (generateAnimationBtn) {
        generateAnimationBtn.disabled = !(hasImage && runwayApiKey);
        generateAnimationBtn.style.opacity = (hasImage && runwayApiKey) ? '1' : '0.6';
    }
}

async function generateAnimation() {
    if (!memoryUploadedImage) {
        showNotification('❌ Please upload an image first', 'error');
        return;
    }
    
    const runwayApiKey = memoryRunwayTokenInput?.value.trim();
    if (!runwayApiKey) {
        showNotification('❌ Please enter Runway API key', 'error');
        return;
    }
    
    // Get prompt text - use user input or fallback to placeholder
    const userPrompt = animationPromptInput?.value.trim();
    const defaultPrompt = animationPromptInput?.placeholder;
    const finalPrompt = userPrompt || defaultPrompt;
    
    generateAnimationBtn.disabled = true;
    generateAnimationBtn.textContent = '⏳ Generating Animation...';
    updateMemoryWorkflowStatus('animation', 'active');
    
    try {
        const response = await fetch('/generate-animation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageUrl: memoryUploadedImage.imageUrl,
                prompt: finalPrompt,
                runwayApiKey: runwayApiKey
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayMemoryAnimation(data.videoUrl);
            updateMemoryWorkflowStatus('animation', 'completed');
            updateMemoryWorkflowStatus('chat', 'active');
            showNotification('✅ Animation generated successfully!', 'success');
            
            // Automatically move to Step 3
            if (memoryChatControls) {
                memoryChatControls.style.display = 'flex';
            }
        } else {
            const shortError = getShortErrorMessage(data.error);
            showNotification(`❌ Animation generation failed: ${shortError}`, 'error');
            updateMemoryWorkflowStatus('animation', 'error', `❌ ${shortError}`);
        }
    } catch (error) {
        console.error('Animation generation error:', error);
        const shortError = getShortErrorMessage(error.message || 'Network error');
        showNotification(`❌ Animation generation failed: ${shortError}`, 'error');
        updateMemoryWorkflowStatus('animation', 'error', `❌ ${shortError}`);
    } finally {
        generateAnimationBtn.disabled = false;
        generateAnimationBtn.textContent = 'Generate Animation';
    }
}

function displayMemoryAnimation(videoUrl) {
    if (memoryVideoContent) {
        memoryVideoContent.innerHTML = `
            <video id="memoryAnimationVideo" autoplay loop muted style="width: 100%; max-height: 300px; border-radius: 12px;">
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;
        
        console.log('Animation video displayed and looping');
    }
}

// Voice Chat Functions - Press and Hold Recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let currentAudioSource = null;
let currentAudioContext = null;

function startVoiceChat() {
    if (isRecording) return;
    
    // Stop any currently playing TTS audio immediately
    stopCurrentTTSAudio();
    
    console.log('Starting voice recording...');
    showChatStatus('🎤 Recording... Release to send', 'listening');
    
    // Enhanced audio constraints for better recording quality
    const audioConstraints = {
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000, // Prefer 16kHz for STT
            channelCount: 1     // Mono audio
        }
    };
    
    navigator.mediaDevices.getUserMedia(audioConstraints)
        .then(stream => {
            // Check if MediaRecorder supports the preferred format
            const options = [];
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                options.push({ mimeType: 'audio/webm;codecs=opus' });
            }
            if (MediaRecorder.isTypeSupported('audio/wav')) {
                options.push({ mimeType: 'audio/wav' });
            }
            
            const recorderOptions = options.length > 0 ? options[0] : {};
            console.log('Using MediaRecorder with options:', recorderOptions);
            
            mediaRecorder = new MediaRecorder(stream, recorderOptions);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunks.push(event.data);
                    console.log('Audio chunk received:', event.data.size, 'bytes');
                }
            };
            
            mediaRecorder.onstop = () => {
                console.log('MediaRecorder stopped, processing', audioChunks.length, 'chunks');
                const mimeType = mediaRecorder.mimeType || 'audio/wav';
                const audioBlob = new Blob(audioChunks, { type: mimeType });
                console.log('Created audio blob:', audioBlob.size, 'bytes, type:', audioBlob.type);
                
                if (audioBlob.size === 0) {
                    console.error('Empty audio blob - recording failed');
                    showChatStatus('❌ Recording failed - no audio captured', 'error');
                    resetVoiceChatButton();
                    return;
                }
                
                processVoiceInput(audioBlob);
                
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };
            
            mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                showChatStatus('❌ Recording error occurred', 'error');
                resetVoiceChatButton();
            };
            
            mediaRecorder.start(100); // Collect data every 100ms for better responsiveness
            isRecording = true;
            
            startVoiceChatBtn.textContent = '🔴 Recording...';
            startVoiceChatBtn.style.background = '#dc2626';
            startVoiceChatBtn.classList.add('recording');
            
            console.log('MediaRecorder started successfully');
        })
        .catch(error => {
            console.error('Microphone access error:', error);
            let errorMessage = '❌ Microphone access denied';
            
            if (error.name === 'NotFoundError') {
                errorMessage = '❌ No microphone found';
            } else if (error.name === 'NotAllowedError') {
                errorMessage = '❌ Microphone permission denied';
            } else if (error.name === 'NotReadableError') {
                errorMessage = '❌ Microphone in use by another application';
            }
            
            showChatStatus(errorMessage, 'error');
            setTimeout(() => resetVoiceChatButton(), 3000);
        });
}

function stopVoiceChat() {
    if (!isRecording || !mediaRecorder) return;
    
    console.log('Stopping voice recording...');
    mediaRecorder.stop();
    isRecording = false;
    
    startVoiceChatBtn.textContent = '🎤 Press & Hold to Record';
    startVoiceChatBtn.style.background = '';
    startVoiceChatBtn.classList.remove('recording');
    showChatStatus('Processing your voice...', 'active');
}

async function processVoiceInput(audioBlob) {
    try {
        console.log('🎤 Starting voice processing...');
        showChatStatus('Processing voice through Inworld pipeline...', 'active');
        
        // Convert audio blob to proper PCM format for Inworld STT
        console.log('📊 Audio blob type:', audioBlob.type, 'size:', audioBlob.size, 'bytes');
        
        if (audioBlob.size === 0) {
            throw new Error('Empty audio blob - no audio data recorded');
        }
        
        const audioBuffer = await audioBlob.arrayBuffer();
        console.log('📦 Audio buffer size:', audioBuffer.byteLength, 'bytes');
        
        if (audioBuffer.byteLength === 0) {
            throw new Error('Empty audio buffer - audio conversion failed');
        }
        
        // Convert to 16-bit PCM audio data
        console.log('🔄 Creating audio context...');
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        console.log('🔄 Decoding audio data...');
        let decodedAudio;
        try {
            decodedAudio = await audioContext.decodeAudioData(audioBuffer.slice(0));
        } catch (decodeError) {
            console.error('Audio decode error:', decodeError);
            throw new Error(`Failed to decode audio: ${decodeError.message}`);
        }
        
        // Get audio samples and resample to 16kHz for STT
        const originalSamples = decodedAudio.getChannelData(0);
        console.log('✅ Decoded audio samples:', originalSamples.length, 'at', decodedAudio.sampleRate, 'Hz');
        // Find min/max without using spread operator to avoid stack overflow
        let minSample = originalSamples[0];
        let maxSample = originalSamples[0];
        for (let i = 1; i < originalSamples.length; i++) {
            if (originalSamples[i] < minSample) minSample = originalSamples[i];
            if (originalSamples[i] > maxSample) maxSample = originalSamples[i];
        }
        console.log('📈 Audio range:', minSample.toFixed(4), 'to', maxSample.toFixed(4));
        
        // Resample to 16kHz for STT (if needed)
        let audioSamples = originalSamples;
        let targetSampleRate = 16000;
        
        if (decodedAudio.sampleRate !== 16000) {
            console.log('🔄 Resampling from', decodedAudio.sampleRate, 'Hz to 16000 Hz...');
            audioSamples = resampleAudio(originalSamples, decodedAudio.sampleRate, 16000);
            console.log('✅ Resampled to:', audioSamples.length, 'samples at 16kHz');
        }
        
        // Convert to base64 for transmission (avoid stack overflow)
        console.log('🔄 Converting to base64...');
        const audioBytes = new Uint8Array(audioSamples.buffer);
        let binaryString = '';
        
        // Convert in chunks to avoid stack overflow
        const chunkSize = 8192;
        for (let i = 0; i < audioBytes.length; i += chunkSize) {
            const chunk = audioBytes.slice(i, i + chunkSize);
            binaryString += String.fromCharCode.apply(null, Array.from(chunk));
        }
        
        const audioBase64 = btoa(binaryString);
        console.log('📤 Base64 audio size:', audioBase64.length, 'characters');
        
        const apiKey = memoryApiKeyInput?.value.trim();
        const voiceId = memoryVoiceIdInput?.value.trim();
        
        console.log('🚀 Sending audio to Inworld STT→LLM→TTS pipeline...');
        
        // Send audio directly to Inworld voice agent pipeline
        const response = await fetch('/voice-chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                audioData: audioBase64,
                sampleRate: targetSampleRate, // Use 16kHz for STT
                apiKey: apiKey,
                voiceId: voiceId,
                conversationHistory: memoryConversationHistory
            })
        });
        
        console.log('📡 Fetch request sent, waiting for response...');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('📥 Response received:', data.success ? 'SUCCESS' : 'FAILED');
        
        if (data.success) {
            // Display and log STT result for debugging
            if (data.sttText) {
                console.log('STT Result:', data.sttText);
                showChatStatus(`You said: "${data.sttText}"`, 'active');
                memoryConversationHistory.push({ role: 'user', content: data.sttText });
                
                // Brief pause to show STT result before AI response
                await new Promise(resolve => setTimeout(resolve, 1500));
            } else {
                console.log('No STT result received');
                showChatStatus('No speech detected', 'error');
                setTimeout(() => resetVoiceChatButton(), 2000);
                return;
            }
            
            // Get the complete AI response (all TTS chunks combined)
            const fullResponse = data.llmResponse || '';
            console.log('Complete LLM Response:', fullResponse);
            
            if (fullResponse) {
                memoryConversationHistory.push({ role: 'assistant', content: fullResponse });
            }
            
            // Play TTS response
            if (data.ttsAudioData && data.ttsAudioData.length > 0) {
                playVoiceResponse(data.ttsAudioData, data.sampleRate);
            } else {
                // If no audio, reset button after displaying text
                setTimeout(() => {
                    resetVoiceChatButton();
                }, 3000);
            }
            
            // Display complete AI response (all sentences)
            if (fullResponse.length > 120) {
                showChatStatus(`AI: "${fullResponse.substring(0, 117)}..."`, 'active');
            } else {
                showChatStatus(`AI: "${fullResponse}"`, 'active');
            }
            
            // Note: Button reset happens either in playVoiceResponse() onended event or timeout above
            
        } else {
            const shortError = getShortErrorMessage(data.error);
            showChatStatus(`Voice chat failed: ${shortError}`, 'error');
            setTimeout(() => {
                showChatStatus('Press and hold to record', 'active');
            }, 3000);
        }
        
    } catch (error) {
        console.error('Voice processing error:', error);
        showChatStatus('Voice processing failed', 'error');
        setTimeout(() => {
            showChatStatus('Press and hold to record', 'active');
        }, 3000);
    }
}

// Audio resampling function
function resampleAudio(audioSamples, originalSampleRate, targetSampleRate) {
    if (originalSampleRate === targetSampleRate) {
        return audioSamples;
    }
    
    const ratio = originalSampleRate / targetSampleRate;
    const newLength = Math.round(audioSamples.length / ratio);
    const resampled = new Float32Array(newLength);
    
    for (let i = 0; i < newLength; i++) {
        const originalIndex = i * ratio;
        const index = Math.floor(originalIndex);
        const fraction = originalIndex - index;
        
        if (index + 1 < audioSamples.length) {
            // Linear interpolation
            resampled[i] = audioSamples[index] * (1 - fraction) + audioSamples[index + 1] * fraction;
        } else {
            resampled[i] = audioSamples[index] || 0;
        }
    }
    
    return resampled;
}

function playVoiceResponse(audioBase64, sampleRate) {
    try {
        // Stop any previous audio first
        stopCurrentTTSAudio();
        
        // Convert base64 to audio and play
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const audioFloat32 = new Float32Array(bytes.buffer);
        
        // Create audio context and play
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const buffer = audioContext.createBuffer(1, audioFloat32.length, sampleRate);
        buffer.copyToChannel(audioFloat32, 0);
        
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        
        // Store references for potential interruption
        currentAudioSource = source;
        currentAudioContext = audioContext;
        
        // Handle audio completion
        source.onended = () => {
            console.log('AI voice response finished playing');
            // Clear references
            currentAudioSource = null;
            currentAudioContext = null;
            // Reset button and status only after audio completes
            resetVoiceChatButton();
        };
        
        source.onerror = (error) => {
            console.error('Audio playback error:', error);
            currentAudioSource = null;
            currentAudioContext = null;
            resetVoiceChatButton();
        };
        
        source.start();
        console.log('Playing AI voice response...');
        
    } catch (error) {
        console.error('Audio playback error:', error);
        resetVoiceChatButton();
    }
}

function stopCurrentTTSAudio() {
    // Stop currently playing TTS audio
    if (currentAudioSource) {
        try {
            currentAudioSource.stop();
            console.log('🛑 Stopped current TTS audio');
        } catch (e) {
            console.log('TTS audio already stopped or invalid');
        }
        currentAudioSource = null;
    }
    
    // Close current audio context
    if (currentAudioContext && currentAudioContext.state !== 'closed') {
        try {
            currentAudioContext.close();
            console.log('🔇 Closed TTS audio context');
        } catch (e) {
            console.log('TTS audio context already closed');
        }
        currentAudioContext = null;
    }
}

function resetVoiceChatButton() {
    if (startVoiceChatBtn) {
        startVoiceChatBtn.textContent = '🎤 Press & Hold to Record';
        startVoiceChatBtn.style.background = '';
        startVoiceChatBtn.classList.remove('recording');
    }
    showChatStatus('Press and hold to record', 'active');
}

function showChatStatus(message, type) {
    if (chatStatus) {
        chatStatus.textContent = message;
        chatStatus.className = `chat-status ${type}`;
    }
}


console.log('Memory Companion page loaded successfully');
