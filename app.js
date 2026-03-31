/**
 * NanoBanana Pro LoRA Dataset Generator - Static Version
 * Uses FAL's official client SDK for browser compatibility
 */

// Import FAL client from CDN (named export)
import { fal } from 'https://esm.sh/@fal-ai/client@1.2.1';

// =============================================================================
// State
// =============================================================================

const state = {
    isGenerating: false,
    pairs: [], // Store generated pairs/images in memory
    pairCounter: 0,
    mode: 'pair', // 'pair', 'single', 'reference', or 'import-edit'
    referenceImageUrl: null, // URL of uploaded reference image
    referenceImageBase64: null, // Base64 of uploaded reference image
    importedImages: [] // Array of {file, base64, name} for import-edit mode
};

// Default system prompts for each mode
const DEFAULT_SYSTEM_PROMPTS = {
    pair: `You are a creative prompt engineer for AI image generation. Generate diverse, detailed prompts for creating training data.

RULES:
1. Each prompt must be unique and creative
2. base_prompt: Detailed description for generating the START image
3. edit_prompt: Instruction for transforming START → END image
4. action_name: Short identifier for this transformation type`,
    
    single: `You are a creative prompt engineer for AI image generation. Generate diverse, detailed prompts for creating style/aesthetic training data.

RULES:
1. Each prompt must be unique and creative
2. prompt: Detailed description capturing the desired aesthetic, style, composition, lighting, and mood
3. Focus on visual consistency and aesthetic qualities that define the style`,
    
    reference: `You are a creative prompt engineer for AI image generation. Generate diverse prompts for creating variations of a reference image.

RULES:
1. Each prompt must be unique while maintaining consistency with the reference
2. prompt: Detailed description for generating a variation that preserves key elements of the reference
3. Vary poses, angles, backgrounds, lighting, and contexts while keeping the subject recognizable`,

    'import-edit': `You are a creative AI assistant that describes image transformations. Given a transformation instruction, generate a clear and detailed edit prompt for each image.

RULES:
1. The edit prompt should be specific and actionable for an image editing AI
2. Describe the desired result clearly
3. Keep the subject recognizable while applying the transformation`
};

// =============================================================================
// API Key Management
// =============================================================================

function getApiKey() {
    return localStorage.getItem('fal_api_key') || '';
}

function setApiKey(key) {
    if (key) {
        localStorage.setItem('fal_api_key', key);
        // Configure FAL client with the key
        fal.config({ credentials: key });
    } else {
        localStorage.removeItem('fal_api_key');
    }
}

function showApiKeyModal() {
    document.getElementById('apiKeyModal').classList.remove('hidden');
    const input = document.getElementById('apiKeyInput');
    input.value = getApiKey();
    input.focus();
}

function hideApiKeyModal() {
    document.getElementById('apiKeyModal').classList.add('hidden');
}

function toggleKeyVisibility() {
    const input = document.getElementById('apiKeyInput');
    const icon = document.getElementById('keyVisibilityIcon');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = '🙈';
    } else {
        input.type = 'password';
        icon.textContent = '👁️';
    }
}

function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
        alert('Please enter an API key');
        return;
    }
    setApiKey(key);
    hideApiKeyModal();
    updateStatus(true, 'API Key Saved');
}

function clearApiKey() {
    if (confirm('Clear your API key?')) {
        setApiKey('');
        document.getElementById('apiKeyInput').value = '';
        updateStatus(false, 'No API Key');
    }
}

// =============================================================================
// Mode Management
// =============================================================================

function setMode(mode) {
    state.mode = mode;
    
    // Update UI buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    
    // Show/hide sections based on mode
    const transformSection = document.getElementById('transformationSection');
    const actionSection = document.getElementById('actionNameSection');
    const referenceSection = document.getElementById('referenceUploadSection');
    const themeSection = document.getElementById('themeSection');
    const importEditSection = document.getElementById('importEditSection');

    // Hide all optional sections first
    transformSection.classList.add('hidden');
    actionSection.classList.add('hidden');
    referenceSection.classList.add('hidden');
    if (importEditSection) importEditSection.classList.add('hidden');
    if (themeSection) themeSection.classList.remove('hidden');

    // Hide/show numPairs section based on mode
    const numPairsGroup = document.getElementById('numPairs')?.closest('.form-group');

    if (mode === 'import-edit') {
        if (importEditSection) importEditSection.classList.remove('hidden');
        if (themeSection) themeSection.classList.add('hidden');
        if (numPairsGroup) numPairsGroup.classList.add('hidden');
        transformSection.classList.add('hidden');
        actionSection.classList.add('hidden');
        document.getElementById('pairOrImageLabel').textContent = 'Images';
        document.getElementById('countLabel').textContent = 'edited pairs in memory';
        document.getElementById('progressLabel').textContent = 'images';
    } else {
        if (numPairsGroup) numPairsGroup.classList.remove('hidden');
    }

    if (mode === 'pair') {
        transformSection.classList.remove('hidden');
        actionSection.classList.remove('hidden');
        document.getElementById('pairOrImageLabel').textContent = 'Pairs';
        document.getElementById('countLabel').textContent = 'pairs in memory';
        document.getElementById('progressLabel').textContent = 'pairs';
    } else if (mode === 'single') {
        document.getElementById('pairOrImageLabel').textContent = 'Images';
        document.getElementById('countLabel').textContent = 'images in memory';
        document.getElementById('progressLabel').textContent = 'images';
    } else if (mode === 'reference') {
        referenceSection.classList.remove('hidden');
        document.getElementById('pairOrImageLabel').textContent = 'Images';
        document.getElementById('countLabel').textContent = 'images in memory';
        document.getElementById('progressLabel').textContent = 'images';
    }
    
    // Update cost estimate
    updateCostEstimate();
    
    // Update default system prompt placeholder
    updateSystemPromptPlaceholder();
}

function updateSystemPromptPlaceholder() {
    const textarea = document.getElementById('customSystemPrompt');
    textarea.placeholder = DEFAULT_SYSTEM_PROMPTS[state.mode];
}

function toggleSystemPrompt() {
    const section = document.getElementById('systemPromptSection');
    const icon = document.getElementById('systemPromptIcon');
    const isHidden = section.classList.contains('hidden');
    
    section.classList.toggle('hidden');
    icon.textContent = isHidden ? '▼' : '▶';
}

function resetSystemPrompt() {
    document.getElementById('customSystemPrompt').value = '';
}

function getSystemPrompt() {
    const custom = document.getElementById('customSystemPrompt').value.trim();
    return custom || DEFAULT_SYSTEM_PROMPTS[state.mode];
}

// =============================================================================
// Reference Image Upload
// =============================================================================

function handleReferenceUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        state.referenceImageBase64 = e.target.result;
        
        // Show preview
        const preview = document.getElementById('referencePreview');
        const placeholder = document.getElementById('uploadPlaceholder');
        const clearBtn = document.getElementById('clearRefBtn');
        
        preview.src = e.target.result;
        preview.classList.remove('hidden');
        placeholder.classList.add('hidden');
        clearBtn.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function clearReference() {
    state.referenceImageBase64 = null;
    state.referenceImageUrl = null;
    
    const preview = document.getElementById('referencePreview');
    const placeholder = document.getElementById('uploadPlaceholder');
    const clearBtn = document.getElementById('clearRefBtn');
    const input = document.getElementById('referenceInput');
    
    preview.classList.add('hidden');
    preview.src = '';
    placeholder.classList.remove('hidden');
    clearBtn.style.display = 'none';
    input.value = '';
}

// Upload reference image to FAL storage
async function uploadReferenceImage() {
    if (!state.referenceImageBase64) return null;
    
    // Convert base64 to blob
    const response = await fetch(state.referenceImageBase64);
    const blob = await response.blob();
    
    // Upload to FAL
    const url = await fal.storage.upload(blob);
    state.referenceImageUrl = url;
    return url;
}

// =============================================================================
// FAL API Calls using official SDK
// =============================================================================

async function falRequest(endpoint, input, maxRetries = 3) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('Please add your FAL API key first');
    }

    fal.config({ credentials: apiKey });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`FAL request to ${endpoint} (attempt ${attempt}):`, input);
            const result = await fal.subscribe(endpoint, { input });
            console.log(`FAL response from ${endpoint}:`, result);
            return result.data || result;
        } catch (error) {
            const isTimeout = error.status === 408 || (error.message && error.message.includes('408'));
            const isRetryable = isTimeout || error.status === 429 || error.status >= 500;

            if (isRetryable && attempt < maxRetries) {
                const delay = attempt * 2000;
                console.warn(`FAL ${endpoint} attempt ${attempt} failed (${error.status || error.message}), retrying in ${delay}ms...`);
                await sleep(delay);
                continue;
            }
            console.error(`FAL error for ${endpoint}:`, error);
            throw new Error(error.message || error.body?.detail || 'FAL API call failed');
        }
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Image Generation
// =============================================================================

let _imageModelOverride = null;

function getImageModel() {
    return _imageModelOverride || document.getElementById('imageModel')?.value || 'nano-banana-pro';
}

async function generateStartImage(prompt, aspectRatio, resolution) {
    const model = getImageModel();
    const result = await falRequest(`fal-ai/${model}`, {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        resolution: resolution,
        num_images: 1
    });

    return result.images[0].url;
}

async function generateEndImage(startImageUrl, editPrompt, aspectRatio, resolution) {
    const model = getImageModel();
    const result = await falRequest(`fal-ai/${model}/edit`, {
        image_urls: [startImageUrl],
        prompt: editPrompt,
        aspect_ratio: 'auto',
        resolution: resolution
    });

    return result.images[0].url;
}

async function generateSingleImage(prompt, aspectRatio, resolution) {
    const model = getImageModel();
    const result = await falRequest(`fal-ai/${model}`, {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        resolution: resolution,
        num_images: 1
    });

    return result.images[0].url;
}

async function generateReferenceVariation(referenceUrl, prompt, aspectRatio, resolution) {
    const model = getImageModel();
    const result = await falRequest(`fal-ai/${model}/edit`, {
        image_urls: [referenceUrl],
        prompt: prompt,
        aspect_ratio: 'auto',
        resolution: resolution
    });

    return result.images[0].url;
}

async function captionImage(imageUrl, model) {
    const result = await falRequest('openrouter/router/vision', {
        model: model,
        prompt: "Caption this image for a text-to-image model. Describe everything visible in detail: subject, appearance, clothing, pose, expression, background, lighting, colors, style. Be specific and comprehensive.",
        system_prompt: "Only answer the question, do not provide any additional information. Don't use markdown.",
        image_urls: [imageUrl],  // Must be array!
        temperature: 1.0
    });
    
    return result.output;
}

async function captionEditPair(startUrl, endUrl, model) {
    const result = await falRequest('openrouter/router/vision', {
        model: model,
        prompt: "You are looking at two images: the BEFORE (first) and AFTER (second). Describe the edit/transformation that was applied to go from the first image to the second. Be concise and specific. Example: 'Replace the background with a sunset beach' or 'Add a vintage film grain filter'.",
        system_prompt: "Only describe the transformation between the two images in one sentence. Don't use markdown. Be direct and concise.",
        image_urls: [startUrl, endUrl],
        temperature: 0.5
    });

    return result.output;
}

// =============================================================================
// LLM Prompt Generation
// =============================================================================

async function generatePromptsWithLLM(theme, transformation, actionName, numPrompts, model) {
    const customSystemPrompt = getSystemPrompt();
    
    if (state.mode === 'pair') {
        // Pair mode - generate base_prompt + edit_prompt
        const actionHint = actionName 
            ? `Use this action name: "${actionName}"` 
            : 'Generate a short, descriptive action name (like "unzoom", "add_bg", "enhance")';
        
        const systemPrompt = `${customSystemPrompt}

The transformation to learn: "${transformation}"
${actionHint}`;

        const userPrompt = `Generate ${numPrompts} unique prompt pairs for the theme: "${theme}"

Return ONLY valid JSON array:
[
  {
    "base_prompt": "detailed start image description...",
    "edit_prompt": "transformation instruction...",
    "action_name": "short_action"
  }
]`;

        const result = await falRequest('fal-ai/any-llm', {
            model: model,
            system_prompt: systemPrompt,
            prompt: userPrompt,
            max_tokens: 16000
        });
        
        const text = result.output;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Failed to parse LLM response');
        }
        
        return JSON.parse(jsonMatch[0]);
        
    } else if (state.mode === 'single') {
        // Single mode - generate just prompts for style/aesthetic images
        const systemPrompt = customSystemPrompt;

        const userPrompt = `Generate ${numPrompts} unique image prompts for the theme/style: "${theme}"

Return ONLY valid JSON array:
[
  {
    "prompt": "detailed image description capturing the style, aesthetic, composition, lighting, colors..."
  }
]`;

        const result = await falRequest('fal-ai/any-llm', {
            model: model,
            system_prompt: systemPrompt,
            prompt: userPrompt,
            max_tokens: 16000
        });
        
        const text = result.output;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Failed to parse LLM response');
        }
        
        return JSON.parse(jsonMatch[0]);
        
    } else if (state.mode === 'reference') {
        // Reference mode - generate prompts for variations of reference image
        const systemPrompt = customSystemPrompt;

        const userPrompt = `Generate ${numPrompts} unique variation prompts for: "${theme}"

These prompts will be used to create variations of a reference image (character/product/style).
Each prompt should describe a different scenario, pose, angle, background, or context while keeping the subject consistent.

Return ONLY valid JSON array:
[
  {
    "prompt": "detailed description of the variation, keeping subject consistent but varying context..."
  }
]`;

        const result = await falRequest('fal-ai/any-llm', {
            model: model,
            system_prompt: systemPrompt,
            prompt: userPrompt,
            max_tokens: 16000
        });
        
        const text = result.output;
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
            throw new Error('Failed to parse LLM response');
        }
        
        return JSON.parse(jsonMatch[0]);
    }
}

// =============================================================================
// UI Functions
// =============================================================================

function updateStatus(connected, message) {
    document.getElementById('statusDot').className = 'status-dot ' + (connected ? 'connected' : 'error');
    document.getElementById('statusText').textContent = message;
}

function updatePairCount() {
    document.getElementById('pairCount').textContent = state.pairs.length;
}

function getImageCost() {
    const resolution = document.getElementById('resolution').value;
    return resolution === '4K' ? 0.30 : 0.15;
}

function updateCostEstimate() {
    const useVision = document.getElementById('useVisionCaption').checked;
    const resolution = document.getElementById('resolution').value;
    const imageCost = getImageCost();

    if (state.mode === 'import-edit') {
        const numImages = state.importedImages.length || 0;
        const editCost = numImages * imageCost;
        const visionCost = useVision ? numImages * 0.002 : 0;
        const total = editCost + visionCost;
        const resLabel = resolution === '4K' ? ' @4K' : '';
        document.getElementById('costEstimate').textContent = numImages > 0
            ? `~$${total.toFixed(2)} (${numImages} images)${resLabel}`
            : 'Import images first';
        return;
    }

    const numPairs = parseInt(document.getElementById('numPairs').value) || 20;
    let imagesPerItem = state.mode === 'pair' ? 2 : 1;

    const baseCost = numPairs * (imagesPerItem * imageCost);
    const visionCost = useVision ? numPairs * 0.002 : 0;
    const llmCost = 0.02;
    const total = baseCost + visionCost + llmCost;

    const resLabel = resolution === '4K' ? ' @4K' : '';
    document.getElementById('costEstimate').textContent = `~$${total.toFixed(2)}${resLabel}`;
}

function showLoading(show, message = 'Generating...') {
    state.isGenerating = show;
    const loader = document.getElementById('loadingIndicator');
    loader.classList.toggle('hidden', !show);
    loader.querySelector('span').textContent = message;
}

function showProgress(show) {
    document.getElementById('progressPanel').classList.toggle('hidden', !show);
}

function updateProgress(current, total, status) {
    const percent = total > 0 ? (current / total) * 100 : 0;
    document.getElementById('progressFill').style.width = `${percent}%`;
    document.getElementById('progressCurrent').textContent = current;
    document.getElementById('progressTotal').textContent = total;
    document.getElementById('progressStatus').textContent = status;
}

function addProgressLog(message, type = 'info') {
    const log = document.getElementById('progressLog');
    const entry = document.createElement('div');
    entry.className = `log-entry log-${type}`;
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

function clearProgressLog() {
    document.getElementById('progressLog').innerHTML = '';
}

function addResultCard(item) {
    const container = document.getElementById('results');
    const card = document.createElement('div');
    card.className = 'result-card';
    
    if (item.mode === 'pair') {
        // Pair mode - show START and END images
        card.innerHTML = `
            <div class="result-header">
                <span class="result-id">#${item.id}</span>
            </div>
            <div class="result-images">
                <div class="result-image">
                    <span class="label">START</span>
                    <img src="${item.startUrl}" alt="Start" loading="eager">
                </div>
                <div class="result-image">
                    <span class="label">END</span>
                    <img src="${item.endUrl}" alt="End" loading="eager">
                </div>
            </div>
        `;
    } else {
        // Single/Reference mode - show single image
        card.innerHTML = `
            <div class="result-header">
                <span class="result-id">#${item.id}</span>
            </div>
            <div class="result-images single">
                <div class="result-image">
                    <img src="${item.imageUrl}" alt="Generated" loading="eager">
                </div>
            </div>
        `;
    }
    
    container.insertBefore(card, container.firstChild);
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function truncate(str, length) {
    if (!str) return '';
    return str.length > length ? str.substring(0, length) + '...' : str;
}

// =============================================================================
// Main Generation Function
// =============================================================================

// Generate a single pair (used for parallel execution) - PAIR MODE
async function generateSinglePair(prompt, index, total, aspectRatio, resolution, useVision, llmModel, triggerWord) {
    addProgressLog(`🎨 [${index + 1}/${total}] Starting: ${truncate(prompt.base_prompt, 35)}...`, 'info');
    
    try {
        // Generate START image
        addProgressLog(`   [${index + 1}] Generating START image...`, 'info');
        const startUrl = await generateStartImage(prompt.base_prompt, aspectRatio, resolution);
        addProgressLog(`   [${index + 1}] START done, generating END...`, 'info');
        
        // Generate END image
        const endUrl = await generateEndImage(startUrl, prompt.edit_prompt, aspectRatio, resolution);
        addProgressLog(`   [${index + 1}] END done!`, 'info');
        
        // Caption: describe the transformation between START and END
        let finalText = prompt.action_name;
        if (useVision) {
            try {
                const caption = await captionEditPair(startUrl, endUrl, llmModel);
                finalText = caption;
            } catch (e) {
                console.warn('Vision caption failed:', e);
            }
        }
        
        // Add trigger word if specified
        if (triggerWord) {
            finalText = `${triggerWord} ${finalText}`;
        }
        
        return {
            startUrl,
            endUrl,
            startPrompt: prompt.base_prompt,
            endPrompt: prompt.edit_prompt,
            actionName: prompt.action_name,
            text: finalText
        };
    } catch (error) {
        console.error(`Pair ${index + 1} error:`, error);
        throw new Error(error.message || error.toString() || 'Generation failed');
    }
}

// Generate a single image - SINGLE MODE
async function generateSingleItem(prompt, index, total, aspectRatio, resolution, useVision, llmModel, triggerWord) {
    addProgressLog(`🎨 [${index + 1}/${total}] Generating: ${truncate(prompt.prompt, 40)}...`, 'info');
    
    try {
        const imageUrl = await generateSingleImage(prompt.prompt, aspectRatio, resolution);
        addProgressLog(`   [${index + 1}] Image done!`, 'info');
        
        // Caption with vision
        let finalText = prompt.prompt;
        if (useVision) {
            try {
                const caption = await captionImage(imageUrl, llmModel);
                finalText = caption;
            } catch (e) {
                console.warn('Vision caption failed:', e);
            }
        }
        
        // Add trigger word if specified
        if (triggerWord) {
            finalText = `${triggerWord} ${finalText}`;
        }
        
        return {
            imageUrl,
            prompt: prompt.prompt,
            text: finalText
        };
    } catch (error) {
        console.error(`Image ${index + 1} error:`, error);
        throw new Error(error.message || error.toString() || 'Generation failed');
    }
}

// Generate a reference variation - REFERENCE MODE
async function generateReferenceItem(prompt, index, total, referenceUrl, aspectRatio, resolution, useVision, llmModel, triggerWord) {
    addProgressLog(`🎨 [${index + 1}/${total}] Variation: ${truncate(prompt.prompt, 40)}...`, 'info');
    
    try {
        const imageUrl = await generateReferenceVariation(referenceUrl, prompt.prompt, aspectRatio, resolution);
        addProgressLog(`   [${index + 1}] Variation done!`, 'info');
        
        // Caption with vision
        let finalText = prompt.prompt;
        if (useVision) {
            try {
                const caption = await captionImage(imageUrl, llmModel);
                finalText = caption;
            } catch (e) {
                console.warn('Vision caption failed:', e);
            }
        }
        
        // Add trigger word if specified
        if (triggerWord) {
            finalText = `${triggerWord} ${finalText}`;
        }
        
        return {
            imageUrl,
            prompt: prompt.prompt,
            text: finalText
        };
    } catch (error) {
        console.error(`Variation ${index + 1} error:`, error);
        throw new Error(error.message || error.toString() || 'Generation failed');
    }
}

// =============================================================================
// Import + Edit Mode
// =============================================================================

async function handleImportUpload(event) {
    const files = Array.from(event.target.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
        alert('No images found in the selected folder');
        return;
    }

    state.importedImages = [];
    const previewList = document.getElementById('importPreviewList');
    previewList.innerHTML = '';
    previewList.classList.remove('hidden');
    document.getElementById('clearImportBtn').style.display = 'block';

    document.getElementById('importPlaceholder').innerHTML = `
        <span class="upload-icon">⏳</span>
        <span>Loading ${files.length} images...</span>
    `;

    // Load all files and wait for completion
    const loadPromises = files.map(file => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imgData = { file, base64: e.target.result, name: file.name };
            state.importedImages.push(imgData);

            const thumb = document.createElement('div');
            thumb.className = 'import-thumb';
            const img = document.createElement('img');
            img.src = e.target.result;
            img.alt = file.name;
            const span = document.createElement('span');
            span.textContent = file.name;
            thumb.appendChild(img);
            thumb.appendChild(span);
            previewList.appendChild(thumb);

            resolve();
        };
        reader.onerror = () => {
            console.warn(`Failed to read file: ${file.name}`);
            resolve(); // Skip bad files, don't hang
        };
        reader.readAsDataURL(file);
    }));

    await Promise.all(loadPromises);

    document.getElementById('importPlaceholder').innerHTML = `
        <span class="upload-icon">✅</span>
        <span>${state.importedImages.length} images loaded</span>
        <small>Click to change folder</small>
    `;
    updateCostEstimate();
}

function clearImportedImages() {
    state.importedImages = [];
    document.getElementById('importPreviewList').innerHTML = '';
    document.getElementById('importPreviewList').classList.add('hidden');
    document.getElementById('clearImportBtn').style.display = 'none';
    document.getElementById('importInput').value = '';
    document.getElementById('importPlaceholder').innerHTML = `
        <span class="upload-icon">📂</span>
        <span>Click to select a folder of images</span>
        <small>All images in the folder will be imported</small>
    `;
    updateCostEstimate();
}

async function generateImportEditItem(importedImage, transformation, index, total, resolution, useVision, llmModel, triggerWord) {
    addProgressLog(`🎨 [${index + 1}/${total}] Editing: ${importedImage.name}...`, 'info');

    try {
        // Upload the imported image to fal storage
        const blob = await fetch(importedImage.base64).then(r => r.blob());
        const startUrl = await fal.storage.upload(blob);

        // Apply the transformation using the edit endpoint
        addProgressLog(`   [${index + 1}] Applying transformation...`, 'info');
        const endUrl = await generateEndImage(startUrl, transformation, 'auto', resolution);
        addProgressLog(`   [${index + 1}] Edit done!`, 'info');

        // Generate caption describing the edit/transformation
        let finalText = transformation;
        if (useVision) {
            try {
                const caption = await captionEditPair(startUrl, endUrl, llmModel);
                finalText = caption;
            } catch (e) {
                console.warn('Vision caption failed:', e);
            }
        }

        if (triggerWord) {
            finalText = `${triggerWord} ${finalText}`;
        }

        return {
            startUrl,
            endUrl,
            text: finalText,
            originalName: importedImage.name
        };
    } catch (error) {
        console.error(`Import edit ${index + 1} error:`, error);
        throw new Error(error.message || error.toString() || 'Edit failed');
    }
}

async function startGeneration() {
    const numPairsInput = document.getElementById('numPairs');
    const numPairs = parseInt(numPairsInput.value) || 20;
    const theme = document.getElementById('theme').value.trim();
    const transformation = document.getElementById('transformation').value.trim();
    const actionName = document.getElementById('actionName').value.trim();
    const triggerWord = document.getElementById('triggerWord').value.trim();
    const maxConcurrent = parseInt(document.getElementById('maxConcurrent')?.value) || 3;
    const aspectRatio = document.getElementById('aspectRatio').value;
    const resolution = document.getElementById('resolution').value;
    const useVision = document.getElementById('useVisionCaption').checked;
    const llmModel = document.getElementById('llmModel').value;

    // Validate based on mode
    if (state.mode === 'import-edit') {
        const importTransformation = document.getElementById('importTransformation')?.value?.trim();
        if (!importTransformation) {
            alert('Please describe the transformation to apply');
            return;
        }
        if (state.importedImages.length === 0) {
            alert('Please import a folder of images first');
            return;
        }
    } else {
        // Strict validation - block if over 40 (only for non-import-edit modes)
        if (numPairs > 40) {
            alert('⚠️ Maximum 40 pairs allowed!\n\nPlease enter a number between 1 and 40.\n\nIf you need more pairs, run multiple generations - they will accumulate in memory.');
            numPairsInput.value = 40;
            numPairsInput.focus();
            return;
        }
        if (!theme) {
            alert('Please fill in the dataset theme');
            return;
        }
    }

    if (state.mode === 'pair' && !transformation) {
        alert('Please fill in the transformation to learn');
        return;
    }

    if (state.mode === 'reference' && !state.referenceImageBase64) {
        alert('Please upload a reference image');
        return;
    }

    if (!getApiKey()) {
        showApiKeyModal();
        return;
    }
    
    // Import-edit mode has its own flow
    if (state.mode === 'import-edit') {
        const importTransformation = document.getElementById('importTransformation').value.trim();
        // Snapshot images so clearing/reloading mid-run can't corrupt the loop
        const imagesToProcess = [...state.importedImages];
        const totalImages = imagesToProcess.length;
        const editCost = totalImages * getImageCost();
        const visionCost = useVision ? totalImages * 0.002 : 0;
        const cost = (editCost + visionCost).toFixed(2);

        if (!confirm(`Edit ${totalImages} imported images?\n\n⚡ ${maxConcurrent} parallel requests\n💰 Estimated cost: ~$${cost}\n\nImages stored in memory.\nUse "Download ZIP" to save.`)) {
            return;
        }

        showProgress(true);
        clearProgressLog();
        updateProgress(0, totalImages, 'Starting edits...');
        addProgressLog(`📂 Processing ${totalImages} imported images...`, 'info');

        _imageModelOverride = getImageModel();
        state.isGenerating = true;
        let completed = 0;
        let failed = 0;

        try {
            for (let i = 0; i < imagesToProcess.length; i += maxConcurrent) {
                if (!state.isGenerating) break;

                const batch = imagesToProcess.slice(i, Math.min(i + maxConcurrent, totalImages));
                const results = await Promise.allSettled(
                    batch.map((img, batchIndex) =>
                        generateImportEditItem(img, importTransformation, i + batchIndex, totalImages, resolution, useVision, llmModel, triggerWord)
                    )
                );

                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        state.pairCounter++;
                        const item = {
                            id: String(state.pairCounter).padStart(4, '0'),
                            mode: 'pair',
                            ...result.value
                        };
                        state.pairs.push(item);
                        addResultCard(item);
                        updatePairCount();
                        completed++;
                        addProgressLog(`✅ #${item.id} complete (${result.value.originalName})`, 'success');
                    } else {
                        failed++;
                        addProgressLog(`❌ Failed: ${result.reason?.message || 'Unknown error'}`, 'error');
                    }
                    updateProgress(completed + failed, totalImages, `${completed}/${totalImages} done`);
                }
            }

            const failInfo = failed > 0 ? ` (${failed} failed)` : '';
            updateProgress(totalImages, totalImages, 'Complete!');
            addProgressLog(`🎉 Done! ${completed} images edited${failInfo}`, 'success');
            addProgressLog(`📥 Click "Download ZIP" to save your dataset`, 'info');
        } catch (error) {
            addProgressLog(`❌ Error: ${error.message}`, 'error');
            alert('Error: ' + error.message);
        } finally {
            state.isGenerating = false;
            _imageModelOverride = null;
        }
        return;
    }

    // Capture mode at start to avoid issues if user switches mode mid-generation
    const currentMode = state.mode;

    // Confirm
    let imagesPerItem = currentMode === 'pair' ? 2 : 1;
    let modeLabel = currentMode === 'pair' ? 'pairs' : 'images';

    const cost = (numPairs * imagesPerItem * getImageCost() + 0.02).toFixed(2);
    if (!confirm(`Generate ${numPairs} ${modeLabel}?\n\n⚡ ${maxConcurrent} parallel requests\n💰 Estimated cost: ~$${cost}\n\nImages stored in memory.\nUse "Download ZIP" to save.`)) {
        return;
    }

    showProgress(true);
    clearProgressLog();
    updateProgress(0, numPairs, 'Generating prompts with AI...');
    addProgressLog('🤖 Generating creative prompts...', 'info');

    _imageModelOverride = getImageModel();
    state.isGenerating = true;
    let completed = 0;
    let failed = 0;

    try {
        // Upload reference image if in reference mode
        let referenceUrl = null;
        if (currentMode === 'reference') {
            addProgressLog('📤 Uploading reference image...', 'info');
            referenceUrl = await uploadReferenceImage();
            addProgressLog('✅ Reference uploaded', 'success');
        }

        // Generate prompts
        const prompts = await generatePromptsWithLLM(theme, transformation, actionName, numPairs, llmModel);
        addProgressLog(`✅ Generated ${prompts.length} unique prompts`, 'success');
        addProgressLog(`⚡ Starting parallel generation (${maxConcurrent} at a time)...`, 'info');
        
        // Process in batches of maxConcurrent
        for (let i = 0; i < prompts.length; i += maxConcurrent) {
            if (!state.isGenerating) break;
            
            const batch = prompts.slice(i, Math.min(i + maxConcurrent, prompts.length));
            
            // Run batch in parallel based on captured mode
            let results;
            if (currentMode === 'pair') {
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateSinglePair(p, i + batchIndex, prompts.length, aspectRatio, resolution, useVision, llmModel, triggerWord)
                    )
                );
            } else if (currentMode === 'single') {
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateSingleItem(p, i + batchIndex, prompts.length, aspectRatio, resolution, useVision, llmModel, triggerWord)
                    )
                );
            } else if (currentMode === 'reference') {
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateReferenceItem(p, i + batchIndex, prompts.length, referenceUrl, aspectRatio, resolution, useVision, llmModel, triggerWord)
                    )
                );
            }
            
            // Process results
            for (let j = 0; j < results.length; j++) {
                const result = results[j];
                if (result.status === 'fulfilled') {
                    state.pairCounter++;
                    const item = {
                        id: String(state.pairCounter).padStart(4, '0'),
                        mode: currentMode,
                        ...result.value
                    };
                    state.pairs.push(item);
                    addResultCard(item);
                    updatePairCount();
                    completed++;
                    addProgressLog(`✅ #${item.id} complete`, 'success');
                } else {
                    failed++;
                    addProgressLog(`❌ ${i + j + 1} failed: ${result.reason?.message || 'Unknown error'}`, 'error');
                }
                updateProgress(completed + failed, prompts.length, `${completed}/${prompts.length} done`);
            }
        }
        
        const failInfo = failed > 0 ? ` (${failed} failed)` : '';
        updateProgress(prompts.length, prompts.length, 'Complete!');
        addProgressLog(`🎉 Done! ${completed} ${modeLabel} generated${failInfo}`, 'success');
        addProgressLog(`📥 Click "Download ZIP" to save your dataset`, 'info');
        
    } catch (error) {
        addProgressLog(`❌ Error: ${error.message}`, 'error');
        alert('Error: ' + error.message);
    } finally {
        state.isGenerating = false;
        _imageModelOverride = null;
    }
}

function stopGeneration() {
    state.isGenerating = false;
    _imageModelOverride = null;
    addProgressLog('⏹️ Stopped by user', 'info');
}

// =============================================================================
// ZIP Download
// =============================================================================

async function downloadZIP() {
    if (state.pairs.length === 0) {
        alert('No images to download! Generate some first.');
        return;
    }
    
    // IMPORTANT: Snapshot the pairs array to avoid issues with concurrent generations
    // This ensures the ZIP contains exactly what was in memory when download was clicked
    const pairsSnapshot = [...state.pairs];
    const itemCount = pairsSnapshot.length;
    
    showLoading(true, `Creating ZIP with ${itemCount} items...`);
    
    try {
        // Dynamic import JSZip
        const JSZip = (await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm')).default;
        const zip = new JSZip();
        
        // Download and add each item from snapshot
        for (let i = 0; i < pairsSnapshot.length; i++) {
            const item = pairsSnapshot[i];
            showLoading(true, `Adding item ${i + 1}/${itemCount} to ZIP...`);
            
            if (item.mode === 'pair' || (item.startUrl && item.endUrl)) {
                // Pair mode - two images
                const startBlob = await fetch(item.startUrl).then(r => r.blob());
                const endBlob = await fetch(item.endUrl).then(r => r.blob());
                
                zip.file(`${item.id}_start.png`, startBlob);
                zip.file(`${item.id}_end.png`, endBlob);
                zip.file(`${item.id}.txt`, item.text);
            } else {
                // Single/Reference mode - one image
                const imageBlob = await fetch(item.imageUrl).then(r => r.blob());
                
                zip.file(`${item.id}.png`, imageBlob);
                zip.file(`${item.id}.txt`, item.text);
            }
        }
        
        // Generate and download
        showLoading(true, 'Compressing ZIP...');
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        
        const filename = `nanobanana_dataset_${Date.now()}.zip`;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
    } catch (error) {
        alert('Error creating ZIP: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function clearResults() {
    if (state.pairs.length === 0) return;
    if (!confirm(`Clear all ${state.pairs.length} items from memory?`)) return;
    
    state.pairs = [];
    state.pairCounter = 0;
    document.getElementById('results').innerHTML = '';
    updatePairCount();
}

// =============================================================================
// Initialization
// =============================================================================

function init() {
    // Check for API key and configure FAL
    const apiKey = getApiKey();
    if (apiKey) {
        fal.config({ credentials: apiKey });
        updateStatus(true, 'API Key Set');
    } else {
        updateStatus(false, 'Click 🔑 to add API key');
        setTimeout(() => showApiKeyModal(), 500);
    }
    
    // Setup cost estimate
    document.getElementById('numPairs').addEventListener('input', updateCostEstimate);
    document.getElementById('useVisionCaption').addEventListener('change', updateCostEstimate);
    document.getElementById('resolution').addEventListener('change', updateCostEstimate);
    document.getElementById('imageModel')?.addEventListener('change', updateCostEstimate);
    
    
    updateCostEstimate();
    
    // Initialize mode
    setMode('pair');
    
    updatePairCount();
    
    // Setup drag and drop for reference image
    const uploadZone = document.getElementById('uploadZone');
    if (uploadZone) {
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });
        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });
        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                document.getElementById('referenceInput').files = e.dataTransfer.files;
                handleReferenceUpload({ target: { files: [file] } });
            }
        });
    }
}

// Export to global scope for onclick handlers
window.showApiKeyModal = showApiKeyModal;
window.hideApiKeyModal = hideApiKeyModal;
window.toggleKeyVisibility = toggleKeyVisibility;
window.saveApiKey = saveApiKey;
window.clearApiKey = clearApiKey;
window.startGeneration = startGeneration;
window.stopGeneration = stopGeneration;
window.downloadZIP = downloadZIP;
window.clearResults = clearResults;
window.setMode = setMode;
window.toggleSystemPrompt = toggleSystemPrompt;
window.resetSystemPrompt = resetSystemPrompt;
window.handleReferenceUpload = handleReferenceUpload;
window.clearReference = clearReference;
window.handleImportUpload = handleImportUpload;
window.clearImportedImages = clearImportedImages;

document.addEventListener('DOMContentLoaded', init);
