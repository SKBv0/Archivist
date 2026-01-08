import { useMemo, useRef } from 'react';
import { AIImage, FilterCategory } from '../types';
import { getAspectRatioBucket } from '../utils';
import { DEFAULTS } from '../constants';

interface UseImageFilterOptions {
    images: AIImage[];
    search: string;
    activeFilter: string | null;
    filterCategory: FilterCategory;
    activeSourceId: string | 'all';
    sources: any[];
}

export const useImageFilter = ({
    images,
    search,
    activeFilter,
    filterCategory,
    activeSourceId,
    sources
}: UseImageFilterOptions) => {

    const stableResultRef = useRef<AIImage[]>([]);
    const lastIdsRef = useRef<string>('');

    const filteredImages = useMemo(() => {
        let result = images;


        if (activeSourceId !== 'all') {
            result = result.filter(img => img.sourceId === activeSourceId);
        }


        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(img =>
                img.title?.toLowerCase().includes(q) ||
                img.prompt?.toLowerCase().includes(q) ||
                img.model?.toLowerCase().includes(q) ||
                img.tags?.some(tag => tag.toLowerCase().includes(q))
            );
        }


        if (activeFilter) {
            result = result.filter(img => {
                switch (filterCategory) {
                    case 'tags':
                        return img.tags?.includes(activeFilter);
                    case 'models':
                        return img.model === activeFilter || (!img.model && activeFilter === DEFAULTS.MODEL);
                    case 'loras':
                        return img.loras?.some(lora => lora.name === activeFilter);
                    case 'samplers':
                        return img.sampler === activeFilter || (!img.sampler && activeFilter === DEFAULTS.SAMPLER);
                    case 'steps':
                        return img.steps?.toString() === activeFilter || (!img.steps && activeFilter === 'N/A');
                    case 'cfg':
                        return img.cfgScale?.toString() === activeFilter || (!img.cfgScale && activeFilter === 'N/A');
                    case 'ratio': {
                        const ratio = getAspectRatioBucket(img.width || 0, img.height || 0);
                        return ratio === activeFilter;
                    }
                    case 'rating': {
                        const r = img.rating || 0;
                        const label = r === 0 ? 'Unrated' : `${r} Stars`;
                        return label === activeFilter;
                    }
                    case 'colors':
                        return img.dominantColors?.includes(activeFilter);
                    default:
                        return true;
                }
            });
        }


        if (activeSourceId === 'all') {
            const seenHashes = new Map<string, AIImage>();

            result.forEach(img => {
                const hash = img.hash || img.id;
                const existing = seenHashes.get(hash);

                if (!existing) {
                    seenHashes.set(hash, img);
                } else {
                    // Priority mapping for duplicate record reconciliation
                    // (Prefers internal vault or local file paths)
                    const currentPriority = (img.sourceId === 'internal' || img.src?.startsWith('file://')) ? 2 : 1;
                    const existingPriority = (existing.sourceId === 'internal' || existing.src?.startsWith('file://')) ? 2 : 1;

                    if (currentPriority > existingPriority) {
                        seenHashes.set(hash, img);
                    }
                }
            });

            result = Array.from(seenHashes.values());
        }


        const currentIds = result.map(img => img.id).join(',');
        if (currentIds === lastIdsRef.current) {

            for (let i = 0; i < result.length; i++) {
                stableResultRef.current[i] = result[i];
            }
            // Trim if result is shorter
            stableResultRef.current.length = result.length;
            return stableResultRef.current;
        }


        lastIdsRef.current = currentIds;
        stableResultRef.current = result;
        return result;
    }, [images, search, activeFilter, filterCategory, activeSourceId, sources]);

    return { filteredImages };
};
