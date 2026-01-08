import { AIImage, AIImageDB } from '../types';
import { db } from '../db';
import { normalizePath, parseGenerationData, toMediaUrl, extractDominantColors, generateId } from '../utils';
import { DEFAULTS } from '../constants';

export interface EnrichmentResult {
    updates: Partial<AIImageDB>;
    hasChanges: boolean;
}


export const enrichImageMetadata = async (img: AIImage | AIImageDB): Promise<EnrichmentResult> => {
    const updates: Partial<AIImageDB> = {};
    let hasChanges = false;

    if (!img.src || !img.src.startsWith('file://')) {
        return { updates, hasChanges };
    }

    const pathOnly = normalizePath(img.src);
    const ext = pathOnly.split('.').pop()?.toLowerCase();
    const isTxt = ext === 'txt';
    const basePath = pathOnly.substring(0, pathOnly.lastIndexOf('.'));


    if (!isTxt && window.electronAPI) {
        try {
            const sidecarJson = await window.electronAPI.readFile(basePath + '.json');
            if (sidecarJson) {
                try {
                    const json = JSON.parse(sidecarJson);
                    // Defensive check to avoid overwriting core properties from sidecar
                    const { src: _src, blob: _blob, sourceId: _sourceId, date: _date, ...safeSidecar } = json;
                    Object.assign(updates, safeSidecar);
                    hasChanges = true;
                } catch { /* ignore invalid JSON */ }
            }

            if (!updates.prompt) {
                const sidecarTxt = await window.electronAPI.readFile(basePath + '.txt');
                if (sidecarTxt) {
                    updates.prompt = sidecarTxt;
                    hasChanges = true;
                }
            }
        } catch { /* Suppress sidecar read errors */ }
    } else if (isTxt && window.electronAPI) {
        try {
            const content = await window.electronAPI.readFile(pathOnly);
            if (content) {
                updates.prompt = content;
                updates.model = 'Text Metadata';
                updates.width = 512;
                updates.height = 512;
                hasChanges = true;
            }
        } catch { /* Suppress metadata errors */ }
    }


    if (!isTxt && window.electronAPI) {
        try {
            const res = await window.electronAPI.readMetadata(pathOnly);
            if (res.success && res.data) {
                const meta = res.data;
                // Priority for generation data parsing: Parameters > ImageDescription > Comments > Subject
                const genSource = (meta.Parameters || meta.ImageDescription || meta.Comments || meta.Subject || '').trim();
                const genData = parseGenerationData(genSource);

                const newWidth = meta.ImageWidth || genData.width || img.width;
                const newHeight = meta.ImageHeight || genData.height || img.height;
                const newModel = updates.model || meta.CameraModel || genData.model || img.model;
                const newSampler = updates.sampler || genData.sampler || img.sampler;
                const newCfg = updates.cfgScale || genData.cfgScale || img.cfgScale;
                const newSteps = updates.steps || genData.steps || img.steps;
                const newSeed = updates.seed || genData.seed || img.seed;
                const newPrompt = updates.prompt || genData.prompt || meta.ImageDescription || meta.Title || img.prompt || '';

                if (newWidth !== img.width) updates.width = newWidth;
                if (newHeight !== img.height) updates.height = newHeight;
                if (newModel !== img.model) updates.model = newModel;
                if (newSampler !== img.sampler) updates.sampler = newSampler;
                if (newCfg !== img.cfgScale) updates.cfgScale = newCfg;
                if (newSteps !== img.steps) updates.steps = newSteps;
                if (newSeed !== img.seed) updates.seed = newSeed;
                if (newPrompt !== img.prompt) updates.prompt = newPrompt;
                if (genData.loras) updates.loras = genData.loras;

                if (Object.keys(updates).length > 0) hasChanges = true;
            }
        } catch (e) {
            console.warn("Metadata enrichment error:", e);
        }
    }


    if (!img.dominantColors || img.dominantColors.length === 0) {
        const colorSrc = toMediaUrl(img.src);
        if (colorSrc) {
            try {
                const colors = await extractDominantColors(colorSrc);
                updates.dominantColors = colors;
                hasChanges = true;
            } catch (e) {
                updates.dominantColors = ['#000000'];
                hasChanges = true;
            }
        }
    }

    return { updates, hasChanges };
};

export const createBaseImage = (overrides: Partial<AIImageDB>): AIImageDB => {
    return {
        id: generateId(),
        sourceId: 'internal',
        title: 'New Image',
        src: '',
        prompt: '',
        model: DEFAULTS.MODEL,
        sampler: DEFAULTS.SAMPLER,
        cfgScale: 7,
        steps: 20,
        seed: 0,
        width: 0,
        height: 0,
        date: new Date().toISOString(),
        tags: [],
        rating: 0,
        ...overrides
    };
};


