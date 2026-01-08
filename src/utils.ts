import { AIImage, CivitaiResource } from './types';

export const parseGenerationData = (text: string): Partial<AIImage> => {
    const result: Partial<AIImage> = {};
    if (!text) return result;

    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
        try {
            let json = null;
            try {
                json = JSON.parse(text);
            } catch (e) {
                const jsonMatch = text.match(/(\{.*\})/s);
                if (jsonMatch) {
                    try { json = JSON.parse(jsonMatch[1]); } catch (subE) { /* Suppress extraction failure */ }
                }
            }

            if (json) {
                if (json.extraMetadata) {
                    try {
                        const extra = typeof json.extraMetadata === 'string' ? JSON.parse(json.extraMetadata) : json.extraMetadata;
                        if (extra.prompt) result.prompt = extra.prompt;
                        if (extra.negativePrompt) result.negativePrompt = extra.negativePrompt;
                        if (extra.steps) result.steps = parseInt(extra.steps);
                        if (extra.cfgScale) result.cfgScale = parseFloat(extra.cfgScale);
                        if (extra.sampler) result.sampler = extra.sampler;
                        if (extra.seed) result.seed = parseInt(extra.seed);
                        if (extra.loras) result.loras = extra.loras;

                        if (result.prompt) return result;
                    } catch (e) { /* Suppress extraMetadata parse error */ }
                }

                if (json.prompt) {
                    if (typeof json.prompt === 'string' && (json.prompt.trim().startsWith('{') || json.prompt.trim().startsWith('['))) {
                        try {
                            const inner = JSON.parse(json.prompt);
                            result.prompt = inner.prompt || inner.text || inner.positive || json.prompt;
                        } catch (e) { result.prompt = json.prompt; }
                    } else {
                        result.prompt = typeof json.prompt === 'string' ? json.prompt : undefined;
                    }
                }

                if (json.positive) result.prompt = json.positive;
                if (json.positive_prompt) result.prompt = json.positive_prompt;
                if (json.negative) result.negativePrompt = json.negative;
                if (json.negative_prompt) result.negativePrompt = json.negative_prompt;

                const keys = Object.keys(json);
                for (const key of keys) {
                    const node = json[key];
                    if (node && typeof node === 'object') {
                        if (node.class_type && (node.class_type.includes('CLIPTextEncode') || node.class_type === 'Prompts')) {
                            const inputs = node.inputs || {};
                            const textVal = inputs.text || inputs.string || inputs.prompt;
                            const title = node._meta?.title?.toLowerCase() || '';

                            if (textVal && typeof textVal === 'string') {
                                if (title === 'positive' || title.includes('prompt') && !title.includes('neg')) {
                                    if (!result.prompt || title === 'positive') result.prompt = textVal;
                                } else if (title === 'negative' || title.includes('neg')) {
                                    result.negativePrompt = textVal;
                                } else {
                                    if (!result.prompt) result.prompt = textVal;
                                }
                            }
                        }
                        if (node.class_type && node.class_type.includes('KSampler')) {
                            const inputs = node.inputs || {};
                            if (inputs.steps) result.steps = parseInt(inputs.steps);
                            if (inputs.cfg) result.cfgScale = parseFloat(inputs.cfg);
                            if (inputs.sampler_name) result.sampler = inputs.sampler_name;
                            if (inputs.seed) result.seed = parseInt(inputs.seed);
                        }
                    }
                }

                if (json.steps) result.steps = parseInt(json.steps);
                if (json.seed) result.seed = parseInt(json.seed);
                if (json.cfg) result.cfgScale = parseFloat(json.cfg);
                if (json.sampler_name) result.sampler = json.sampler_name;
                if (json.checkpoint) result.model = json.checkpoint;
            }
        } catch (e) {
            /* Suppress JSON parse failures within blocks */
        }
    }

    if (!result.prompt) {
        try {
            const extraMatch = text.match(/"extraMetadata"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (extraMatch) {
                const jsonStr = JSON.parse(`"${extraMatch[1]}"`);
                const extra = JSON.parse(jsonStr);
                if (extra.prompt) result.prompt = extra.prompt;
                if (extra.negativePrompt) result.negativePrompt = extra.negativePrompt;
                if (extra.steps) result.steps = parseInt(extra.steps);
                if (extra.cfgScale) result.cfgScale = parseFloat(extra.cfgScale);
                if (extra.sampler) result.sampler = extra.sampler;
                if (extra.loras) result.loras = extra.loras;
            }
        } catch (e) { /* Suppress extra metadata parse error */ }
    }

    if (result.prompt) return result;

    try {
        if (text.trim().startsWith('{') && !result.prompt) {
            const simplePos = text.match(/"positive"\s*:\s*"((?:[^"\\]|\\.)*)"/);
            if (simplePos) {
                result.prompt = JSON.parse(`"${simplePos[1]}"`);
                return result;
            }
            return result;
        }

        const lines = text.split(/\r?\n/);
        let buffer: string[] = [];
        let state: 'PROMPT' | 'NEGATIVE' | 'PARAMS' = 'PROMPT';

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed && buffer.length === 0 && state === 'PROMPT') continue;

            if (state !== 'PARAMS' && trimmed.startsWith('Steps:') && (trimmed.includes('Sampler:') || trimmed.includes('Model:') || trimmed.includes('CFG scale:'))) {
                if (state === 'PROMPT') result.prompt = buffer.join('\n').trim();
                if (state === 'NEGATIVE') result.negativePrompt = buffer.join('\n').trim();

                state = 'PARAMS';
                buffer = [];

                result.steps = parseInt(trimmed.match(/Steps: (\d+)/)?.[1] || "20");
                result.sampler = trimmed.match(/Sampler: ([^,]+)/)?.[1];
                result.cfgScale = parseFloat(trimmed.match(/CFG scale: ([\d.]+)/)?.[1] || "7");
                result.seed = parseInt(trimmed.match(/Seed: (\d+)/)?.[1] || "0");
                result.model = trimmed.match(/Model: ([^,]+)/)?.[1];

                const loraMatches = [];
                const loraRegex = /<lora:([^:>]+)(?::([^>]+))?>/g;
                let match;
                const promptToSearch = result.prompt || "";
                while ((match = loraRegex.exec(promptToSearch)) !== null) {
                    loraMatches.push({ name: match[1], weight: match[2] ? parseFloat(match[2]) : 1.0 });
                }
                if (loraMatches.length > 0) result.loras = [...(result.loras || []), ...loraMatches];

                try {
                    const resourcesMatch = trimmed.match(/Civitai resources:\s*(\[.*?\])/);
                    if (resourcesMatch) {
                        const resources = JSON.parse(resourcesMatch[1]);

                        if (!result.model) {
                            const checkpoint = resources.find((r: CivitaiResource) => r.type === 'checkpoint');
                            if (checkpoint && checkpoint.modelName) {
                                result.model = checkpoint.modelName;
                            }
                        }

                        const civitaiLoras = resources
                            .filter((r: CivitaiResource) => r.type === 'lora')
                            .map((r: CivitaiResource) => ({ name: r.modelName, weight: r.weight || 1.0 }));

                        if (civitaiLoras.length > 0) {
                            result.loras = [...(result.loras || []), ...civitaiLoras];
                        }
                        const civitaiModel = trimmed.match(/"modelName"\s*:\s*"([^"]+)"/);
                        if (civitaiModel) result.model = civitaiModel[1];
                    }
                } catch (e) { /* Suppress Civitai resource parse error */ }

                const size = trimmed.match(/Size: (\d+)x(\d+)/);
                if (size) {
                    result.width = parseInt(size[1]);
                    result.height = parseInt(size[2]);
                }
                continue;
            }

            if (state === 'PROMPT' && trimmed.match(/^Negative [Pp]rompt:/)) {
                result.prompt = buffer.join('\n').trim();
                state = 'NEGATIVE';
                buffer = [];

                const content = trimmed.replace(/^Negative [Pp]rompt:\s*/i, "");
                if (content) buffer.push(content);
                continue;
            }

            buffer.push(line);
        }

        if (state === 'PROMPT' && buffer.length > 0) result.prompt = buffer.join('\n').trim();
        if (state === 'NEGATIVE' && buffer.length > 0) result.negativePrompt = buffer.join('\n').trim();

        if (result.prompt) {
            result.prompt = result.prompt.replace(/^(parameters|UserComment|Comments|prompt):\s*/i, '');
        }

    } catch (e) {
        /* Suppress generation data parsing errors */
    }

    return result;
};

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 7);


export const sanitizeFilename = (name: string): string => {
    if (!name) return 'untitled';
    return name.replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'untitled';
};

export const calculateImageHash = async (file: File | Blob): Promise<string> => {
    if (!file) return '';

    try {
        let buffer: ArrayBuffer;


        const blob = (file instanceof Blob) ? file : new Blob([file as any]);

        if (typeof blob.arrayBuffer === 'function') {
            buffer = await blob.arrayBuffer();
        } else {
            buffer = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as ArrayBuffer);
                reader.onerror = reject;
                reader.readAsArrayBuffer(blob);
            });
        }

        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {
        return '';
    }
};

export const extractDominantColors = (imageSrc: string): Promise<string[]> => {
    return new Promise((resolve) => {
        const img = new Image();
        if (imageSrc.startsWith('http')) {
            img.crossOrigin = "Anonymous";
        }
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve([]); return; }

            canvas.width = 50;
            canvas.height = 50;
            ctx.drawImage(img, 0, 0, 50, 50);

            const imageData = ctx.getImageData(0, 0, 50, 50).data;
            const colorCounts: Record<string, number> = {};

            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i + 1];
                const b = imageData[i + 2];
                const alpha = imageData[i + 3];
                if (alpha < 128) continue;

                const qr = Math.round(r / 32) * 32;
                const qg = Math.round(g / 32) * 32;
                const qb = Math.round(b / 32) * 32;

                const hex = `#${((1 << 24) + (qr << 16) + (qg << 8) + qb).toString(16).slice(1)}`;
                colorCounts[hex] = (colorCounts[hex] || 0) + 1;
            }

            const sortedColors = Object.entries(colorCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([color]) => color)
                .slice(0, 5);

            resolve(sortedColors);
        };
        img.onerror = () => resolve([]);
        img.src = imageSrc;
    });
};

export const extractTagsFromPrompt = (prompt: string): string[] => {
    if (!prompt) return [];

    const parts = prompt.split(',');
    const extracted: string[] = [];

    const addTag = (tag: string) => {
        const cleaned = tag.trim().toLowerCase()
            .replace(/[()\[\]{}]/g, '')
            .split(':')[0]
            .replace(/[^a-z0-9\s_-]/g, '')
            .replace(/\s+/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '');


        if (cleaned && cleaned.length > 2 && cleaned.length <= 30 && !extracted.includes(cleaned)) {
            extracted.push(cleaned);
        }
    };

    parts.forEach(part => {
        const trimmed = part.trim();
        if (!trimmed) return;


        const words = trimmed.split(/\s+/).filter(w => w.length > 0);

        if (words.length === 1) {

            addTag(words[0]);
        } else if (words.length === 2) {

            addTag(trimmed);
        } else if (words.length <= 4) {

            addTag(trimmed);

            words.forEach(word => addTag(word));
        } else {

            const skipWords = new Set(['a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'and', 'or', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'her', 'his', 'its', 'their', 'our', 'your', 'my', 'out', 'up', 'down', 'off', 'over', 'under', 'again', 'further', 'then', 'once']);
            words.forEach(word => {
                const lowerWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (!skipWords.has(lowerWord)) {
                    addTag(word);
                }
            });
        }
    });

    return extracted;
};

export const getAspectRatioBucket = (w: number, h: number): string => {
    if (!w || !h) return 'Unknown';
    const r = w / h;
    if (r > 1.2) return 'Landscape';
    if (r < 0.85) return 'Portrait';
    return 'Square';
};


export const normalizePath = (path: string): string => {
    if (!path) return '';


    let clean = path;
    try {
        clean = decodeURIComponent(path);
    } catch {
        clean = decodeURI(path);
    }

    clean = clean
        .replace(/^file:\/{2,3}/, '')
        .replace(/^media:\/{2,3}/, '');


    if (clean.match(/^\/[a-zA-Z]:/)) {
        clean = clean.slice(1);
    }


    if (clean.match(/^[a-zA-Z]\//) && !clean.match(/^[a-zA-Z]:\//)) {
        clean = clean[0] + ':' + clean.slice(1);
    }

    const isWindows = (typeof window !== 'undefined' && window.electronAPI?.platform === 'win32') || clean.match(/^[a-zA-Z]:/);
    if (isWindows) {
        clean = clean.replace(/\//g, '\\');
    }

    return clean;
};


export const toMediaUrl = (filePath: string): string => {
    if (!filePath) return '';

    if (filePath.startsWith('media://')) return filePath;

    let clean = normalizePath(filePath);

    clean = clean.replace(/\\/g, '/');


    clean = clean
        .split('/')
        .map(segment => encodeURIComponent(segment))
        .join('/');

    return `media://${clean}`;
};

export const blobToBase64 = (blob: Blob, includeHeader: boolean = false): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(includeHeader ? result : result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};