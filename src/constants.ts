import { AISettings, GeneralSettings } from './types';


export const DEFAULTS = {
    MODEL: 'Unknown',
    SAMPLER: 'Unknown',
    VAULT_NAME: 'Unknown Vault',
    LORA_NAME: 'Unknown LoRA',
    ASPECT_RATIO: 'Unknown',
} as const;


export const PERFORMANCE_CONFIG = {
    /** Delay before starting background metadata extraction (ms) */
    METADATA_TASK_DELAY: 5000,
    /** Delay between background hash calculation batches (ms) */
    HASH_TASK_DELAY: 15000,
    /** Number of images to process in each metadata batch */
    METADATA_BATCH_SIZE: 5,
    /** Number of images to process in each hash batch */
    HASH_BATCH_SIZE: 10,
    /** Debounce delay for search/filter operations (ms) */
    FILTER_DEBOUNCE: 50,
} as const;


export const DEFAULT_AI_SETTINGS: AISettings = {
    provider: 'google',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    captionModel: 'gemini-2.0-flash',

    activeCaptionStyle: 'stable_diffusion',
    prompts: {
        stable_diffusion: `You are an expert dataset annotator for Stable Diffusion training. Analyze this image meticulously. Write a detailed, objective caption using comma-separated tags/phrases. Describe the subject (clothing, armor, materials), the action, the background, the lighting, and the artistic style. Focus on visual facts, avoid poetic language. Format: tag1, tag2, tag3...`,
        natural_language: `You are an expert data annotator training a Vision Language Model (like Qwen-VL or LLaVA). Describe this image in a high-quality, descriptive, and natural paragraph. Focus on the relationships between objects, the atmosphere, specific details of textures, and any text visible. Do not use bullet points. Write fluid sentences.`
    }
};


export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
    localVaultPath: '', // Empty by default - user must set this in Electron
    autoCopyPrompt: true,
    reduceMotion: false,
    gridItemSize: 240,
    themeAccent: '252, 62%, 66%', // Royal Periwinkle
    gradientColors: {
        left: '260, 20%, 4%',    // Pitch Black
        center: '252, 40%, 10%', // Deep Indigo
        right: '280, 40%, 8%',   // Dusk
    },
    workbenchColumns: ['title', 'model', 'vault', 'sampler', 'cfg', 'steps', 'dimensions', 'prompt', 'tokens'],
    quickSaveLayout: 'horizontal',
    renameLinkedVaultFiles: false, // Default: don't rename files in external vaults
    deleteLinkedVaultFiles: false, // Default: don't delete files in external vaults
};


export const THEME_PRESETS = [
    { name: 'Celestial', left: '260, 25%, 4%', center: '252, 45%, 12%', right: '280, 40%, 10%', accent: '252, 62%, 66%' },
    { name: 'Abyss', left: '210, 30%, 4%', center: '200, 50%, 12%', right: '190, 40%, 10%', accent: '190, 90%, 50%' },
    { name: 'Jade', left: '160, 25%, 4%', center: '155, 45%, 12%', right: '140, 40%, 10%', accent: '155, 65%, 48%' },
    { name: 'Crimson', left: '0, 20%, 5%', center: '355, 50%, 14%', right: '340, 45%, 12%', accent: '355, 80%, 60%' },
    { name: 'Clay', left: '25, 20%, 5%', center: '20, 45%, 14%', right: '10, 40%, 10%', accent: '22, 70%, 55%' },
    { name: 'Arctic', left: '210, 20%, 6%', center: '200, 40%, 15%', right: '190, 30%, 12%', accent: '190, 100%, 75%' },
    { name: 'Mauve', left: '300, 20%, 5%', center: '310, 40%, 14%', right: '325, 35%, 12%', accent: '315, 55%, 65%' },
    { name: 'Onyx', left: '0, 0%, 2%', center: '0, 0%, 4%', right: '0, 0%, 3%', accent: '0, 0%, 20%' },
];

