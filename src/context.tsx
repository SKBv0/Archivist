import { createContext, useState, PropsWithChildren, useCallback, useEffect, useMemo, useRef } from 'react';
import { AIImage, LibrarySource, FilterCategory, AIImageDB, CaptionStyle, AISettings, GeneralSettings } from './types';
import { useImageFilter } from './hooks/useImageFilter';
import { generateCaption } from './services/ai';
import { normalizePath, toMediaUrl, parseGenerationData, generateId, calculateImageHash, extractDominantColors, sanitizeFilename } from './utils';
import { db, clearDatabase } from './db';
import ImportPreviewModal from './components/ImportPreviewModal';

import { DEFAULT_AI_SETTINGS, DEFAULT_GENERAL_SETTINGS, PERFORMANCE_CONFIG, DEFAULTS } from './constants';
import { useToaster } from './hooks/useToaster';
import { enrichImageMetadata, createBaseImage } from './services/imageService';
import * as SyncEngine from './services/SyncEngine';
import DuplicateConflictModal from './components/DuplicateConflictModal';
import { useSettings } from './context/hooks/useSettings';
import { useSelection } from './context/hooks/useSelection';
import { useHistory } from './context/hooks/useHistory';
import { useSources } from './context/hooks/useSources';
import { useDuplicates } from './context/hooks/useDuplicates';
import { useDiskSync } from './context/hooks/useDiskSync';
import { useUndoRedo } from './context/hooks/useUndoRedo';
import { AppContextType } from './context/types';

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: PropsWithChildren<{}>) => {
    const [images, setImages] = useState<AIImage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sources, setSources] = useState<LibrarySource[]>([]);
    const [activeSourceId, setActiveSourceId] = useState<string | 'all'>('all');

    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    const isElectron = !!(window as any).electronAPI;
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [filterCategory, setFilterCategory] = useState<FilterCategory>('tags');

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search);
        }, 150);
        return () => clearTimeout(timer);
    }, [search]);

    const imagesWithDuplicates = useMemo(() => {
        const hashToImages: Record<string, AIImage[]> = {};
        images.forEach(img => {
            if (img.hash) {
                if (!hashToImages[img.hash]) hashToImages[img.hash] = [];
                hashToImages[img.hash].push(img);
            }
        });

        const sourceMap = new Map(sources.map(s => [s.id, s.name]));

        return images.map(img => {
            if (!img.hash || !hashToImages[img.hash] || hashToImages[img.hash].length < 2) {
                return { ...img, duplicates: [] };
            }

            const dupes = hashToImages[img.hash]
                .filter(other => other.id !== img.id)
                .map(other => ({
                    ...other,
                    sourceName: sourceMap.get(other.sourceId) || DEFAULTS.VAULT_NAME
                }));

            return { ...img, duplicates: dupes };
        });
    }, [images, sources]);

    const { filteredImages } = useImageFilter({
        images: imagesWithDuplicates,
        search: debouncedSearch,
        activeFilter,
        filterCategory,
        activeSourceId,
        sources
    });

    const {
        selectedImage,
        setSelectedImage,
        selectedIds,
        setSelectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        navigateImage
    } = useSelection({ images, activeSourceId });

    const {
        aiSettings,
        setAiSettings,
        updateAISettings,
        generalSettings,
        setGeneralSettings,
        updateGeneralSettings
    } = useSettings();

    const [isBatchProcessing, setIsBatchProcessing] = useState(false);
    const { toasts, addToast, removeToast } = useToaster();


    const {
        history,
        setHistory,
        future,
        setFuture,
        pushHistory,
        canUndo,
        canRedo,
        undoRef,
        redoRef
    } = useHistory();

    const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastRefreshTime = useRef<number>(0);

    const refreshImages = useCallback(async () => {

        const now = Date.now();
        if (now - lastRefreshTime.current < 2000) {

            return;
        }
        lastRefreshTime.current = now;

        try {
            const dbImages = await db.images.orderBy('date').reverse().toArray();
            const dbSources = await db.sources.toArray();

            const storedAI = await db.settings.get('aiSettings');
            if (storedAI) setAiSettings(storedAI.value);

            const storedGen = await db.settings.get('generalSettings');
            if (storedGen) {
                setGeneralSettings(storedGen.value);
            }


            const currentSettings = storedGen?.value || DEFAULT_GENERAL_SETTINGS;
            if (!currentSettings.localVaultPath && isElectron && window.electronAPI?.getDefaultVaultPath) {
                try {
                    const defaultPath = await window.electronAPI.getDefaultVaultPath();
                    const updatedSettings = { ...currentSettings, localVaultPath: defaultPath };
                    setGeneralSettings(updatedSettings);
                    await db.settings.put({ key: 'generalSettings', value: updatedSettings });
                } catch (e) {
                    console.warn('Failed to get default vault path:', e);
                }
            }

            const uiImages: AIImage[] = dbImages.map(img => ({
                ...img,
                src: img.src || '',
                blob: img.blob,
                dominantColors: img.dominantColors || []
            }));

            setImages(uiImages);
            if (dbSources.length > 0) {
                const counts: Record<string, number> = {};
                dbImages.forEach(img => {
                    counts[img.sourceId] = (counts[img.sourceId] || 0) + 1;
                });

                const updatedSources = dbSources.map(s => ({
                    ...s,
                    count: counts[s.id] || 0
                }));
                if (!updatedSources.find(s => s.id === 'internal')) {
                    const internalPath = generalSettings.localVaultPath;
                    updatedSources.unshift({ id: 'internal', name: 'Local Vault', type: 'internal', path: internalPath, count: counts['internal'] || 0 });
                }


                if (isElectron && window.electronAPI?.addToAllowedPaths) {
                    const paths = updatedSources
                        .filter(s => s.type === 'local_folder' && s.path)
                        .map(s => s.path!);
                    if (paths.length > 0) window.electronAPI.addToAllowedPaths(paths);
                }

                setSources(updatedSources);
            } else {

                const internalPath = generalSettings.localVaultPath || (isElectron && window.electronAPI?.getDefaultVaultPath ? await window.electronAPI.getDefaultVaultPath() : undefined);
                const internal: LibrarySource = { id: 'internal', name: 'Local Vault', type: 'internal', path: internalPath, count: uiImages.filter(i => i.sourceId === 'internal').length };
                setSources([internal]);
                await db.sources.put(internal);


                if (isElectron && window.electronAPI?.addToAllowedPaths && generalSettings.localVaultPath) {
                    window.electronAPI.addToAllowedPaths([generalSettings.localVaultPath]);
                }
            }
        } catch (e) {
            console.error("DB Sync Error:", e);
            addToast('error', 'Failed to load library');
        } finally {
            setIsLoading(false);
        }

    }, [isElectron, addToast]);


    const {
        duplicateState,
        setDuplicateState,
        resolveDuplicates
    } = useDuplicates({
        addToast,
        refreshImages,
        isElectron,
        generalSettings
    });


    const {
        removeSource,
        renameSource,
        addSource,
        updateSource
    } = useSources({
        sources,
        setSources,
        activeSourceId,
        setActiveSourceId,
        addToast,
        refreshImages
    });


    const { performDiskSync } = useDiskSync({
        isElectron,
        generalSettings,
        sources,
        addToast
    });

    useEffect(() => {
        if (isElectron && window.electronAPI && generalSettings.localVaultPath) {
            window.electronAPI.addToAllowedPaths([generalSettings.localVaultPath]);
        }
    }, [isElectron, generalSettings.localVaultPath]);

    useEffect(() => {
        // Debounce refresh to prevent spamming
        if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = setTimeout(() => {
            refreshImages();
            refreshTimeoutRef.current = null;
        }, 100);
    }, []);


    const processedMetaIds = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (isLoading || images.length === 0 || !isElectron) return;

        let activeTimer: ReturnType<typeof setTimeout> | null = null;

        const metaWork = async () => {

            const noMetaImgs = images.filter(img =>
                !processedMetaIds.current.has(img.id) &&
                (img.width === 0 || img.model === DEFAULTS.MODEL || !img.dominantColors || img.dominantColors.length === 0) &&
                (img.src.startsWith('file://') || img.blob)
            );

            if (noMetaImgs.length === 0) {
                activeTimer = setTimeout(metaWork, PERFORMANCE_CONFIG.METADATA_TASK_DELAY);
                return;
            }

            const batchCount = PERFORMANCE_CONFIG.METADATA_BATCH_SIZE;
            const batch = noMetaImgs.slice(0, batchCount);
            let hasChanges = false;

            for (const img of batch) {

                processedMetaIds.current.add(img.id);

                try {
                    const exists = await db.images.get(img.id);
                    if (!exists) continue;

                    const { updates, hasChanges: enriched } = await enrichImageMetadata(img);
                    if (Object.keys(updates).length > 0) {
                        // Don't overwrite user-editable fields if they already have meaningful values in DB
                        const dbRecord = await db.images.get(img.id);
                        if (dbRecord) {
                            // Protect prompt if user has edited it (non-empty and different from enrichment source)
                            if (dbRecord.prompt && dbRecord.prompt.trim() !== '' && updates.prompt) {
                                delete updates.prompt;
                            }
                            // Protect negative prompt
                            if (dbRecord.negativePrompt && dbRecord.negativePrompt.trim() !== '' && updates.negativePrompt) {
                                delete updates.negativePrompt;
                            }
                            // Protect tags if user has added any
                            if (dbRecord.tags && dbRecord.tags.length > 0 && updates.tags) {
                                delete updates.tags;
                            }
                            // Protect rating if user has set one
                            if (dbRecord.rating && dbRecord.rating > 0 && updates.rating) {
                                delete updates.rating;
                            }
                        }

                        if (Object.keys(updates).length > 0) {
                            await db.images.update(img.id, updates);
                            if (enriched) hasChanges = true;
                        }
                    }
                } catch (err: any) {
                    const isModifyError =
                        err?.name === 'ModifyError' ||
                        err?.toString().includes('ModifyError') ||
                        (err?.stack && err.stack.includes('ModifyError'));

                    if (!isModifyError) {
                        console.warn(`Background metadata task error for ${img.id}`, err);
                    }
                }
            }
            if (hasChanges) refreshImages();

            if (noMetaImgs.length > batch.length) {
                activeTimer = setTimeout(metaWork, 500);
            } else {
                activeTimer = setTimeout(metaWork, PERFORMANCE_CONFIG.METADATA_TASK_DELAY);
            }
        };

        activeTimer = setTimeout(metaWork, 1000);
        return () => { if (activeTimer) clearTimeout(activeTimer); };
    }, [isLoading, images.length, refreshImages, isElectron]);


    useEffect(() => {
        if (isLoading || images.length === 0 || !isElectron) return;

        let activeTimer: ReturnType<typeof setTimeout> | null = null;

        const hashWork = async () => {
            const noHashImgs = images.filter(img => !img.hash);
            if (noHashImgs.length === 0) {
                activeTimer = setTimeout(hashWork, PERFORMANCE_CONFIG.HASH_TASK_DELAY);
                return;
            }

            const batch = noHashImgs.slice(0, PERFORMANCE_CONFIG.HASH_BATCH_SIZE);
            let needsRefresh = false;

            for (const img of batch) {
                try {
                    let hash: string | undefined;

                    if (img.blob) {
                        hash = await calculateImageHash(img.blob as File);
                    } else if (img.src.startsWith('data:')) {
                        try {
                            const res = await fetch(img.src);
                            const blob = await res.blob();
                            hash = await calculateImageHash(blob);
                        } catch (e) {
                            console.warn("Failed to hash data URI", e);
                        }
                    } else if (img.src.startsWith('file://') && window.electronAPI) {
                        const pathOnly = normalizePath(img.src);
                        const res = await window.electronAPI.calculateHash(pathOnly);
                        if (res.success && res.data) {
                            hash = res.data;
                        }
                    }

                    if (hash) {
                        await db.images.update(img.id, { hash });
                        needsRefresh = true;
                    }
                } catch (err) {
                    console.warn(`Hash task error for ${img.id}`, err);
                }
            }
            if (needsRefresh) refreshImages();

            if (noHashImgs.length > batch.length) {
                activeTimer = setTimeout(hashWork, 1000);
            } else {
                activeTimer = setTimeout(hashWork, PERFORMANCE_CONFIG.HASH_TASK_DELAY);
            }
        };

        activeTimer = setTimeout(hashWork, 2000);
        return () => { if (activeTimer) clearTimeout(activeTimer); };
    }, [isLoading, images.length, refreshImages, isElectron]);


    const watchedPaths = useRef<Set<string>>(new Set());
    const fileEventCleanupRef = useRef<(() => void) | null>(null);

    useEffect(() => {
        if (!isElectron || !window.electronAPI) return;

        const pathsToWatch = new Set<string>();


        if (generalSettings.localVaultPath && window.electronAPI) {
            const vaultPath = generalSettings.localVaultPath;
            pathsToWatch.add(vaultPath);
        }


        sources.forEach(s => {
            if (s.type === 'local_folder' && s.path) {
                pathsToWatch.add(s.path);
            }
        });

        pathsToWatch.forEach(path => {
            if (!watchedPaths.current.has(path) && window.electronAPI) {
                window.electronAPI.watchFolder(path).catch(console.error);
                watchedPaths.current.add(path);
            }
        });


        if (fileEventCleanupRef.current) {
            fileEventCleanupRef.current();
            fileEventCleanupRef.current = null;
        }

        let fileEventDebounceTimer: ReturnType<typeof setTimeout> | null = null;

        const handleFileEvent = async (event: { type: 'add' | 'remove' | 'unlink' | 'change', path: string, folder: string, fileName: string }) => {

            const filePath = event.path || '';
            const fileName = filePath.split(/[\\/]/).pop() || '';

            // Filter out sidecar files, hidden files, and invalid paths
            if (!filePath || fileName.toLowerCase().endsWith('.json') || fileName.toLowerCase().endsWith('.txt') || fileName.startsWith('.')) {
                return;
            }


            await SyncEngine.onFileEvent(
                { type: event.type === 'remove' ? 'unlink' : event.type as any, path: event.path },
                window.electronAPI,
                generalSettings.localVaultPath || ''
            );

            // Debounce refresh
            if (fileEventDebounceTimer) clearTimeout(fileEventDebounceTimer);
            fileEventDebounceTimer = setTimeout(() => {
                refreshImages();
            }, 2000); // Increased debounce to 2s
        };

        window.electronAPI.onFileEvent(handleFileEvent as any);

        return () => {
            if (window.electronAPI && window.electronAPI.offFileEvent) {
                window.electronAPI.offFileEvent();
            }
            if (fileEventDebounceTimer) clearTimeout(fileEventDebounceTimer);
        };
    }, [isElectron, generalSettings.localVaultPath, sources.length, refreshImages]);



    const undo = useCallback(async () => {
        if (undoRef.current) await undoRef.current();
    }, []);

    const redo = useCallback(async () => {
        if (redoRef.current) await redoRef.current();
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement;


            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undo();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    const saveImage = useCallback(async (newImage: AIImage) => {
        if (!isElectron || !window.electronAPI) {

            await db.images.put(newImage);
            await refreshImages();
            return;
        }

        const vaultPath = generalSettings.localVaultPath || await window.electronAPI.getDefaultVaultPath();


        if (newImage.sourceId !== 'internal') {
            await db.images.put(newImage);
            await refreshImages();
            return;
        }

        const result = await SyncEngine.saveNewImage(
            {
                title: newImage.title,
                prompt: newImage.prompt,
                negativePrompt: newImage.negativePrompt,
                model: newImage.model,
                sampler: newImage.sampler,
                cfgScale: newImage.cfgScale,
                steps: newImage.steps,
                seed: newImage.seed,
                width: newImage.width,
                height: newImage.height,
                rating: newImage.rating,
                tags: newImage.tags,
                blob: newImage.blob,
                dataUrl: newImage.src.startsWith('data:') ? newImage.src : undefined
            },
            window.electronAPI,
            vaultPath,
            newImage.id
        );

        if (result.success) {
            addToast('success', 'Image saved to vault');
            await refreshImages();
        } else {
            addToast('error', `Save failed: ${result.error}`);
        }
    }, [addToast, refreshImages, isElectron, generalSettings.localVaultPath]);

    const deleteImage = useCallback(async (id: string, allowPhysicalDelete: boolean = false) => {
        const item = await db.images.get(id);
        if (!item) return;

        if (isElectron && window.electronAPI && item.src?.startsWith('file://')) {
            const delRes = await SyncEngine.deleteFileFromDisk(item.src, window.electronAPI, generalSettings, allowPhysicalDelete);
            if (delRes.success && delRes.backupPath) {
                (item as any).backupPath = delRes.backupPath;
                (item as any).backupBase = delRes.backupBase;
            } else if (!delRes.success && !delRes.skipped) {
                addToast('warning', 'Could not delete file from disk (might be in use).');
            }
        }


        pushHistory({
            type: 'delete',
            timestamp: Date.now(),
            payload: { id },
            undoPayload: item
        });

        await db.images.delete(id);
        await refreshImages();

        if (selectedImage?.id === id) setSelectedImage(null);
        if (selectedIds.has(id)) {
            const newSet = new Set(selectedIds);
            newSet.delete(id);
            setSelectedIds(newSet);
        }
        addToast('info', 'Image removed.');
    }, [selectedImage, selectedIds, addToast, pushHistory, refreshImages, isElectron, generalSettings]);

    const batchDeleteImages = useCallback(async (ids: string[], allowPhysicalDelete: boolean = false) => {
        const items = await db.images.where('id').anyOf(ids).toArray();
        if (items.length === 0) return;


        if (isElectron && window.electronAPI) {
            await Promise.all(items.map(async (img) => {
                if (img.src?.startsWith('file://')) {
                    const delRes = await SyncEngine.deleteFileFromDisk(img.src, window.electronAPI, generalSettings, allowPhysicalDelete);
                    if (delRes.success && delRes.backupPath) {
                        (img as any).backupPath = delRes.backupPath;
                        (img as any).backupBase = delRes.backupBase;
                    }
                }
            }));
        }

        pushHistory({
            type: 'batch_delete',
            timestamp: Date.now(),
            payload: { ids },
            undoPayload: items
        });

        await db.images.bulkDelete(ids);
        setSelectedIds(new Set());
        await refreshImages();
        addToast('success', `${items.length} items removed.`);
    }, [pushHistory, refreshImages, addToast, isElectron, generalSettings]);


    useUndoRedo({
        history,
        future,
        setHistory,
        setFuture,
        undoRef,
        redoRef,
        isElectron,
        performDiskSync,
        refreshImages,
        addToast
    });


    const updateLock = useRef<Set<string>>(new Set());

    const updateImage = useCallback(async (id: string, updates: Partial<AIImage>, skipHistory: boolean = false) => {

        if (updateLock.current.has(id)) {
            return;
        }
        updateLock.current.add(id);

        try {

            const originalImage = await db.images.get(id);
            if (!originalImage) {
                updateLock.current.delete(id);
                return;
            }

            if (!skipHistory) {

                const { src: _hSrc, blob: _hBlob, ...historyUpdates } = updates as any;
                const undoData: Partial<AIImage> = {};
                (Object.keys(historyUpdates) as Array<keyof AIImage>).forEach(key => {
                    undoData[key] = (originalImage as any)[key];
                });

                pushHistory({
                    type: 'update',
                    timestamp: Date.now(),
                    payload: { id, updates: historyUpdates },
                    undoPayload: undoData
                });
            }


            const { src: _src, blob: _blob, ...safeUpdates } = updates as any;
            await db.images.update(id, safeUpdates);



            const updatedItem = await performDiskSync(id, originalImage);


            if (!updatedItem) {
                console.error(`[UpdateImage:${id}] performDiskSync returned undefined, refreshing images`);
                await refreshImages();
                return;
            }
            const uiItem = { ...updatedItem, src: updatedItem.src || '' } as AIImage;
            setImages((prev) => prev.map((img) => (img.id === id ? uiItem : img)));
            if (selectedImage?.id === id) setSelectedImage(uiItem);


            await refreshImages();
        } finally {
            updateLock.current.delete(id);
        }
    }, [selectedImage, refreshImages, pushHistory, performDiskSync]);

    const batchRename = useCallback(async (ids: string[], pattern: 'prompt_snippet' | 'model_seq' | 'date') => {
        const updates: { id: string, changes: Partial<AIImage>, original: AIImage }[] = [];
        const undoData: { id: string, data: Partial<AIImage> }[] = [];
        const targetImages = images.filter(img => ids.includes(img.id));

        targetImages.forEach((img, index) => {
            let newTitle = img.title;
            if (pattern === 'prompt_snippet') {
                const words = img.prompt.split(/\s+/).slice(0, 5).join(' ').replace(/[^a-zA-Z0-9 ]/g, '');
                newTitle = words || "Untitled";
            } else if (pattern === 'date') {
                const dateObj = new Date(img.date);
                const dateStr = dateObj.toISOString().slice(0, 10);
                const timeStr = dateObj.toISOString().slice(11, 19).replace(/:/g, '-');
                newTitle = `${dateStr}_${timeStr}_${index + 1}`;
            } else if (pattern === 'model_seq') {
                newTitle = `${img.model.replace(/[^a-zA-Z0-9]/g, '')}_${index + 1}`.slice(0, 30);
            }

            if (newTitle !== img.title) {
                updates.push({ id: img.id, changes: { title: newTitle }, original: img });
                undoData.push({ id: img.id, data: { title: img.title } });
            }
        });

        if (updates.length > 0) {
            pushHistory({
                type: 'batch_update',
                timestamp: Date.now(),
                payload: { updates: updates.map(u => ({ id: u.id, changes: u.changes })) },
                undoPayload: undoData
            });

            addToast('info', `Renaming ${updates.length} items...`);

            for (const u of updates) {
                await db.images.update(u.id, u.changes);
                if (isElectron) {
                    await performDiskSync(u.id, u.original);
                }
            }

            await refreshImages();
            addToast('success', `Successfully renamed ${updates.length} items.`);
        }
    }, [images, pushHistory, addToast, refreshImages, isElectron, performDiskSync]);



    const generateBatchCaptions = async (overrideStyle?: CaptionStyle) => {
        if (selectedIds.size === 0) return;
        setIsBatchProcessing(true);
        addToast('info', `Starting batch captioning for ${selectedIds.size} items...`);
        const idsToProcess = Array.from(selectedIds);
        let successCount = 0;
        let failCount = 0;

        const batchUpdates: { id: string, changes: Partial<AIImage> }[] = [];
        const batchUndo: { id: string, data: Partial<AIImage> }[] = [];

        for (const id of idsToProcess) {
            const img = images.find(i => i.id === id);
            if (!img) continue;

            try {

                const effectiveSettings = overrideStyle
                    ? { ...aiSettings, activeCaptionStyle: overrideStyle }
                    : aiSettings;

                const newCaption = await generateCaption({ src: img.src, blob: img.blob }, effectiveSettings);

                batchUndo.push({ id, data: { prompt: img.prompt } });
                batchUpdates.push({ id, changes: { prompt: newCaption } });

                await updateImage(id, { prompt: newCaption }, true);

                successCount++;
            } catch (error) {
                console.warn(`Batch caption error for ${id}:`, error);
                failCount++;
            }
        }

        if (batchUpdates.length > 0) {
            pushHistory({
                type: 'batch_update',
                timestamp: Date.now(),
                payload: { updates: batchUpdates },
                undoPayload: batchUndo
            });
        }

        setIsBatchProcessing(false);
        if (failCount > 0) {
            addToast('warning', `Batch finished: ${successCount} success, ${failCount} failed. Check logs/API key.`);
        } else {
            addToast('success', `Batch complete: ${successCount} captioned.`);
        }
    };

    const [pendingImport, setPendingImport] = useState<{ files: (File & { fullPath?: string })[], folderName: string, allFiles: FileList | null, electronPath?: string } | null>(null);


    const addLocalFolder = async (skipImportPreview = false) => {
        if (window.electronAPI) {
            const result = await window.electronAPI.selectFolder();
            if (!result) return;
            const { folderPath, images: scannedFiles } = result;
            const folderName = folderPath.split(/[\\/]/).pop() || "Local Vault";


            const normalizedNew = folderPath.replace(/\\/g, '/').toLowerCase();
            const overlap = sources.find(s => {
                if (!s.path) return false;
                const normalizedExisting = s.path.replace(/\\/g, '/').toLowerCase();



                const existingWithSlash = normalizedExisting.endsWith('/') ? normalizedExisting : normalizedExisting + '/';
                const newWithSlash = normalizedNew.endsWith('/') ? normalizedNew : normalizedNew + '/';


                if (normalizedNew === normalizedExisting) return true;

                return newWithSlash.startsWith(existingWithSlash) || existingWithSlash.startsWith(newWithSlash);
            });

            if (overlap) {
                addToast('warning', `Folder overlaps with existing vault: ${overlap.name}`);
                return;
            }


            if (skipImportPreview) {
                const newSource: LibrarySource = {
                    id: generateId(),
                    name: folderName,
                    type: 'local_folder',
                    path: folderPath,
                    count: scannedFiles?.length || 0
                };
                await db.sources.put(newSource);
                setSources(prev => [...prev, newSource]);
                addToast('success', `Vault "${folderName}" created`);
                if (window.electronAPI.addToAllowedPaths) {
                    window.electronAPI.addToAllowedPaths([folderPath]);
                }
                return;
            }

            setPendingImport({
                files: scannedFiles as any[],
                folderName,
                allFiles: null,
                electronPath: folderPath
            });
            return;
        }

        const input = document.createElement('input');
        input.type = 'file';
        // @ts-ignore
        input.webkitdirectory = true;
        input.multiple = true;
        input.onchange = async (e: Event) => {
            const target = e.target as HTMLInputElement;
            const files = target.files;
            if (!files || files.length === 0) return;
            const folderName = files[0].webkitRelativePath?.split('/')[0] || "Imported Folder";
            const imageFiles = Array.from(files).filter((f: File) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(f.name)) as File[];
            if (imageFiles.length === 0) {
                addToast('error', 'No images found.');
                return;
            }
            setPendingImport({ files: imageFiles, folderName, allFiles: files });
        };
        input.click();
    };

    const confirmImport = async () => {
        if (!pendingImport) return;
        const { files: selectedFiles, allFiles, electronPath } = pendingImport;

        let newSourceId = 'internal';

        // Create new source if linking a folder
        if (electronPath && window.electronAPI) {
            try {
                const folderName = pendingImport.folderName || electronPath.split(/[\\/]/).pop() || 'Linked Folder';

                // Check if source exists
                const existingSource = await db.sources.filter(s => s.path === electronPath).first();
                if (existingSource) {
                    newSourceId = existingSource.id;
                } else {
                    newSourceId = generateId();
                    await db.sources.add({
                        id: newSourceId,
                        name: folderName,
                        type: 'local_folder',
                        path: electronPath,
                        count: 0
                    });
                    // Note: We do NOT call setSources here to avoid early watcher triggering via useEffect.
                    // refreshImages() at the end will handle source updates and watcher initialization.
                }
            } catch (e) { console.error("Source creation failed", e); }
        }

        addToast('info', `Processing ${selectedFiles.length} items...`);
        const newEntries: AIImageDB[] = [];
        const duplicates: AIImageDB[] = [];
        const currentBatchHashes = new Set<string>();

        try {
            for (const file of selectedFiles) {
                const isElectronFile = !!file.fullPath;
                const fileName = isElectronFile ? file.name : (file as File).name;
                const ext = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();

                // Skip non-image files (safety filter)
                if (!['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'].includes(ext)) {
                    continue;
                }

                const baseName = fileName.substring(0, fileName.lastIndexOf('.'));

                let hash = "";
                let extractedMetadata: Partial<AIImage> = {};
                let pureBlob: Blob | undefined;
                let src: string | undefined;

                if (isElectronFile && file.fullPath) {
                    src = `file://${file.fullPath.replace(/\\/g, '/')}`;
                    const res = await window.electronAPI!.calculateHash(file.fullPath);
                    if (res.success && res.data) hash = res.data;

                    // Read sidecar .txt
                    try {
                        const basePath = file.fullPath.substring(0, file.fullPath.lastIndexOf('.'));
                        const sidecar = await window.electronAPI!.readFile(basePath + '.txt');
                        if (sidecar) {
                            extractedMetadata = parseGenerationData(sidecar);
                            if (!extractedMetadata.prompt) extractedMetadata.prompt = sidecar;
                        }
                    } catch (e) { }

                    // Read image metadata (width, height, etc.) from exiftool
                    try {
                        const metaRes = await window.electronAPI!.readMetadata(file.fullPath);
                        if (metaRes.success && metaRes.data) {
                            const m = metaRes.data;
                            extractedMetadata.width = m.ImageWidth || extractedMetadata.width;
                            extractedMetadata.height = m.ImageHeight || extractedMetadata.height;
                            // Also try to get additional metadata from image
                            if (!extractedMetadata.prompt && m.Comments) {
                                const parsed = parseGenerationData(m.Comments);
                                extractedMetadata = { ...extractedMetadata, ...parsed };
                            }
                        }
                    } catch (e) { }
                } else {
                    hash = await calculateImageHash(file as File);
                    const txtFile = allFiles ? Array.from(allFiles).find((f: File) => f.name === `${baseName}.txt`) as File | undefined : undefined;
                    if (txtFile) {
                        const textContent = await txtFile.text();
                        extractedMetadata = parseGenerationData(textContent);
                        if (!extractedMetadata.prompt) extractedMetadata.prompt = textContent;
                    }
                    const arrayBuffer = await (file as File).arrayBuffer();
                    pureBlob = new Blob([arrayBuffer], { type: (file as File).type });
                    if ((file as any).path) src = `file://${(file as any).path.replace(/\\/g, '/')}`;

                    // Get image dimensions using Image object for web mode
                    try {
                        const blobUrl = URL.createObjectURL(pureBlob);
                        const dimensions = await new Promise<{ width: number; height: number }>((resolve) => {
                            const img = new Image();
                            img.onload = () => {
                                resolve({ width: img.naturalWidth, height: img.naturalHeight });
                                URL.revokeObjectURL(blobUrl);
                            };
                            img.onerror = () => {
                                resolve({ width: 0, height: 0 });
                                URL.revokeObjectURL(blobUrl);
                            };
                            img.src = blobUrl;
                        });
                        extractedMetadata.width = dimensions.width;
                        extractedMetadata.height = dimensions.height;
                    } catch (e) { }
                }



                // Check for duplicate BEFORE adding to batch hash set
                const existing = hash ? await db.images.where('hash').equals(hash).first() : null;
                const isDupe = (!!hash && !!existing) || (!!hash && currentBatchHashes.has(hash));
                if (hash) currentBatchHashes.add(hash);

                const initialImg = createBaseImage({
                    sourceId: newSourceId,
                    title: baseName.replace(/_/g, ' '),
                    src: src || "",
                    blob: pureBlob,
                    hash: hash,
                    date: isElectronFile && (file as any).date ? (file as any).date : (new Date(file.lastModified).toISOString() || new Date().toISOString()),
                });

                const mergedImg = { ...initialImg, ...extractedMetadata };

                // Separate duplicates from new entries
                if (isDupe) {

                    duplicates.push(mergedImg);
                } else {
                    newEntries.push(mergedImg);
                }
            }

            // After processing all files, decide what to do
            if (duplicates.length > 0) {
                // There are duplicates - show the modal to let user decide
                setDuplicateState({
                    newImages: newEntries,
                    duplicates: duplicates,
                    sourceName: pendingImport.folderName || 'Linked Folder'
                });
                // Don't clear pendingImport here - modal will handle it
                return;
            } else if (newEntries.length > 0) {
                // No duplicates, proceed with import
                await db.images.bulkAdd(newEntries);
                await refreshImages();
                addToast('success', `Imported ${newEntries.length} images.`);
            } else {
                addToast('info', 'No new images to import.');
            }

        } catch (error) {
            console.error('Import failed:', error);
            addToast('error', 'Import failed. Please try again.');
        } finally {
            setPendingImport(null);
        }
    };

    const cancelImport = useCallback(() => {
        setPendingImport(null);
    }, []);

    const uploadFiles = useCallback(async (files: FileList, targetSourceId: string = 'internal') => {
        const fileGroups: Record<string, { image?: File, text?: File }> = {};
        let processCount = 0;

        Array.from(files).forEach((file: File) => {
            if (file.name.startsWith('.')) return;
            const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            if (!fileGroups[baseName]) fileGroups[baseName] = {};
            if (file.type.startsWith('image/')) {
                fileGroups[baseName].image = file;
                processCount++;
            } else if (file.type === 'text/plain') {
                fileGroups[baseName].text = file;
            }
        });

        if (processCount === 0) return;
        if (processCount > 5) addToast('info', `Processing ${processCount} images...`);

        const newEntries: AIImageDB[] = [];
        const duplicates: AIImageDB[] = [];
        const currentBatchHashes = new Set<string>();

        try {
            for (const [baseName, group] of Object.entries(fileGroups)) {
                if (!group.image) continue;

                // Capture file path for Electron to ensure src is set correctly
                const fPath = isElectron ? (group.image as any).path : undefined;
                let srcString = "";
                if (fPath) {
                    srcString = `file://${fPath.replace(/\\/g, '/')}`;
                }


                const hash = await calculateImageHash(group.image);
                const existing = (!!hash) ? await db.images.where('hash').equals(hash).first() : null;
                const isDupe = (!!hash && !!existing) || (hash && currentBatchHashes.has(hash));
                if (hash) currentBatchHashes.add(hash);

                let extractedMetadata: Partial<AIImage> = {};

                if (group.text) {
                    try {
                        const textContent = await group.text.text();
                        extractedMetadata = parseGenerationData(textContent);
                        if (!extractedMetadata.prompt) extractedMetadata.prompt = textContent;
                    } catch { }
                }

                // Use correct path for metadata reading and include comment parsing
                if (fPath && window.electronAPI?.readMetadata) {

                    try {
                        const mRes = await window.electronAPI.readMetadata(fPath);
                        if (mRes && mRes.success && mRes.data) {
                            const m = mRes.data;
                            extractedMetadata.width = m.ImageWidth || extractedMetadata.width;
                            extractedMetadata.height = m.ImageHeight || extractedMetadata.height;

                            // Also try to parse generation data from Comments/UserComment if not found in txt
                            if (!extractedMetadata.prompt && m.Comments) {
                                const parsed = parseGenerationData(m.Comments);
                                extractedMetadata = { ...extractedMetadata, ...parsed };
                            }
                        }
                    } catch (e) { console.warn("Metadata read error", e); }
                }

                const initialImg = createBaseImage({
                    sourceId: targetSourceId,
                    title: baseName.replace(/_/g, ' '),
                    src: srcString, // Pass the source path directly so performDiskSync can act on it
                    blob: group.image,

                    date: new Date(group.image.lastModified).toISOString(),
                    hash: hash,
                    ...extractedMetadata
                });

                if (isDupe) {
                    duplicates.push({ ...initialImg, isDuplicate: true } as any);
                } else {
                    newEntries.push(initialImg);
                }
            }

            if (duplicates.length > 0) {
                setDuplicateState({
                    newImages: newEntries,
                    duplicates: duplicates,
                    sourceName: 'Drag & Drop Import'
                });
            } else {
                // No duplicates, proceed immediately
                // We must handle physical save here for internal vault
                if (newEntries.length > 0) {
                    if (targetSourceId === 'internal' && isElectron && generalSettings.localVaultPath && window.electronAPI) {
                        const vaultPath = generalSettings.localVaultPath;
                        for (const img of newEntries) {
                            if (img.blob) {
                                try {
                                    const buffer = await img.blob.arrayBuffer();
                                    const ext = img.blob.type.split('/')[1] || 'png';
                                    const safeTitle = sanitizeFilename(img.title);
                                    const filename = `${safeTitle}.${ext}`;
                                    const res = await window.electronAPI.saveBlobToVault({
                                        vaultPath, vaultName: '', filename, buffer, metadata: img
                                    });

                                    if (res.success && res.targetPath) {
                                        img.src = `file://${res.targetPath.replace(/\\/g, '/')}`;
                                        img.blob = undefined;
                                    }
                                } catch (e) { console.error("Save failed", e); }
                            }
                        }
                    }
                    // Bulk add
                    await db.images.bulkAdd(newEntries);
                    await refreshImages();
                    addToast('success', `Imported ${newEntries.length} items.`);
                }
            }

        } catch (e) {
            console.error(e);
            addToast('error', 'Upload failed');
        }

    }, [isElectron, addToast, generalSettings.localVaultPath, db, refreshImages]);

    // NOTE: removeSource, renameSource now come from useSources hook

    const factoryReset = useCallback(async () => {
        if (isElectron && window.electronAPI?.clearVault) {
            await window.electronAPI.clearVault();
        }
        await clearDatabase();
        setImages([]);
        setSources([{ id: 'internal', name: 'Local Vault', type: 'internal', count: 0 }]);
        setAiSettings(DEFAULT_AI_SETTINGS);
        setGeneralSettings(DEFAULT_GENERAL_SETTINGS);
        await db.settings.clear();
        addToast('success', 'Factory reset complete.');
    }, [addToast]);

    // Placeholder for new functions from contextValue
    const toggleFavorite = useCallback(async (id: string) => {
        const img = images.find(i => i.id === id);
        if (img) {
            // Toggle between rating 5 (favorite) and 0 (not favorite) until isFavorite field is added
            const newRating = (img.rating === 5) ? 0 : 5;
            await updateImage(id, { rating: newRating });
            addToast('info', `Image ${newRating === 5 ? 'favorited' : 'unfavorited'}.`);
        }
    }, [images, updateImage, addToast]);

    // NOTE: addSource, updateSource now come from useSources hook

    const hasVerifiedIntegrity = useRef(false);

    const checkActiveSource = useCallback(async () => {
        if (!isElectron || !window.electronAPI?.scanDirectory) {
            return;
        }


        const syncSources = activeSourceId === 'all'
            ? sources
            : sources.filter(s => s.id === activeSourceId);



        if (syncSources.length === 0 && activeSourceId !== 'all') {
            addToast('error', 'Cannot determine source to scan.');
            return;
        }

        addToast('info', syncSources.length > 1 ? `Refreshing all ${syncSources.length} sources...` : `Scanning for missing files...`);

        let totalAdded = 0;
        let totalRemoved = 0;

        try {
            for (const source of syncSources) {
                let targetPath: string | undefined = source.path;
                const targetSourceId = source.id;



                if (source.id === 'internal') {
                    const vaultPath = generalSettings.localVaultPath || await window.electronAPI.getDefaultVaultPath();
                    targetPath = vaultPath;
                }


                if (!targetPath) {
                    continue;
                }


                const result = await window.electronAPI.scanDirectory(targetPath);

                if (!result) {
                    continue;
                }

                if (!result.images) {
                    continue;
                }



                // Check ALL images for path match, not just those with matching sourceId
                // This prevents duplicates when files were imported with wrong sourceId
                const allKnownPaths = new Map<string, AIImage>();

                images.forEach(img => {
                    if (img.src) {
                        allKnownPaths.set(normalizePath(img.src).toLowerCase(), img);
                    }
                });



                for (const file of result.images) {
                    const fileUrl = `file://${file.fullPath.replace(/\\/g, '/')}`;
                    const normalizedUrl = normalizePath(fileUrl).toLowerCase();

                    const existingImage = allKnownPaths.get(normalizedUrl);

                    if (existingImage) {
                        // File already exists in DB
                        if (existingImage.sourceId !== targetSourceId) {
                            // File exists but has wrong sourceId - UPDATE it!

                            await db.images.update(existingImage.id, { sourceId: targetSourceId });
                            totalAdded++; // Count as "added" to this source
                        }
                        // Otherwise, file is already correctly associated, skip
                    } else {
                        // New file, add it
                        const newImage = createBaseImage({
                            src: fileUrl,
                            title: file.name.split('.')[0],
                            sourceId: targetSourceId,
                            date: file.date,
                            width: 0,
                            height: 0
                        });

                        try {
                            const { updates } = await enrichImageMetadata(newImage);
                            Object.assign(newImage, updates);
                        } catch (e) { }

                        try {
                            await db.images.put(newImage);
                            totalAdded++;
                        } catch (err) {
                            console.error(`[CheckActiveSource] Failed to add image:`, err);
                        }
                    }
                }

                // Sync Deletions - find images that are in DB for this source but not on disk
                const diskPaths = new Set(result.images.map(f => {
                    const url = `file://${f.fullPath.replace(/\\/g, '/')}`;
                    return normalizePath(url).toLowerCase();
                }));

                // Get images for this specific source to check for deletions
                const imagesForThisSource = images.filter(img => img.sourceId === targetSourceId);
                const imagesToRemove: string[] = [];
                for (const img of imagesForThisSource) {
                    if (img.src && img.src.startsWith('file://')) {
                        const normSrc = normalizePath(img.src).toLowerCase();
                        if (!diskPaths.has(normSrc)) {
                            imagesToRemove.push(img.id);
                        }
                    }
                }

                if (imagesToRemove.length > 0) {
                    await db.images.bulkDelete(imagesToRemove);
                    totalRemoved += imagesToRemove.length;
                }
            }

            if (totalAdded > 0 || totalRemoved > 0) {
                await refreshImages();
                addToast('success', `Sync complete: +${totalAdded} added, -${totalRemoved} removed.`);
            } else {
                addToast('success', 'Library is up to date.');
            }

        } catch (e) {
            console.error('[Scan] Error:', e);
            addToast('error', 'Scan encountered an error.');
        }

    }, [isElectron, activeSourceId, generalSettings.localVaultPath, sources, images, addToast, refreshImages]);

    const verifyLibraryIntegrity = async () => {
        if (!isElectron || !window.electronAPI) return;



        try {
            const result = await SyncEngine.reconcile(
                window.electronAPI,
                generalSettings.localVaultPath
            );

            if (result.orphaned > 0) {
                addToast('info', `Cleaned up ${result.orphaned} missing files`);
                refreshImages();
            } else {
            }
        } catch (e) {
            console.error("Reconciliation error:", e);
        }
    };

    useEffect(() => {
        if (!isLoading && images.length > 0 && isElectron && !hasVerifiedIntegrity.current) {
            hasVerifiedIntegrity.current = true;
            // Delay slightly to let app settle
            setTimeout(() => {
                verifyLibraryIntegrity();
            }, 2000);
        }
    }, [isLoading, images.length, isElectron]);

    // Context Value
    const contextValue: AppContextType = {

        images,
        filteredImages,
        isLoading,
        selectedImage,
        setSelectedImage,
        search,
        setSearch,
        activeFilter,
        setActiveFilter,
        filterCategory,
        setFilterCategory,
        saveImage,
        deleteImage,
        refreshImages,
        updateImage,
        toggleFavorite,
        navigateImage,
        aiSettings,
        updateAISettings,
        generalSettings,
        updateGeneralSettings,
        history,
        future,
        undo,
        redo,
        addToast,
        removeToast,
        toasts,
        factoryReset,
        sources,
        activeSourceId,
        setActiveSourceId,
        addLocalFolder,
        removeSource,
        renameSource,
        selectedIds,
        toggleSelection,
        clearSelection,
        selectAll,
        generateBatchCaptions,
        batchRename,
        batchDeleteImages,
        uploadFiles,
        confirmImport,
        cancelImport,
        pendingImport,
        isBatchProcessing,
        checkActiveSource,
        canUndo,
        canRedo,
        duplicateState,
        resolveDuplicates
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}

            {pendingImport && (
                <ImportPreviewModal
                    files={pendingImport.files}
                    allFiles={pendingImport.allFiles}
                    folderName={pendingImport.folderName}
                    onConfirm={confirmImport}
                    onCancel={cancelImport}
                    isElectron={isElectron}
                />
            )}

            {duplicateState && (
                <DuplicateConflictModal
                    duplicateState={duplicateState}
                    onResolve={resolveDuplicates}
                    onCancel={() => setDuplicateState(null)}
                />
            )}
        </AppContext.Provider>
    );
};
