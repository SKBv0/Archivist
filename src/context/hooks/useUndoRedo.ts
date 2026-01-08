import { useEffect } from 'react';
import { AIImage, AIImageDB, HistoryAction } from '../../types';
import { db } from '../../db';
import { ToastType } from '../../components/Toaster';

interface UseUndoRedoOptions {
    history: HistoryAction[];
    future: HistoryAction[];
    setHistory: React.Dispatch<React.SetStateAction<HistoryAction[]>>;
    setFuture: React.Dispatch<React.SetStateAction<HistoryAction[]>>;
    undoRef: React.MutableRefObject<(() => Promise<void>) | undefined>;
    redoRef: React.MutableRefObject<(() => Promise<void>) | undefined>;
    isElectron: boolean;
    performDiskSync: (id: string, originalImage: AIImageDB) => Promise<AIImage | undefined>;
    refreshImages: () => Promise<void>;
    addToast: (type: ToastType, message: string) => void;
}
export function useUndoRedo({
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
}: UseUndoRedoOptions): void {

    useEffect(() => {
        undoRef.current = async () => {
            if (history.length === 0) return;
            const action = history[history.length - 1];
            const newHistory = history.slice(0, -1);

            setHistory(newHistory);
            setFuture(prev => [action, ...prev]);

            if (action.type === 'update') {
                const id = action.payload.id;
                const updates = action.undoPayload as Partial<AIImage>;


                const beforeUndo = await db.images.get(id);


                await db.images.update(id, updates);


                if (beforeUndo && isElectron) {
                    await performDiskSync(id, beforeUndo);
                }
            } else if (action.type === 'delete') {
                const restoredImage = action.undoPayload as AIImageDB;


                if (isElectron && window.electronAPI?.restoreFile && (restoredImage as any).backupPath) {
                    const backupPath = (restoredImage as any).backupPath;
                    const backupBase = (restoredImage as any).backupBase;

                    if (restoredImage.src?.startsWith('file://')) {
                        const pRes = await window.electronAPI.getFsPath(restoredImage.src);
                        if (pRes.success && pRes.path) {
                            await window.electronAPI.restoreFile({
                                backupPath,
                                targetPath: pRes.path,
                                backupBase
                            });
                        }
                    }
                }

                await db.images.add(restoredImage);
            } else if (action.type === 'batch_delete') {
                const restoredImages = action.undoPayload as AIImageDB[];


                if (isElectron && window.electronAPI?.restoreFile) {
                    for (const img of restoredImages) {
                        if ((img as any).backupPath) {
                            const backupPath = (img as any).backupPath;
                            const backupBase = (img as any).backupBase;
                            if (img.src?.startsWith('file://')) {
                                const pRes = await window.electronAPI.getFsPath(img.src);
                                if (pRes.success && pRes.path) {
                                    await window.electronAPI.restoreFile({
                                        backupPath,
                                        targetPath: pRes.path,
                                        backupBase
                                    });
                                }
                            }
                        }
                    }
                }

                await db.images.bulkAdd(restoredImages);
            } else if (action.type === 'batch_update') {
                const updates = action.undoPayload;
                for (const item of updates) {
                    const beforeUndo = await db.images.get(item.id);
                    await db.images.update(item.id, item.data);
                    if (beforeUndo && isElectron) {
                        await performDiskSync(item.id, beforeUndo);
                    }
                }
            }
            await refreshImages();
            addToast('info', 'Undo successful');
        };

        redoRef.current = async () => {
            if (future.length === 0) return;
            const action = future[0];
            const newFuture = future.slice(1);

            setFuture(newFuture);
            setHistory(prev => [...prev, action]);

            if (action.type === 'update') {
                const id = action.payload.id;
                const beforeRedo = await db.images.get(id);
                await db.images.update(id, action.payload.updates);
                if (beforeRedo && isElectron) {
                    await performDiskSync(id, beforeRedo);
                }
            } else if (action.type === 'delete') {
                await db.images.delete(action.payload.id);
            } else if (action.type === 'batch_delete') {
                const ids = action.payload.ids as string[];
                await db.images.bulkDelete(ids);
            } else if (action.type === 'batch_update') {
                const updates = action.payload.updates;
                for (const item of updates) {
                    const beforeRedo = await db.images.get(item.id);
                    await db.images.update(item.id, item.changes);
                    if (beforeRedo && isElectron) {
                        await performDiskSync(item.id, beforeRedo);
                    }
                }
            }
            await refreshImages();
            addToast('info', 'Redo successful');
        };
    }, [history, future, setHistory, setFuture, undoRef, redoRef, isElectron, performDiskSync, refreshImages, addToast]);
}
