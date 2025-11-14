// Global state
let uploadedImage = null;
let processedText = '';

// DOM Elements
const apiKeyInput = document.getElementById('apiKeyInput');
const voiceIdInput = document.getElementById('voiceIdInput');
const toggleApiKeyBtn = document.getElementById('toggleApiKey');
const useapiTokenInput = document.getElementById('useapiTokenInput');
const toggleUseapiTokenBtn = document.getElementById('toggleUseapiToken');
const runwayEmailInput = document.getElementById('runwayEmailInput');
const validateConfigBtn = document.getElementById('validateConfig');
const configStatus = document.getElementById('configStatus');
const creationPanels = document.getElementById('creationPanels');
const generateLipSyncBtn = document.getElementById('generateLipSync');

const uploadArea = document.getElementById('uploadArea');
const imageInput = document.getElementById('imageInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImageBtn = document.getElementById('removeImage');
const uploadStatus = document.getElementById('uploadStatus');

const ttsInput = document.getElementById('ttsInput');
const processTTSBtn = document.getElementById('processTTS');
const ttsOutput = document.getElementById('ttsOutput');
const processedTextDiv = document.getElementById('processedText');
const speakTextBtn = document.getElementById('speakText');

// Workflow status elements
const workflowStatus = document.getElementById('workflowStatus');
const videoContent = document.getElementById('videoContent');
const videoControls = document.getElementById('videoControls');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    updateValidateButton();
});

// Event Listeners
function initializeEventListeners() {
    // Configuration events
    toggleApiKeyBtn.addEventListener('click', toggleApiKeyVisibility);
    toggleUseapiTokenBtn.addEventListener('click', toggleUseapiTokenVisibility);
    validateConfigBtn.addEventListener('click', validateAndActivatePanels);
    apiKeyInput.addEventListener('input', updateValidateButton);
    voiceIdInput.addEventListener('input', updateValidateButton);

    // Image upload events
    uploadArea.addEventListener('click', () => imageInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    imageInput.addEventListener('change', handleImageSelect);
    removeImageBtn.addEventListener('click', removeImage);

    // TTS events
    processTTSBtn.addEventListener('click', processTTS);
    speakTextBtn.addEventListener('click', speakText);
    ttsInput.addEventListener('input', updateTTSButtonState);

    // LipSync generation
    generateLipSyncBtn.addEventListener('click', generateLipSyncVideo);
}

// Configuration Functions
function toggleApiKeyVisibility() {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleApiKeyBtn.textContent = isPassword ? 'Hide' : 'Show';
}

function toggleUseapiTokenVisibility() {
    const isPassword = useapiTokenInput.type === 'password';
    useapiTokenInput.type = isPassword ? 'text' : 'password';
    toggleUseapiTokenBtn.textContent = isPassword ? 'Hide' : 'Show';
}

function updateValidateButton() {
    const apiKey = apiKeyInput.value.trim();
    const voiceId = voiceIdInput.value.trim();
    
    // Require both Inworld API key and Voice ID
    if (apiKey.length >= 10 && voiceId.length >= 3) {
        validateConfigBtn.disabled = false;
        validateConfigBtn.style.opacity = '1';
    } else {
        validateConfigBtn.disabled = true;
        validateConfigBtn.style.opacity = '0.6';
    }
}

async function validateAndActivatePanels() {
    const apiKey = apiKeyInput.value.trim();
    const voiceId = voiceIdInput.value.trim();
    
    if (!apiKey) {
        showConfigStatus('API Key is required', 'error');
        return;
    }
    
    if (apiKey.length < 10) {
        showConfigStatus('API Key seems too short', 'error');
        return;
    }
    
    if (!voiceId || voiceId.length < 3) {
        showConfigStatus('Voice ID is required', 'error');
        return;
    }
    
    // Show loading state
    validateConfigBtn.disabled = true;
    validateConfigBtn.textContent = 'Validating...';
    showConfigStatus('Validating configuration...', 'info');
    
    try {
        // Test the API key by making a simple TTS request
        const response = await fetch('/process-tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                text: 'Test validation',
                apiKey, 
                voiceId 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showConfigStatus('Configuration validated successfully!', 'success');
            activateCreationPanels();
            updateWorkflowStatus('image', 'active');
        } else {
            const shortError = getShortErrorMessage(data.error);
            showConfigStatus(`Validation failed: ${shortError}`, 'error');
            deactivateCreationPanels();
            validateConfigBtn.disabled = false;
            validateConfigBtn.textContent = 'Validate Inworld Config';
        }
    } catch (error) {
        console.error('Validation error:', error);
        const shortError = getShortErrorMessage(error.message || 'Network error');
        showConfigStatus(`Validation failed: ${shortError}`, 'error');
        deactivateCreationPanels();
        validateConfigBtn.disabled = false;
        validateConfigBtn.textContent = 'Validate Inworld Config';
    }
}

function activateCreationPanels() {
    console.log('Activating creation panels');
    creationPanels.classList.remove('disabled');
    validateConfigBtn.textContent = 'Configuration Valid';
    validateConfigBtn.style.background = '#3c7349';
}

function deactivateCreationPanels() {
    console.log('Deactivating creation panels');
    creationPanels.classList.add('disabled');
    validateConfigBtn.style.background = '';
    
    // Reset all workflow status to pending
    updateWorkflowStatus('image', 'pending');
    updateWorkflowStatus('tts', 'pending');
    updateWorkflowStatus('video', 'pending');
    
    // Clear any uploaded data
    if (uploadedImage) {
        removeImage();
    }
    
    // Clear TTS data
    if (window.currentAudioData) {
        window.currentAudioData = null;
        ttsOutput.style.display = 'none';
        processedText = '';
    }
    
    // Disable LipSync button
    if (generateLipSyncBtn) {
        generateLipSyncBtn.disabled = true;
        generateLipSyncBtn.style.opacity = '0.6';
    }
}

function showConfigStatus(message, type) {
    configStatus.textContent = message;
    configStatus.className = `config-status ${type}`;
    
    // Auto-hide success messages after 3 seconds
    if (type === 'success') {
        setTimeout(() => {
            configStatus.textContent = '';
            configStatus.className = 'config-status';
        }, 3000);
    }
}

function getApiKey() {
    return apiKeyInput.value.trim();
}

function getVoiceId() {
    return voiceIdInput.value.trim();
}

function getUseapiToken() {
    return useapiTokenInput.value.trim();
}

function getRunwayEmail() {
    return runwayEmailInput.value.trim();
}

// Error Message Simplification
function getShortErrorMessage(errorMessage) {
    if (!errorMessage) return 'Unknown error';
    
    const error = errorMessage.toLowerCase();
    
    // Connection/Network errors
    if (error.includes('connection') || error.includes('timeout') || error.includes('network')) {
        return 'Connection failed';
    }
    
    // Authentication errors
    if (error.includes('unauthorized') || error.includes('authentication') || error.includes('api key')) {
        return 'Invalid API key';
    }
    
    // TTS/Voice errors
    if (error.includes('tts') || error.includes('voice') || error.includes('speaker')) {
        return 'Voice not available';
    }
    
    // Graph/Config errors
    if (error.includes('graph') || error.includes('config') || error.includes('parse')) {
        return 'Configuration error';
    }
    
    // Server errors
    if (error.includes('internal') || error.includes('server')) {
        return 'Server error';
    }
    
    // Rate limiting
    if (error.includes('rate') || error.includes('limit')) {
        return 'Rate limit exceeded';
    }
    
    // Default: Take first meaningful part of error
    const words = errorMessage.split(/[:;,]/)[0].trim();
    if (words.length > 30) {
        return words.substring(0, 27) + '...';
    }
    
    return words;
}

// Workflow Status Management
function updateWorkflowStatus(step, status, customMessage = null) {
    const statusElement = document.getElementById(`${step}Status`);
    if (statusElement) {
        statusElement.className = `status-item ${status}`;
        
        if (customMessage) {
            // Use custom message for errors or special cases
            statusElement.textContent = customMessage;
        } else {
            // Use default messages
            const icons = {
                pending: '[Pending]',
                active: '[Active]',
                completed: '[Completed]',
                error: '[Error]'
            };
            
            const messages = {
                config: 'Configure API & Voice',
                image: 'Upload Image',
                tts: 'Generate TTS',
                video: 'Generate Video'
            };
            
            statusElement.textContent = `${icons[status]} ${messages[step]}`;
        }
    }
}

// Image Upload Functions
function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleImageFile(files[0]);
    }
}

function handleImageSelect(e) {
    const file = e.target.files[0];
    if (file) {
        handleImageFile(file);
    }
}

function handleImageFile(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        showUploadStatus('Please select an image file', 'error');
        return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
        showUploadStatus('Image size must be less than 5MB', 'error');
        return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
        previewImg.src = e.target.result;
        document.querySelector('.upload-content').style.display = 'none';
        imagePreview.style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Upload to server
    uploadImageToServer(file);
}

function uploadImageToServer(file) {
    const formData = new FormData();
    formData.append('image', file);

    showUploadStatus('Uploading...', 'info');

    fetch('/upload-image', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
    if (data.success) {
        uploadedImage = data;
        showUploadStatus(`Image uploaded: ${data.originalName}`, 'success');
        updateWorkflowStatus('image', 'completed');
        updateWorkflowStatus('tts', 'active');
    } else {
        showUploadStatus(`Upload failed: ${data.error}`, 'error');
    }
    })
    .catch(error => {
        console.error('Upload error:', error);
        showUploadStatus('Upload failed: Network error', 'error');
    });
}

function removeImage() {
    uploadedImage = null;
    previewImg.src = '';
    imagePreview.style.display = 'none';
    document.querySelector('.upload-content').style.display = 'block';
    imageInput.value = '';
    uploadStatus.textContent = '';
    uploadStatus.className = 'upload-status';
}

function showUploadStatus(message, type) {
    uploadStatus.textContent = message;
    uploadStatus.className = `upload-status ${type}`;
}

// TTS Functions
function updateTTSButtonState() {
    const hasText = ttsInput.value.trim().length > 0;
    processTTSBtn.disabled = !hasText;
}

async function processTTS() {
    const text = ttsInput.value.trim();
    if (!text) return;

    // Check if panels are activated (configuration validated)
    if (creationPanels.classList.contains('disabled')) {
        showNotification('Please validate configuration first', 'error');
        return;
    }

    const apiKey = getApiKey();
    const voiceId = getVoiceId();

    const btnText = processTTSBtn.querySelector('.btn-text');
    const spinner = processTTSBtn.querySelector('.spinner');
    
    // Show loading state
    btnText.textContent = 'Processing...';
    spinner.style.display = 'block';
    processTTSBtn.disabled = true;

    try {
        const response = await fetch('/process-tts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                text,
                apiKey,
                voiceId: voiceId || undefined
            })
        });

        const data = await response.json();

        if (data.success) {
            processedText = data.processedText;
            processedTextDiv.textContent = processedText;
            ttsOutput.style.display = 'block';
            
            // Store audio data for playback
            if (data.audioData && data.audioSamples > 0) {
                window.currentAudioData = {
                    audioData: data.audioData,
                    sampleRate: data.sampleRate,
                    voiceId: data.voiceId
                };
                showNotification(`TTS generated successfully! Voice: ${data.voiceId}, Samples: ${data.audioSamples}`, 'success');
                console.log(`TTS Success - Voice: ${data.voiceId}, Audio samples: ${data.audioSamples}, Results: ${data.resultCount}`);
                
                // Update workflow status and enable LipSync button
                updateWorkflowStatus('tts', 'completed');
                
                if (uploadedImage && generateLipSyncBtn) {
                    generateLipSyncBtn.disabled = false;
                    generateLipSyncBtn.style.opacity = '1';
                }
            } else {
                showNotification('TTS generated but no audio data received', 'error');
                console.error('TTS response missing audio data:', data);
            }
        } else {
            console.error('TTS processing failed:', data);
            showNotification(`TTS failed: ${data.error}`, 'error');
            if (data.details) {
                console.error('Error details:', data.details);
            }
        }
    } catch (error) {
        console.error('TTS network error:', error);
        showNotification('TTS network error - check connection and try again', 'error');
    } finally {
        // Reset button state
        btnText.textContent = 'Generate TTS';
        spinner.style.display = 'none';
        processTTSBtn.disabled = false;
    }
}

// LipSync Generation
async function generateLipSyncVideo() {
    if (!uploadedImage) {
        showNotification('Please upload an image first', 'error');
        return;
    }
    
    if (!window.currentAudioData) {
        showNotification('Please generate TTS audio first', 'error');
        return;
    }
    
    generateLipSyncBtn.disabled = true;
    generateLipSyncBtn.textContent = 'Generating Video...';
    updateWorkflowStatus('video', 'active');
    
    try {
        const response = await fetch('/generate-lipsync', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                imageUrl: uploadedImage.imageUrl,
                audioData: window.currentAudioData.audioData,
                sampleRate: window.currentAudioData.sampleRate,
                voiceId: window.currentAudioData.voiceId,
                useapiToken: getUseapiToken(),
                runwayEmail: getRunwayEmail()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            displayLipSyncVideo(data.videoUrl);
            updateWorkflowStatus('video', 'completed');
            showNotification('LipSync video generated successfully!', 'success');
        } else {
            showNotification(`Video generation failed: ${data.error}`, 'error');
            updateWorkflowStatus('video', 'pending');
        }
    } catch (error) {
        console.error('LipSync generation error:', error);
        showNotification('Video generation failed: Network error', 'error');
        updateWorkflowStatus('video', 'pending');
    } finally {
        generateLipSyncBtn.disabled = false;
        generateLipSyncBtn.textContent = 'Generate LipSync Video';
    }
}

function displayLipSyncVideo(videoUrl) {
    const videoContent = document.getElementById('videoContent');
    
    videoContent.innerHTML = `
        <video id="lipSyncVideo" controls style="width: 100%; max-height: 400px; border-radius: 10px;">
            <source src="${videoUrl}" type="video/mp4">
            Your browser does not support the video tag.
        </video>
    `;
}

// Utility Functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#fed7d7' : type === 'success' ? '#c6f6d5' : '#bee3f8'};
        color: ${type === 'error' ? '#742a2a' : type === 'success' ? '#22543d' : '#2a69ac'};
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 1000;
        font-weight: 500;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;
    
    // Add slide-in animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
    
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

function speakText() {
    // Debounce mechanism - prevent rapid clicks
    if (window.audioProcessing) {
        console.log('Audio processing in progress, ignoring click');
        return;
    }
    
    if (!window.currentAudioData) {
        showNotification('No audio data available. Please process text first.', 'error');
        return;
    }

    // Set processing flag
    window.audioProcessing = true;
    
    console.log('Starting audio playback...');
    console.log('Audio data available:', !!window.currentAudioData.audioData);
    console.log('Voice ID:', window.currentAudioData.voiceId);

    // Disable the button to prevent double-clicks
    speakTextBtn.disabled = true;
    speakTextBtn.style.opacity = '0.6';

    // Only stop audio if we're currently playing something
    if (window.currentAudioSource || window.currentAudioElement) {
        console.log('Stopping currently playing audio...');
        stopCurrentAudio();
    } else {
        console.log('No audio currently playing, proceeding with new playback');
    }

    try {
        // For large audio files (>100k samples), use HTML5 Audio directly to avoid stack overflow
        const audioDataSize = window.currentAudioData.audioData.length;
        if (audioDataSize > 200000) { // Approximately 100k samples when base64 decoded
            console.log('Large audio detected, using HTML5 Audio directly');
            playWithHTML5Audio();
        } else {
            // Method 1: Try Web Audio API first for smaller files
            playWithWebAudio();
        }
    } catch (error) {
        console.error('Primary audio method failed, trying fallback:', error);
        // Method 2: Fallback to the other method
        try {
            const audioDataSize = window.currentAudioData.audioData.length;
            if (audioDataSize > 200000) {
                console.log('Fallback: Trying Web Audio API for large file');
                playWithWebAudio();
            } else {
                console.log('Fallback: Trying HTML5 Audio');
                playWithHTML5Audio();
            }
        } catch (fallbackError) {
            console.error('All audio playback methods failed:', fallbackError);
            showNotification('All audio playback methods failed', 'error');
            resetAudioButton();
            window.audioProcessing = false;
        }
    }
}

function playWithWebAudio() {
    console.log('Attempting Web Audio API playback...');
    
    // Set flag to prevent interruption during startup
    window.audioStarting = true;
    
    // Create fresh audio context each time
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    console.log('Audio context state:', audioContext.state);
    
    // Handle suspended context
    if (audioContext.state === 'suspended') {
        console.log('Audio context suspended, resuming...');
        audioContext.resume().then(() => {
            console.log('Audio context resumed successfully');
        }).catch(err => {
            console.error('Failed to resume audio context:', err);
        });
    }
    
    window.currentAudioContext = audioContext;

    // Convert base64 to Float32Array
    console.log('Converting base64 audio data...');
    const binaryString = atob(window.currentAudioData.audioData);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    const audioFloat32 = new Float32Array(bytes.buffer);
    console.log(`Audio data - Samples: ${audioFloat32.length}, Sample rate: ${window.currentAudioData.sampleRate}`);
    
    // Validate audio data (optimized for large arrays)
    let minVal = audioFloat32[0];
    let maxVal = audioFloat32[0];
    let avgVal = 0;
    
    for (let i = 0; i < audioFloat32.length; i++) {
        const val = audioFloat32[i];
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
        avgVal += Math.abs(val);
    }
    avgVal = avgVal / audioFloat32.length;
    
    console.log(`Audio range: ${minVal.toFixed(4)} to ${maxVal.toFixed(4)}, Average amplitude: ${avgVal.toFixed(4)}`);
    
    if (avgVal === 0) {
        console.warn('Audio data appears to be silent (all zeros)');
        throw new Error('Audio data is silent');
    }
    
    // Create audio buffer
    console.log('Creating audio buffer...');
    const buffer = audioContext.createBuffer(1, audioFloat32.length, window.currentAudioData.sampleRate);
    buffer.copyToChannel(audioFloat32, 0);
    console.log(`Audio buffer created - Duration: ${buffer.duration.toFixed(2)}s`);
    
    // Create source
    console.log('Creating audio source...');
    const source = audioContext.createBufferSource();
    window.currentAudioSource = source;
    source.buffer = buffer;
    source.connect(audioContext.destination);
    
    // Update UI
    updatePlayingState();
    
    // Event handlers with detailed logging
    source.onended = () => {
        console.log('Web Audio playback ended naturally');
        console.log('Clearing audio references after natural end');
        // Clear the current audio references
        window.currentAudioSource = null;
        window.currentAudioContext = null;
        resetAudioButton();
    };
    
    source.onerror = (error) => {
        console.error('Web Audio source error:', error);
        resetAudioButton();
        showNotification('Web Audio playback error', 'error');
    };
    
    // Add additional event listeners for debugging
    audioContext.onstatechange = () => {
        console.log('Audio context state changed to:', audioContext.state);
    };
    
    // Start playback
    console.log('Starting Web Audio playback...');
    try {
        source.start(0);
        console.log('Web Audio source started successfully');
        
        // Clear the startup flag after successful start
        window.audioStarting = false;
        window.audioProcessing = false;
        
        showNotification(`Playing with Web Audio API - Voice: ${window.currentAudioData.voiceId}`, 'info');
        
        // Set a timeout to check if audio is still playing after a short delay
        setTimeout(() => {
            if (window.currentAudioContext && window.currentAudioContext.state === 'running') {
                console.log('Audio context still running after 200ms');
            } else {
                console.warn('Audio context not running after 200ms, state:', 
                    window.currentAudioContext ? window.currentAudioContext.state : 'null');
            }
        }, 200);
        
    } catch (startError) {
        console.error('Failed to start Web Audio source:', startError);
        window.audioStarting = false;
        window.audioProcessing = false;
        resetAudioButton();
        throw startError;
    }
}

function playWithHTML5Audio() {
    console.log('Attempting HTML5 Audio playback...');
    
    // Convert Float32Array to WAV blob
    console.log('Converting to WAV format...');
    const audioFloat32 = convertBase64ToFloat32Array(window.currentAudioData.audioData);
    console.log(`HTML5 Audio data - Samples: ${audioFloat32.length}`);
    
    const wavBlob = createWavBlob(audioFloat32, window.currentAudioData.sampleRate);
    console.log(`WAV blob created - Size: ${wavBlob.size} bytes`);
    
    const audioUrl = URL.createObjectURL(wavBlob);
    console.log('Audio URL created:', audioUrl.substring(0, 50) + '...');
    
    // Create HTML5 audio element
    const audio = new Audio(audioUrl);
    window.currentAudioElement = audio;
    
    // Update UI
    updatePlayingState();
    
    // Event handlers with detailed logging
    audio.onloadstart = () => {
        console.log('HTML5 Audio: Load started');
    };
    
    audio.onloadedmetadata = () => {
        console.log(`HTML5 Audio: Metadata loaded - Duration: ${audio.duration.toFixed(2)}s`);
    };
    
    audio.onloadeddata = () => {
        console.log('HTML5 Audio: Data loaded');
    };
    
    audio.oncanplay = () => {
        console.log('HTML5 Audio: Can start playing');
    };
    
    audio.onplay = () => {
        console.log('HTML5 Audio: Playback started');
    };
    
    audio.onplaying = () => {
        console.log('HTML5 Audio: Actually playing');
    };
    
    audio.onpause = () => {
        console.log('HTML5 Audio: Paused');
    };
    
    audio.onended = () => {
        console.log('HTML5 Audio: Playback ended naturally');
        console.log('Clearing HTML5 audio references after natural end');
        // Clear the current audio references
        window.currentAudioElement = null;
        URL.revokeObjectURL(audioUrl);
        resetAudioButton();
    };
    
    audio.onerror = (error) => {
        console.error('HTML5 Audio error:', error);
        console.error('Audio error details:', {
            error: audio.error,
            networkState: audio.networkState,
            readyState: audio.readyState
        });
        URL.revokeObjectURL(audioUrl);
        resetAudioButton();
        showNotification('HTML5 Audio playback error', 'error');
    };
    
    audio.onstalled = () => {
        console.warn('HTML5 Audio: Stalled');
    };
    
    audio.onabort = () => {
        console.warn('HTML5 Audio: Aborted');
    };
    
    // Start playback
    console.log('Starting HTML5 Audio playback...');
    audio.play().then(() => {
        console.log('HTML5 Audio play() promise resolved');
        showNotification(`Playing with HTML5 Audio - Voice: ${window.currentAudioData.voiceId}`, 'info');
    }).catch(error => {
        console.error('HTML5 Audio play() promise rejected:', error);
        URL.revokeObjectURL(audioUrl);
        resetAudioButton();
        throw error;
    });
}

function convertBase64ToFloat32Array(base64Data) {
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    return new Float32Array(bytes.buffer);
}

function createWavBlob(audioFloat32, sampleRate) {
    const length = audioFloat32.length;
    const buffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(buffer);
    
    // WAV header
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, length * 2, true);
    
    // Convert float32 to int16
    let offset = 44;
    for (let i = 0; i < length; i++) {
        const sample = Math.max(-1, Math.min(1, audioFloat32[i]));
        view.setInt16(offset, sample * 0x7FFF, true);
        offset += 2;
    }
    
    return new Blob([buffer], { type: 'audio/wav' });
}

function stopCurrentAudio() {
    // Prevent stopping audio during startup
    if (window.audioStarting) {
        console.log('Ignoring stop request during audio startup');
        return;
    }
    
    console.log('Stopping current audio...');
    console.log('Stop called from:', new Error().stack);
    let stoppedSomething = false;
    
    // Stop Web Audio API source
    if (window.currentAudioSource) {
        try {
            window.currentAudioSource.stop();
            console.log('Stopped Web Audio source');
            stoppedSomething = true;
        } catch (e) {
            console.log('Web Audio source stop error (may be normal):', e.message);
        }
        window.currentAudioSource = null;
    }
    
    // Close Web Audio API context
    if (window.currentAudioContext && window.currentAudioContext.state !== 'closed') {
        try {
            window.currentAudioContext.close();
            console.log('Closed Web Audio context');
            stoppedSomething = true;
        } catch (e) {
            console.log('Web Audio context close error:', e.message);
        }
        window.currentAudioContext = null;
    }
    
    // Stop HTML5 audio
    if (window.currentAudioElement) {
        try {
            window.currentAudioElement.pause();
            window.currentAudioElement.currentTime = 0;
            console.log('Stopped HTML5 audio');
            stoppedSomething = true;
        } catch (e) {
            console.log('HTML5 audio stop error:', e.message);
        }
        window.currentAudioElement = null;
    }
    
    if (!stoppedSomething) {
        console.log('No audio was currently playing');
    }
    
    resetAudioButton();
}

function updatePlayingState() {
    console.log('Updating button to stop state');
    speakTextBtn.textContent = 'Stop Speaking';
    speakTextBtn.disabled = true; // Keep disabled initially
    speakTextBtn.style.opacity = '0.6';
    
    // Add a delay before making the stop button clickable
    // This prevents accidental clicks during the button state transition
    setTimeout(() => {
        if (speakTextBtn.textContent === 'Stop Speaking') {
            console.log('Enabling stop button after delay');
            speakTextBtn.disabled = false;
            speakTextBtn.style.opacity = '1';
            speakTextBtn.onclick = (event) => {
                console.log('Stop button clicked (after delay)');
                event.preventDefault();
                event.stopPropagation();
                stopCurrentAudio();
            };
        }
    }, 500); // 500ms delay
}

function resetAudioButton() {
    console.log('Resetting audio button to initial state');
    speakTextBtn.textContent = 'Listen';
    speakTextBtn.disabled = false;
    speakTextBtn.style.opacity = '1';
    speakTextBtn.style.background = ''; // Reset to default btn-success color
    speakTextBtn.onclick = speakText;
    window.audioProcessing = false;
}

// Initialize TTS button state and validate button state
updateTTSButtonState();
updateValidateButton();
deactivateCreationPanels();

console.log('LipSync page loaded successfully');
