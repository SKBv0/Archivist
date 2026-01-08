import { AIImage, LibrarySource, FilterCategory, AIImageDB, AISettings, GeneralSettings, HistoryAction } from '../types';
import { Toast, ToastType } from '../components/Toaster';

/**
 * Main application context type.
 * Extracted from context.tsx for modularity.
 */
export interface AppContextType {
    // Image State
    images: AIImage[];
    filteredImages: AIImage[];
    isLoading: boolean;
    selectedImage: AIImage | null;
    setSelectedImage: (image: AIImage | null) => void;
    navigateImage: (direction: 'next' | 'prev') => void;

    // Search & Filter
    search: string;
    setSearch: (val: string) => void;
    activeFilter: string | null;
    setActiveFilter: (val: string | null) => void;
    filterCategory: FilterCategory;
    setFilterCategory: (val: FilterCategory) => void;

    // Selection
    selectedIds: Set<string>;
    toggleSelection: (id: string) => void;
    selectAll: (ids: string[]) => void;
    clearSelection: () => void;

    // Sources
    sources: LibrarySource[];
    activeSourceId: string | 'all';
    setActiveSourceId: (id: string | 'all') => void;
    addLocalFolder: (skipImportPreview?: boolean) => Promise<void>;
    removeSource: (sourceId: string, deleteImages?: boolean) => Promise<void>;
    renameSource: (sourceId: string, newName: string) => Promise<void>;

    // Image Operations
    saveImage: (image: AIImage) => void;
    deleteImage: (id: string) => void;
    updateImage: (id: string, updates: Partial<AIImage>) => void;
    uploadFiles: (files: FileList, targetSourceId?: string) => Promise<void>;

    // Batch Operations
    batchRename: (ids: string[], pattern: 'prompt_snippet' | 'model_seq' | 'date') => void;
    batchDeleteImages: (ids: string[]) => Promise<void>;

    // Settings
    aiSettings: AISettings;
    updateAISettings: (settings: Partial<AISettings>) => void;
    generalSettings: GeneralSettings;
    updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;

    // Batch Processing
    isBatchProcessing: boolean;
    generateBatchCaptions: () => Promise<void>;

    // Toasts
    toasts: Toast[];
    addToast: (type: ToastType, message: string) => void;
    removeToast: (id: string) => void;

    // History (Undo/Redo)
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    history: HistoryAction[];
    future: HistoryAction[];

    // System
    factoryReset: () => Promise<void>;
    checkActiveSource: () => Promise<void>;
    refreshImages: () => Promise<void>;
    toggleFavorite: (id: string) => void;

    // Import
    pendingImport: { files: (File & { fullPath?: string })[], folderName: string, allFiles: FileList | null, electronPath?: string } | null;
    confirmImport: (selectedFiles: (File & { fullPath?: string })[]) => Promise<void>;
    cancelImport: () => void;

    // Duplicate Handling
    duplicateState: { newImages: AIImageDB[], duplicates: AIImageDB[], sourceName: string } | null;
    resolveDuplicates: (action: 'skip' | 'keep') => Promise<void>;
}
