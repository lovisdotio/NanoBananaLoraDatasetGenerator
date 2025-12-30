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
    mode: 'pair', // 'pair', 'single', 'reference', or 'layered'
    referenceImageUrl: null, // URL of uploaded reference image
    referenceImageBase64: null // Base64 of uploaded reference image
};

// Layered mode presets - complete form configurations
// IMPORTANT: All presets use 1:1 aspect ratio and 2x2 grid (4 elements) to ensure square cells when splitting
const LAYERED_PRESETS = {
    character: {
        name: 'Character Design',
        elements: [
            'anime character head with detailed face, hair, and expression, front view, centered, on pure white background',
            'torso with detailed clothing, shirt or jacket, front view, centered, on pure white background',
            'legs with pants or skirt, detailed fabric texture, front view, centered, on pure white background',
            'feet with stylish shoes or boots, detailed footwear, front view, centered, on pure white background'
        ],
        finalPrompt: 'complete full body anime character standing in confident pose, front view, cohesive style, professional character art, centered composition',
        aspectRatio: '1:1',
        resolution: '2K',
        triggerWord: 'CHARDESIGN',
        numSets: 5
    },
    architecture: {
        name: 'Architecture',
        elements: [
            'modern luxury house or villa, detailed facade with windows doors and roof, architectural rendering style, centered, on pure white background',
            'green trees and landscaping vegetation, realistic bushes and plants, garden elements, centered, on pure white background',
            'people walking or standing in casual clothing, lifestyle figures, realistic scale, centered, on pure white background',
            'modern car parked, SUV or sedan with details, realistic vehicle, centered, on pure white background'
        ],
        finalPrompt: 'complete architectural visualization, modern luxury house exterior with landscaping garden, people walking, car parked in driveway, blue sky background, professional real estate photography',
        aspectRatio: '1:1',
        resolution: '2K',
        triggerWord: 'ARCHVIZ',
        numSets: 5
    },
    food: {
        name: 'Food Composition',
        elements: [
            'main protein ingredient like steak or fish, cooked to perfection, detailed texture, centered, on pure white background',
            'side dish like roasted vegetables or rice, colorful and fresh, centered, on pure white background',
            'garnish and herbs, fresh parsley basil or microgreens, decorative, centered, on pure white background',
            'sauce or dressing drizzle, glossy and appetizing, artistic splash, centered, on pure white background'
        ],
        finalPrompt: 'complete gourmet plated dish, professional food photography, elegant presentation on white plate, soft lighting, restaurant quality, top view',
        aspectRatio: '1:1',
        resolution: '2K',
        triggerWord: 'FOODPHOTO',
        numSets: 5
    },
    interior: {
        name: 'Interior Design',
        elements: [
            'main furniture piece like modern sofa or bed, elegant design, detailed upholstery, centered, on pure white background',
            'secondary furniture like coffee table or side table, matching minimalist style, centered, on pure white background',
            'decorative items like vases lamp or artwork, stylish home accessories, centered, on pure white background',
            'indoor plant in ceramic pot, lush green foliage, adds life to space, centered, on pure white background'
        ],
        finalPrompt: 'complete modern interior living room scene, cohesive Scandinavian design, natural lighting from window, interior design magazine quality, architectural digest style',
        aspectRatio: '1:1',
        resolution: '2K',
        triggerWord: 'INTERIOR',
        numSets: 5
    },
    fashion: {
        name: 'Fashion/Outfit',
        elements: [
            'stylish designer top or blouse, detailed fabric texture and design, fashion photography style, centered, on pure white background',
            'bottom garment like tailored pants or elegant skirt, matching style, detailed texture, centered, on pure white background',
            'fashionable designer shoes or heels, luxury footwear with details, centered, on pure white background',
            'fashion accessory like designer handbag or statement jewelry, luxury brand style, centered, on pure white background'
        ],
        finalPrompt: 'complete fashion outfit flat lay arrangement, editorial style, professional fashion photography, vogue magazine quality, studio lighting, white background',
        aspectRatio: '1:1',
        resolution: '2K',
        triggerWord: 'FASHION',
        numSets: 5
    },
    product: {
        name: 'Product Photography',
        elements: [
            'main product hero shot, sleek modern design, detailed and sharp, commercial photography, centered, on pure white background',
            'product packaging or premium box, branded and professional design, centered, on pure white background',
            'product accessory or complementary attachment, matching style, centered, on pure white background',
            'brand logo badge or label element, subtle elegant branding, centered, on pure white background'
        ],
        finalPrompt: 'complete product photography composition with all elements arranged, commercial studio lighting, e-commerce quality, Amazon hero image style, clean white background',
        aspectRatio: '1:1',
        resolution: '2K',
        triggerWord: 'PRODUCT',
        numSets: 5
    },
    custom: {
        name: 'Custom',
        elements: [
            'element 1 description, centered, on pure white background',
            'element 2 description, centered, on pure white background', 
            'element 3 description, centered, on pure white background', 
            'element 4 description, centered, on pure white background'
        ],
        finalPrompt: 'complete assembled image with all elements combined cohesively, professional quality',
        aspectRatio: '1:1',
        resolution: '1K',
        triggerWord: '',
        numSets: 3
    }
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

    layered: `You are a creative prompt engineer for AI image generation. Generate prompts for creating grid images with separated elements that will be assembled into a final composition.

RULES:
1. Each element prompt should describe ONE specific isolated element on a plain white background
2. Elements should be designed to work together when assembled
3. Be specific about the style, colors, and details to maintain consistency across elements`
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
    const layeredSection = document.getElementById('layeredSection');
    const themeSection = document.getElementById('themeSection');
    
    // Hide all optional sections first
    transformSection.classList.add('hidden');
    actionSection.classList.add('hidden');
    referenceSection.classList.add('hidden');
    if (layeredSection) layeredSection.classList.add('hidden');
    if (themeSection) themeSection.classList.remove('hidden');
    
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
    } else if (mode === 'layered') {
        if (layeredSection) layeredSection.classList.remove('hidden');
        if (themeSection) themeSection.classList.add('hidden');
        document.getElementById('pairOrImageLabel').textContent = 'Sets';
        document.getElementById('countLabel').textContent = 'layered sets in memory';
        document.getElementById('progressLabel').textContent = 'sets';
        
        // Auto-fill the form with the current preset when switching to layered mode
        updateLayeredPreset();
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

async function falRequest(endpoint, input) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error('Please add your FAL API key first');
    }
    
    // Ensure FAL is configured
    fal.config({ credentials: apiKey });
    
    try {
        // Use FAL's subscribe method which handles queuing
        // Returns { data, requestId } - we want data
        console.log(`FAL request to ${endpoint}:`, input);
        const result = await fal.subscribe(endpoint, { input });
        console.log(`FAL response from ${endpoint}:`, result);
        return result.data || result;
    } catch (error) {
        console.error(`FAL error for ${endpoint}:`, error);
        throw new Error(error.message || error.body?.detail || 'FAL API call failed');
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================================================
// Image Generation
// =============================================================================

async function generateStartImage(prompt, aspectRatio, resolution) {
    const result = await falRequest('fal-ai/nano-banana-pro', {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        resolution: resolution,  // "1K", "2K", or "4K"
        num_images: 1
    });
    
    return result.images[0].url;
}

async function generateEndImage(startImageUrl, editPrompt, aspectRatio, resolution) {
    const result = await falRequest('fal-ai/nano-banana-pro/edit', {
        image_urls: [startImageUrl],  // Must be array!
        prompt: editPrompt,
        aspect_ratio: 'auto',  // Edit uses 'auto' by default
        resolution: resolution
    });
    
    return result.images[0].url;
}

async function generateSingleImage(prompt, aspectRatio, resolution) {
    const result = await falRequest('fal-ai/nano-banana-pro', {
        prompt: prompt,
        aspect_ratio: aspectRatio,
        resolution: resolution,
        num_images: 1
    });
    
    return result.images[0].url;
}

async function generateReferenceVariation(referenceUrl, prompt, aspectRatio, resolution) {
    // Use the edit endpoint with the reference image
    const result = await falRequest('fal-ai/nano-banana-pro/edit', {
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

// =============================================================================
// Layered Mode Functions
// =============================================================================

function updateLayeredPreset() {
    const useCase = document.getElementById('layeredUseCase').value;
    const preset = LAYERED_PRESETS[useCase];
    const gridLayout = document.getElementById('gridLayout');
    
    // Fill Elements Description
    const elementsText = preset.elements.map((el, i) => `Element ${i + 1}: ${el}`).join('\n');
    document.getElementById('elementsDescription').value = elementsText;
    
    // Fill Final Image Description
    document.getElementById('finalImageDescription').value = preset.finalPrompt;
    
    // IMPORTANT: Always use 2x2 grid with 1:1 aspect ratio to ensure square cells
    // This guarantees each split element is also 1:1 (square)
    gridLayout.value = '2x2';
    
    // Force 1:1 aspect ratio for proper grid splitting (square cells)
    document.getElementById('aspectRatio').value = '1:1';
    
    // Fill Resolution
    if (preset.resolution) {
        document.getElementById('resolution').value = preset.resolution;
    }
    
    // Fill Trigger Word
    if (preset.triggerWord !== undefined) {
        document.getElementById('triggerWord').value = preset.triggerWord;
    }
    
    // Fill Number of Sets
    if (preset.numSets) {
        document.getElementById('numPairs').value = preset.numSets;
    }
    
    updateCostEstimate();
}

function getGridDimensions() {
    // Fixed to 2x2 grid for 1:1 square cells
    // This ensures each split element is also square (1:1)
    return { cols: 2, rows: 2, total: 4 };
}

async function removeBackground(imageUrl) {
    // Using Bria RMBG 2.0 - better quality and commercially safe
    // https://fal.ai/models/fal-ai/bria/background/remove
    const result = await falRequest('fal-ai/bria/background/remove', {
        image_url: imageUrl
    });
    return result.image.url;
}

async function generateGridImage(elementPrompts, aspectRatio, resolution) {
    // Create a grid prompt
    const { cols, rows } = getGridDimensions();
    const gridPrompt = `A ${cols}x${rows} grid of separate elements on white backgrounds, each cell clearly separated:
${elementPrompts.map((p, i) => `Cell ${i + 1}: ${p}`).join(', ')}
Clean grid layout, each element isolated in its own cell, white background, professional product photography style`;
    
    const result = await falRequest('fal-ai/nano-banana-pro', {
        prompt: gridPrompt,
        aspect_ratio: aspectRatio,
        resolution: resolution,
        num_images: 1
    });
    
    return result.images[0].url;
}

async function splitGridIntoElements(gridImageUrl, cols, rows) {
    // Fetch the image
    const response = await fetch(gridImageUrl);
    const blob = await response.blob();
    
    // Create image element
    const img = await createImageBitmap(blob);
    
    const cellWidth = Math.floor(img.width / cols);
    const cellHeight = Math.floor(img.height / rows);
    
    const elements = [];
    
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Create canvas for this cell
            const canvas = document.createElement('canvas');
            canvas.width = cellWidth;
            canvas.height = cellHeight;
            const ctx = canvas.getContext('2d');
            
            // Draw the cell portion
            ctx.drawImage(
                img,
                col * cellWidth, row * cellHeight, cellWidth, cellHeight,
                0, 0, cellWidth, cellHeight
            );
            
            // Convert to blob
            const cellBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            
            // Upload to FAL storage
            const url = await fal.storage.upload(cellBlob);
            elements.push(url);
        }
    }
    
    return elements;
}

async function assembleElements(elementUrls, finalPrompt, resolution) {
    // Use the first element as base and edit with all others
    const result = await falRequest('fal-ai/nano-banana-pro/edit', {
        image_urls: elementUrls,
        prompt: `Combine and assemble these elements into: ${finalPrompt}. Create a cohesive, professional final image.`,
        aspect_ratio: 'auto',
        resolution: resolution
    });
    
    return result.images[0].url;
}

async function generateLayeredDatasetItem(index, total, theme, elementPrompts, finalPrompt, aspectRatio, resolution, useVision, llmModel, triggerWord) {
    const { cols, rows, total: numElements } = getGridDimensions();
    
    addProgressLog(`🧩 [${index + 1}/${total}] Generating layered set...`, 'info');
    
    try {
        // Step 1: Generate grid image
        addProgressLog(`   [${index + 1}] Generating ${cols}x${rows} grid...`, 'info');
        const gridUrl = await generateGridImage(elementPrompts, aspectRatio, resolution);
        
        // Step 2: Split grid into elements
        addProgressLog(`   [${index + 1}] Splitting into ${numElements} elements...`, 'info');
        const elementUrls = await splitGridIntoElements(gridUrl, cols, rows);
        
        // Step 3: Remove background from each element
        addProgressLog(`   [${index + 1}] Removing backgrounds...`, 'info');
        const transparentElements = [];
        for (let i = 0; i < elementUrls.length; i++) {
            try {
                const transparentUrl = await removeBackground(elementUrls[i]);
                transparentElements.push(transparentUrl);
            } catch (e) {
                console.warn(`Background removal failed for element ${i + 1}:`, e);
                transparentElements.push(elementUrls[i]); // Use original if removal fails
            }
        }
        
        // Step 4: Assemble into final image
        addProgressLog(`   [${index + 1}] Assembling final image...`, 'info');
        const finalUrl = await assembleElements(transparentElements, finalPrompt, resolution);
        
        // Step 5: Caption if needed
        let caption = finalPrompt;
        if (useVision) {
            try {
                caption = await captionImage(finalUrl, llmModel);
            } catch (e) {
                console.warn('Vision caption failed:', e);
            }
        }
        
        if (triggerWord) {
            caption = `${triggerWord} ${caption}`;
        }
        
        addProgressLog(`   [${index + 1}] Layered set complete!`, 'success');
        
        return {
            finalUrl,
            gridUrl,
            elementUrls: transparentElements,
            elementPrompts,
            finalPrompt,
            caption
        };
    } catch (error) {
        console.error(`Layered set ${index + 1} error:`, error);
        throw new Error(error.message || error.toString() || 'Layered generation failed');
    }
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
    } else if (state.mode === 'layered') {
        // Layered mode - generate element prompts for grid
        const { total: numElements } = getGridDimensions();
        const elementsDesc = document.getElementById('elementsDescription')?.value || '';
        const finalDesc = document.getElementById('finalImageDescription')?.value || '';
        const useCase = document.getElementById('layeredUseCase')?.value || 'custom';
        const preset = LAYERED_PRESETS[useCase];
        
        const systemPrompt = customSystemPrompt;

        const userPrompt = `Generate ${numPrompts} unique sets of element prompts for creating layered compositions.
Use case: ${preset.name}
Number of elements per set: ${numElements}
${elementsDesc ? `Element guidelines:\n${elementsDesc}` : ''}
${finalDesc ? `Final image should be: ${finalDesc}` : ''}

Each element should be described as an isolated object on a white background.

Return ONLY valid JSON array:
[
  {
    "elements": ["element 1 prompt on white background", "element 2 prompt on white background", ...],
    "final_prompt": "description of how elements should be assembled into final image"
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
    const numPairs = parseInt(document.getElementById('numPairs').value) || 20;
    const useVision = document.getElementById('useVisionCaption').checked;
    const resolution = document.getElementById('resolution').value;
    
    let imagesPerItem = state.mode === 'pair' ? 2 : 1; // Pair mode = 2 images, single/reference = 1
    let extraCost = 0;
    
    if (state.mode === 'layered') {
        const { total: numElements } = getGridDimensions();
        // Layered: 1 grid image + 1 assembly image
        imagesPerItem = 2;
        // + background removals with Bria RMBG 2.0 (~$0.018 each)
        extraCost = numElements * 0.018;
    }
    
    const imageCost = getImageCost();
    const baseCost = numPairs * (imagesPerItem * imageCost + extraCost);
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
                    <img src="${item.startUrl}" alt="Start" loading="lazy">
                </div>
                <div class="result-image">
                    <span class="label">END</span>
                    <img src="${item.endUrl}" alt="End" loading="lazy">
                </div>
            </div>
        `;
    } else if (item.mode === 'layered') {
        // Layered mode - show final + grid + elements
        const elementsHtml = item.elementUrls.map((url, i) => 
            `<img src="${url}" alt="Layer ${i + 1}" title="Layer ${i + 1}" loading="lazy" style="max-width: 60px; max-height: 60px; border-radius: 4px;">`
        ).join('');
        
        card.innerHTML = `
            <div class="result-header">
                <span class="result-id">#${item.id}</span>
                <span class="result-badge">🧩 Layered</span>
            </div>
            <div class="result-images layered">
                <div class="result-image">
                    <span class="label">FINAL</span>
                    <img src="${item.finalUrl}" alt="Final" loading="lazy">
                </div>
                <div class="result-image">
                    <span class="label">GRID</span>
                    <img src="${item.gridUrl}" alt="Grid" loading="lazy">
                </div>
            </div>
            <div class="result-layers">
                <span class="label">LAYERS (${item.elementUrls.length})</span>
                <div class="layers-preview">${elementsHtml}</div>
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
                    <img src="${item.imageUrl}" alt="Generated" loading="lazy">
                </div>
            </div>
        `;
    }
    
    container.insertBefore(card, container.firstChild);
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
        
        // Optional: Caption with vision
        let finalText = prompt.action_name;
        if (useVision) {
            try {
                const caption = await captionImage(endUrl, llmModel);
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

async function startGeneration() {
    const numPairsInput = document.getElementById('numPairs');
    const numPairs = parseInt(numPairsInput.value) || 20;
    
    // Strict validation - block if over 40
    if (numPairs > 40) {
        alert('⚠️ Maximum 40 pairs allowed!\n\nPlease enter a number between 1 and 40.\n\nIf you need more pairs, run multiple generations - they will accumulate in memory.');
        numPairsInput.value = 40;
        numPairsInput.focus();
        return;
    }
    
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
    if (state.mode !== 'layered' && !theme) {
        alert('Please fill in the dataset theme');
        return;
    }
    
    if (state.mode === 'pair' && !transformation) {
        alert('Please fill in the transformation to learn');
        return;
    }
    
    if (state.mode === 'reference' && !state.referenceImageBase64) {
        alert('Please upload a reference image');
        return;
    }
    
    if (state.mode === 'layered') {
        const finalDesc = document.getElementById('finalImageDescription')?.value?.trim();
        if (!finalDesc) {
            alert('Please fill in the final image description');
            return;
        }
    }
    
    if (!getApiKey()) {
        showApiKeyModal();
        return;
    }
    
    // Confirm
    let imagesPerItem = state.mode === 'pair' ? 2 : 1;
    let modeLabel = state.mode === 'pair' ? 'pairs' : 'images';
    
    if (state.mode === 'layered') {
        const { total: numElements } = getGridDimensions();
        // Layered: 1 grid + numElements background removals + 1 assembly
        imagesPerItem = 2 + numElements * 0.05; // Grid + assembly + bg removal costs
        modeLabel = 'layered sets';
    }
    
    const cost = (numPairs * imagesPerItem * getImageCost() + 0.02).toFixed(2);
    if (!confirm(`Generate ${numPairs} ${modeLabel}?\n\n⚡ ${maxConcurrent} parallel requests\n💰 Estimated cost: ~$${cost}\n\nImages stored in memory.\nUse "Download ZIP" to save.`)) {
        return;
    }
    
    showProgress(true);
    clearProgressLog();
    updateProgress(0, numPairs, 'Generating prompts with AI...');
    addProgressLog('🤖 Generating creative prompts...', 'info');
    
    state.isGenerating = true;
    let completed = 0;
    let failed = 0;
    
    try {
        // Upload reference image if in reference mode
        let referenceUrl = null;
        if (state.mode === 'reference') {
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
            
            // Run batch in parallel based on mode
            let results;
            if (state.mode === 'pair') {
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateSinglePair(p, i + batchIndex, prompts.length, aspectRatio, resolution, useVision, llmModel, triggerWord)
                    )
                );
            } else if (state.mode === 'single') {
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateSingleItem(p, i + batchIndex, prompts.length, aspectRatio, resolution, useVision, llmModel, triggerWord)
                    )
                );
            } else if (state.mode === 'reference') {
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateReferenceItem(p, i + batchIndex, prompts.length, referenceUrl, aspectRatio, resolution, useVision, llmModel, triggerWord)
                    )
                );
            } else if (state.mode === 'layered') {
                const useCase = document.getElementById('layeredUseCase')?.value || 'custom';
                results = await Promise.allSettled(
                    batch.map((p, batchIndex) => 
                        generateLayeredDatasetItem(
                            i + batchIndex, 
                            prompts.length, 
                            useCase, 
                            p.elements, 
                            p.final_prompt, 
                            aspectRatio, 
                            resolution, 
                            useVision, 
                            llmModel, 
                            triggerWord
                        )
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
                        mode: state.mode,
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
    }
}

function stopGeneration() {
    state.isGenerating = false;
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
            } else if (item.mode === 'layered') {
                // Layered mode - Qwen format: ROOT_start.png (final) + ROOT_end.png, ROOT_end2.png... (layers)
                const finalBlob = await fetch(item.finalUrl).then(r => r.blob());
                zip.file(`${item.id}_start.png`, finalBlob);
                
                // Add each layer as _end, _end2, _end3, etc.
                for (let j = 0; j < item.elementUrls.length; j++) {
                    const layerBlob = await fetch(item.elementUrls[j]).then(r => r.blob());
                    const suffix = j === 0 ? '_end.png' : `_end${j + 1}.png`;
                    zip.file(`${item.id}${suffix}`, layerBlob);
                }
                
                // Add caption
                zip.file(`${item.id}.txt`, item.caption);
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
        
        // Use appropriate filename based on mode
        const hasLayered = pairsSnapshot.some(p => p.mode === 'layered');
        const filename = hasLayered ? `qwen_layered_dataset_${Date.now()}.zip` : `nanobanana_dataset_${Date.now()}.zip`;
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
    
    // Layered mode listeners
    const gridLayout = document.getElementById('gridLayout');
    if (gridLayout) {
        gridLayout.addEventListener('change', updateCostEstimate);
    }
    
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
window.updateLayeredPreset = updateLayeredPreset;

document.addEventListener('DOMContentLoaded', init);
