import { useCallback } from 'react';
import { LibrarySource } from '../../types';
import { db } from '../../db';
import { ToastType } from '../../components/Toaster';

interface UseSourcesOptions {
    sources: LibrarySource[];
    setSources: React.Dispatch<React.SetStateAction<LibrarySource[]>>;
    activeSourceId: string | 'all';
    setActiveSourceId: (id: string | 'all') => void;
    addToast: (type: ToastType, message: string) => void;
    refreshImages: () => Promise<void>;
}

interface UseSourcesReturn {
    removeSource: (sourceId: string, deleteImages?: boolean) => Promise<void>;
    renameSource: (sourceId: string, newName: string) => Promise<void>;
    addSource: (source: LibrarySource) => Promise<void>;
    updateSource: (sourceId: string, updates: Partial<LibrarySource>) => Promise<void>;
}

export function useSources({
    sources,
    setSources,
    activeSourceId,
    setActiveSourceId,
    addToast,
    refreshImages
}: UseSourcesOptions): UseSourcesReturn {

    const removeSource = useCallback(async (sourceId: string, deleteImages: boolean = false) => {
        if (sourceId === 'internal') {
            addToast('error', 'Cannot remove the Local Vault.');
            return;
        }

        const source = sources.find((s: LibrarySource) => s.id === sourceId);
        if (!source) return;

        if (deleteImages) {
            await db.images.where('sourceId').equals(sourceId).delete();
        } else {
            await db.images.where('sourceId').equals(sourceId).modify({ sourceId: 'internal' });
        }

        await db.sources.delete(sourceId);

        setSources((prev: LibrarySource[]) => prev.filter((s: LibrarySource) => s.id !== sourceId));

        if (activeSourceId === sourceId) {
            setActiveSourceId('all');
        }

        await refreshImages();
        addToast('success', `Folder "${source.name}" has been unlinked.`);
    }, [sources, activeSourceId, addToast, refreshImages, setSources, setActiveSourceId]);

    const renameSource = useCallback(async (sourceId: string, newName: string) => {
        if (!newName.trim()) {
            addToast('error', 'Name cannot be empty.');
            return;
        }

        await db.sources.update(sourceId, { name: newName.trim() });
        setSources(prev => prev.map(s =>
            s.id === sourceId ? { ...s, name: newName.trim() } : s
        ));
        addToast('success', 'Folder renamed successfully.');
    }, [addToast, setSources]);

    const addSource = useCallback(async (source: LibrarySource) => {
        await db.sources.put(source);
        setSources(prev => [...prev, source]);
        await refreshImages();
    }, [refreshImages, setSources]);

    const updateSource = useCallback(async (sourceId: string, updates: Partial<LibrarySource>) => {
        await db.sources.update(sourceId, updates);
        setSources(prev => prev.map(s => s.id === sourceId ? { ...s, ...updates } : s));
        await refreshImages();
    }, [refreshImages, setSources]);

    return {
        removeSource,
        renameSource,
        addSource,
        updateSource
    };
}
