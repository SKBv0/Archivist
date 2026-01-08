import { useState, useCallback, useMemo } from 'react';
import { AIImage } from '../../types';

interface UseSelectionOptions {
    images: AIImage[];
    activeSourceId: string | 'all';
}

interface UseSelectionReturn {
    selectedImage: AIImage | null;
    setSelectedImage: (image: AIImage | null) => void;
    selectedIds: Set<string>;
    setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
    toggleSelection: (id: string) => void;
    selectAll: (ids: string[]) => void;
    clearSelection: () => void;
    navigateImage: (direction: 'next' | 'prev') => void;
}

export function useSelection({ images, activeSourceId }: UseSelectionOptions): UseSelectionReturn {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const selectedImage = useMemo(() => {
        if (!selectedId) return null;
        return images.find(img => img.id === selectedId) || null;
    }, [images, selectedId]);

    const setSelectedImage = useCallback((image: AIImage | null) => {
        setSelectedId(image?.id || null);
    }, []);

    const navigateImage = useCallback((direction: 'next' | 'prev') => {
        if (!selectedId) return;
        const currentViewImages = images.filter(img => activeSourceId === 'all' || img.sourceId === activeSourceId);
        const currentIndex = currentViewImages.findIndex(img => img.id === selectedId);
        if (currentIndex === -1) return;
        let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
        if (newIndex >= 0 && newIndex < currentViewImages.length) {
            setSelectedId(currentViewImages[newIndex].id);
        }
    }, [images, activeSourceId, selectedId]);

    const toggleSelection = useCallback((id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    }, []);

    const selectAll = useCallback((ids: string[]) => {
        setSelectedIds(new Set(ids));
    }, []);

    const clearSelection = useCallback(() => {
        setSelectedIds(new Set());
    }, []);

    return {
        selectedImage,
        setSelectedImage,
        selectedIds,
        setSelectedIds,
        toggleSelection,
        selectAll,
        clearSelection,
        navigateImage
    };
}
