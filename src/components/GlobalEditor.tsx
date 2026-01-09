import React, { useState, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { ToastType } from './Toaster';
import { AIImage, AISettings, GeneralSettings, LibrarySource } from '../types';
import { generateCaption } from '../services/ai';
import { extractTagsFromPrompt } from '../utils';
import EditorToolbar from './editor/EditorToolbar';
import EditorSidebar from './editor/EditorSidebar';
import ImageCanvas from './editor/ImageCanvas';

interface EditorPanelProps {
    image: AIImage;
    imagesCount: number;
    currentIndex: number;
    onClose: () => void;
    onSave: (img: AIImage) => void;
    onDelete: (id: string) => void;
    onNavigate: (dir: 'next' | 'prev') => void;
    aiSettings: AISettings;
    updateAISettings: (s: Partial<AISettings>) => void;
    addToast: (type: ToastType, msg: string) => void;
    updateGeneralSettings: (s: Partial<GeneralSettings>) => void;
    generalSettings: GeneralSettings;
    sources: LibrarySource[];
    updateImage: (id: string, updates: Partial<AIImage>) => void;
    addLocalFolder?: () => void;
}

const EditorPanel: React.FC<EditorPanelProps> = memo(({
    image, imagesCount, currentIndex, onClose, onSave, onDelete, onNavigate, aiSettings, updateAISettings, addToast, updateGeneralSettings, generalSettings, sources, updateImage, addLocalFolder
}) => {
    const [localState, setLocalState] = useState<AIImage>(image);
    const [activeTab, setActiveTab] = useState<'metadata' | 'caption'>('metadata');
    const [isCopied, setIsCopied] = useState(false);
    const [isAnalyzingTags, setIsAnalyzingTags] = useState(false);
    const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [isTagInputActive, setIsTagInputActive] = useState(false);

    useEffect(() => {
        // Only reset localState when navigating to a DIFFERENT image
        // This prevents losing user edits when refreshImages() updates the same image
        setLocalState(prev => {
            if (prev.id !== image.id) {
                // Different image - reset everything
                setIsTagInputActive(false);
                setTagInput("");
                return image;
            }
            // Same image - merge: keep user-editable fields, sync system fields
            // User-editable fields to preserve: prompt, negativePrompt, tags, rating, title
            // System fields to sync: dominantColors, width, height, src, hash, etc.
            return {
                ...image, // Start with fresh data from DB
                // Preserve user-editable fields from localState
                prompt: prev.prompt,
                negativePrompt: prev.negativePrompt,
                tags: prev.tags,
                rating: prev.rating,
                title: prev.title,
                model: prev.model,
                sampler: prev.sampler,
                cfgScale: prev.cfgScale,
                steps: prev.steps,
            };
        });
    }, [image]);

    const handleChange = (field: keyof AIImage, value: AIImage[keyof AIImage]) => {
        setLocalState(prev => ({ ...prev, [field]: value }));

        // Auto-save rating changes immediately for real-time sync with hover UI
        if (field === 'rating') {
            updateImage(localState.id, { rating: value as number | undefined });
        }
    };

    const handleSaveLocal = () => {
        // Differential update to prevent overwriting with outdated local state
        const updates: Partial<AIImage> = { id: localState.id };
        let hasChanges = false;

        (Object.keys(localState) as Array<keyof AIImage>).forEach(key => {
            if (key === 'id') return;

            if (JSON.stringify(localState[key]) !== JSON.stringify(image[key])) {
                updates[key] = localState[key] as any;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            onSave(updates as AIImage);
        } else {
            onSave({ id: localState.id } as AIImage);
        }
    };

    const handleDeleteLocal = () => {
        onDelete(localState.id);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(localState.prompt);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
        addToast('info', 'Prompt copied to clipboard');
    };
    const handleAutoTag = () => {
        const prompt = localState.prompt;
        if (!prompt) {
            addToast('info', 'Prompt is empty. Add a prompt to extract tags.');
            return;
        }

        setIsAnalyzingTags(true);
        try {
            const extracted = extractTagsFromPrompt(prompt);

            if (extracted.length > 0) {
                const currentTags = localState.tags || [];
                const mergedTags = [...new Set([...currentTags, ...extracted])];
                handleChange('tags', mergedTags);
                addToast('success', `Extracted ${extracted.length} tags from prompt.`);
            } else {
                addToast('info', 'No relevant tags found in prompt.');
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Extraction error";
            addToast('error', `Extraction failed: ${msg}`);
        } finally {
            setIsAnalyzingTags(false);
        }
    };

    const handleMagicCaption = async () => {

        setIsGeneratingCaption(true);
        try {
            const caption = await generateCaption({ src: localState.src, blob: localState.blob }, aiSettings);
            if (caption) {
                handleChange('prompt', caption.trim());
                addToast('success', "Caption generated successfully.");
            }
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : "Caption error";
            addToast('error', `Caption generation failed: ${msg}`);
        } finally {
            setIsGeneratingCaption(false);
        }
    };

    const handleAddTag = () => {
        const trimmed = tagInput.trim().toLowerCase();
        const currentTags = localState.tags || [];
        if (trimmed && !currentTags.includes(trimmed)) {
            handleChange('tags', [...currentTags, trimmed]);
            setTagInput("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        handleChange('tags', (localState.tags || []).filter(t => t !== tagToRemove));
    };

    const onTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            handleAddTag();
        }
        if (e.key === 'Backspace' && tagInput === '' && (localState.tags || []).length > 0) {
            const lastTag = localState.tags[localState.tags.length - 1];
            handleRemoveTag(lastTag);
        }
    };

    useEffect(() => {
        const handleRatingKeys = (e: KeyboardEvent) => {
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

            const key = parseInt(e.key);
            if (!isNaN(key) && key >= 1 && key <= 5) {
                e.preventDefault();
                handleChange('rating', key === localState.rating ? 0 : key);
            }
            if (e.key === '0') {
                e.preventDefault();
                handleChange('rating', 0);
            }
        };

        window.addEventListener('keydown', handleRatingKeys);
        return () => window.removeEventListener('keydown', handleRatingKeys);
    }, [localState.rating]);


    const isElectron = !!window.electronAPI;
    const platform = window.electronAPI?.platform;

    return (
        <div className="fixed inset-0 z-[100] bg-background flex animate-fade-in font-sans">
            <div className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
                <EditorToolbar
                    onClose={onClose}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    currentIndex={currentIndex}
                    totalCount={imagesCount}
                    onNavigate={onNavigate}
                    onDelete={handleDeleteLocal}
                    onSave={handleSaveLocal}
                    updateGeneralSettings={updateGeneralSettings}
                    title={localState.title || 'Untitled Image'}
                />

                <div className={`flex-1 flex h-full w-full overflow-hidden ${isElectron && platform !== 'darwin' ? 'pt-24' : 'pt-16'}`}>
                    <ImageCanvas image={localState} generalSettings={generalSettings} updateImage={updateImage} sources={sources} />

                    <EditorSidebar
                        activeTab={activeTab}
                        localState={localState}
                        handleChange={handleChange}
                        aiSettings={aiSettings}
                        updateAISettings={updateAISettings}
                        tagInput={tagInput}
                        setTagInput={setTagInput}
                        isTagInputActive={isTagInputActive}
                        setIsTagInputActive={setIsTagInputActive}
                        handleAddTag={handleAddTag}
                        handleRemoveTag={handleRemoveTag}
                        onTagKeyDown={onTagKeyDown}
                        handleAutoTag={handleAutoTag}
                        isAnalyzingTags={isAnalyzingTags}
                        handleMagicCaption={handleMagicCaption}
                        isGeneratingCaption={isGeneratingCaption}
                        handleCopy={handleCopy}
                        isCopied={isCopied}
                        sources={sources}
                        addLocalFolder={addLocalFolder}
                    />
                </div>
            </div>
        </div>
    );
});

const GlobalEditor = () => {
    const { selectedImage, setSelectedImage, updateImage, deleteImage, navigateImage, images, aiSettings, updateAISettings, addToast, updateGeneralSettings, generalSettings, sources, addLocalFolder } = useApp();
    const location = useLocation();

    useEffect(() => {
        if (selectedImage) setSelectedImage(null);
    }, [location.pathname]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!selectedImage) return;
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                if (e.key === 'Escape') (document.activeElement as HTMLElement).blur();
                return;
            }
            if (e.key === 'Escape') setSelectedImage(null);
            if (e.key === 'ArrowLeft' && !e.ctrlKey) navigateImage('prev');
            if (e.key === 'ArrowRight' && !e.ctrlKey) navigateImage('next');
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImage, navigateImage, setSelectedImage]);

    if (!selectedImage) return null;

    return createPortal(
        <EditorPanel
            image={selectedImage}
            imagesCount={images.length}
            currentIndex={images.findIndex(img => img.id === selectedImage.id)}
            onClose={() => setSelectedImage(null)}
            onSave={(img) => { updateImage(img.id, img); }}
            onDelete={(id) => deleteImage(id)}
            onNavigate={navigateImage}
            aiSettings={aiSettings}
            updateAISettings={updateAISettings}
            addToast={addToast}
            updateGeneralSettings={updateGeneralSettings}
            generalSettings={generalSettings}
            sources={sources}
            updateImage={updateImage}
            addLocalFolder={addLocalFolder}
        />,
        document.body
    );
};

export default GlobalEditor;