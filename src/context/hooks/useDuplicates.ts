import { useState, useCallback } from 'react';
import { AIImageDB, GeneralSettings } from '../../types';
import { db } from '../../db';
import { ToastType } from '../../components/Toaster';
import { sanitizeFilename } from '../../utils';

interface DuplicateState {
    newImages: AIImageDB[];
    duplicates: AIImageDB[];
    sourceName: string;
}

interface UseDuplicatesOptions {
    addToast: (type: ToastType, message: string) => void;
    refreshImages: () => Promise<void>;
    isElectron: boolean;
    generalSettings: GeneralSettings;
}

interface UseDuplicatesReturn {
    duplicateState: DuplicateState | null;
    setDuplicateState: React.Dispatch<React.SetStateAction<DuplicateState | null>>;
    resolveDuplicates: (action: 'skip' | 'keep') => Promise<void>;
}

/**
 * Hook for managing duplicate image resolution.

 */
export function useDuplicates({
    addToast,
    refreshImages,
    isElectron,
    generalSettings
}: UseDuplicatesOptions): UseDuplicatesReturn {
    const [duplicateState, setDuplicateState] = useState<DuplicateState | null>(null);

    const resolveDuplicates = useCallback(async (action: 'skip' | 'keep') => {
        if (!duplicateState) return;
        const { newImages, duplicates, sourceName } = duplicateState;

        const finalBatch = [...newImages];
        let addedCount = newImages.length;
        let skippedCount = 0;

        if (action === 'keep') {
            const cleanDuplicates = duplicates.map(d => {
                const { isDuplicate, ...rest } = d as any;
                return rest;
            });
            finalBatch.push(...cleanDuplicates);
            addedCount += duplicates.length;
        } else {
            skippedCount = duplicates.length;
        }

        if (finalBatch.length > 0) {

            if (isElectron && (window as any).electronAPI && generalSettings.localVaultPath) {
                const vaultPath = generalSettings.localVaultPath;

                for (const img of finalBatch) {
                    if (img.sourceId === 'internal' && img.blob && !img.src?.startsWith('file://')) {
                        try {
                            const buffer = await img.blob.arrayBuffer();
                            // Use title as filename basis, fallback to hash or timestamp
                            const ext = img.blob.type.split('/')[1] || 'png';
                            const safeTitle = sanitizeFilename(img.title) || `image_${Date.now()}`;
                            const filename = `${safeTitle}.${ext}`;

                            const result = await (window as any).electronAPI.saveBlobToVault({
                                vaultPath,
                                vaultName: 'Imported',
                                filename,
                                buffer,
                                metadata: img
                            });

                            if (result.success && result.targetPath) {
                                img.src = `file://${result.targetPath.replace(/\\/g, '/')}`;
                                img.blob = undefined; // Don't store blob in DB
                            } else {
                                console.error("Failed to save deferred file:", img.title, result.error);
                            }
                        } catch (err) {
                            console.error("Error saving deferred file:", img.title, err);
                        }
                    }
                }
            }

            await db.images.bulkAdd(finalBatch);
            await refreshImages();
            addToast('success', `Imported ${addedCount} items.${skippedCount > 0 ? ` Skipped ${skippedCount} duplicates.` : ''}`);
        } else {
            addToast('info', `Import skipped. ${duplicates.length} duplicates found.`);
        }

        setDuplicateState(null);
    }, [duplicateState, addToast, refreshImages, isElectron, generalSettings.localVaultPath]);

    return {
        duplicateState,
        setDuplicateState,
        resolveDuplicates
    };
}
