import { useState, useEffect, useMemo, forwardRef, HTMLAttributes, MouseEvent, useCallback } from 'react';
import { useApp } from '../hooks/useApp';
import {
    CheckCircle, Circle, Sparkles
} from 'lucide-react';
import { Virtuoso, VirtuosoGrid } from 'react-virtuoso';
import { getAspectRatioBucket, blobToBase64 } from '../utils';
import { DEFAULTS } from '../constants';

import { GalleryItem, WorkbenchItem } from './ArchiveListItems';
import ArchiveSidebar from '../components/archive/ArchiveSidebar';
import ArchiveHeader from '../components/archive/ArchiveHeader';
import ArchiveFilters from '../components/archive/ArchiveFilters';
import EmptyState from '../components/archive/EmptyState';
import WorkbenchColumnsMenu from '../components/archive/WorkbenchColumnsMenu';
import SelectionFloatingBar from '../components/archive/SelectionFloatingBar';

type WorkspaceMode = 'gallery' | 'workbench';

const Archive = () => {
    const {
        images, isLoading, setSelectedImage, updateImage,
        selectedIds, toggleSelection, selectAll, clearSelection,
        generateBatchCaptions, isBatchProcessing,
        sources = [], activeSourceId, setActiveSourceId, addLocalFolder,
        removeSource, renameSource,
        generalSettings, updateGeneralSettings, addToast,
        undo, redo, canUndo, canRedo, batchRename, batchDeleteImages,
        filteredImages, search, setSearch, activeFilter, setActiveFilter, filterCategory, setFilterCategory,
        checkActiveSource
    } = useApp();

    const isElectron = !!window.electronAPI;
    const platform = window.electronAPI?.platform;

    const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('gallery');
    const [showFilters, setShowFilters] = useState(false);

    const [showRenameModal, setShowRenameModal] = useState(false);
    const [showVaultManager, setShowVaultManager] = useState(false);
    const [editingSourceId, setEditingSourceId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);
    const [showExportOptions, setShowExportOptions] = useState(false);
    const [showColumnsMenu, setShowColumnsMenu] = useState(false);
    const [exportOptions, setExportOptions] = useState({ includeImage: true, includeTxt: true, includeJson: true });
    const [showAddVaultMenu, setShowAddVaultMenu] = useState(false);
    const [tooltip, setTooltip] = useState<{ y: number, text: string } | null>(null);

    const sourceImages = useMemo(() => {
        if (activeSourceId === 'all') return images || [];
        return (images || []).filter(img => img.sourceId === activeSourceId);
    }, [images, activeSourceId]);

    const activeCategoryItems = useMemo(() => {
        const counts: Record<string, number> = {};
        sourceImages.forEach(img => {
            if (filterCategory === 'tags') {
                (img.tags || []).forEach(tag => counts[tag] = (counts[tag] || 0) + 1);
            } else if (filterCategory === 'models') {
                const model = img.model || DEFAULTS.MODEL;
                counts[model] = (counts[model] || 0) + 1;
            } else if (filterCategory === 'loras') {
                (img.loras || []).forEach(lora => {
                    const name = lora.name || DEFAULTS.LORA_NAME;
                    counts[name] = (counts[name] || 0) + 1;
                });
            } else if (filterCategory === 'samplers') {
                const sampler = img.sampler || DEFAULTS.SAMPLER;
                counts[sampler] = (counts[sampler] || 0) + 1;
            } else if (filterCategory === 'steps') {
                counts[img.steps?.toString() || 'N/A'] = (counts[img.steps?.toString() || 'N/A'] || 0) + 1;
            } else if (filterCategory === 'cfg') {
                counts[img.cfgScale?.toString() || 'N/A'] = (counts[img.cfgScale?.toString() || 'N/A'] || 0) + 1;
            } else if (filterCategory === 'ratio') {
                const ratio = getAspectRatioBucket(img.width || 0, img.height || 0);
                counts[ratio] = (counts[ratio] || 0) + 1;
            } else if (filterCategory === 'rating') {
                const r = img.rating || 0;
                const label = r === 0 ? 'Unrated' : `${r} Stars`;
                counts[label] = (counts[label] || 0) + 1;
            } else if (filterCategory === 'colors') {
                (img.dominantColors || []).forEach(color => counts[color] = (counts[color] || 0) + 1);
            }
        });
        return Object.entries(counts).sort((a, b) => b[1] - a[1]);
    }, [sourceImages, filterCategory]);

    const handleSelectAll = () => {
        if (selectedIds.size === filteredImages.length) clearSelection();
        else selectAll(filteredImages.map(img => img.id));
    };

    const handleExport = async () => {
        if (!window.electronAPI?.exportDataset) {
            addToast('success', 'Metadata exported as JSON');
            return;
        }

        addToast('info', 'Exporting dataset...');
        setShowExportOptions(false);
        const selectedItems = images.filter(img => selectedIds.has(img.id));

        try {
            const result = await window.electronAPI.exportDataset({
                items: await Promise.all(selectedItems.map(async img => ({
                    ...img,
                    blobData: img.blob ? await blobToBase64(img.blob) : undefined
                }))),
                exportOptions
            });
            if (result.success) addToast('success', `Exported to ${result.path}`);
        } catch (err) {
            addToast('error', 'Export failed');
        }
    };

    const handleAddToVault = (targetSourceId: string) => {
        const ids = Array.from(selectedIds);
        ids.forEach(id => updateImage(id, { sourceId: targetSourceId }));
        addToast('success', `Moved ${ids.length} items to new vault`);
        setShowAddVaultMenu(false);
    };

    const handleRenameAction = (pattern: 'prompt_snippet' | 'model_seq' | 'date') => {
        batchRename(Array.from(selectedIds), pattern);
        setShowRenameModal(false);
    };

    const handleMouseEnter = (e: MouseEvent, text: string) => setTooltip({ y: e.currentTarget.getBoundingClientRect().top + e.currentTarget.clientHeight / 2, text });
    const handleMouseLeave = () => setTooltip(null);

    const handleStartRename = (sourceId: string, currentName: string) => {
        setEditingSourceId(sourceId);
        setEditingName(currentName);
    };

    const handleSaveRename = () => {
        if (editingSourceId && editingName.trim()) {
            renameSource(editingSourceId, editingName.trim());
            setEditingSourceId(null);
        }
    };

    const handleCancelRename = () => setEditingSourceId(null);

    const handleUnlinkSource = (sourceId: string, deleteImages: boolean = false) => {
        removeSource(sourceId, deleteImages);
        setConfirmUnlink(null);
    };

    const GridContainer = useMemo(() => forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
        <div
            ref={ref}
            {...props}
            style={{
                ...style,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(var(--grid-item-size, 240px), 1fr))',
                gap: '1.5rem',
            }}
            className="custom-scrollbar !p-6 pt-10"
        >
            {children}
        </div>
    )), []);

    const VirtuosoItem = useCallback(({ children, ...props }: any) => <div {...props} className="flex">{children}</div>, []);

    const virtuosoComponents = useMemo(() => ({
        List: GridContainer,
        Item: VirtuosoItem
    } as any), [GridContainer, VirtuosoItem]);

    if (isLoading && images.length === 0) {
        return (
            <div className="h-screen w-full bg-background flex flex-col items-center justify-center space-y-4" role="status" aria-live="polite">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 rounded-full border-2 border-white/10"></div>
                    <div className="absolute inset-0 rounded-full border-t-2 border-accent animate-spin"></div>
                    <div className="absolute inset-4 rounded-full bg-white/5 animate-pulse"></div>
                </div>
                <span className="sr-only">Loading content...</span>
                <p className="text-zinc-500 font-mono text-xs animate-pulse">Initializing Vault...</p>
            </div>
        );
    }

    return (
        <div className="h-screen w-full bg-surface flex flex-col overflow-hidden relative">
            {isElectron && platform !== 'darwin' && (
                <div className="h-8 w-full flex items-center justify-center shrink-0 z-50 bg-surface/50 backdrop-blur-md border-b border-white/[0.03]" style={{ WebkitAppRegion: 'drag' } as any}>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 opacity-40 pointer-events-none transition-all duration-300">
                        {selectedIds.size === 1
                            ? (images.find(img => selectedIds.has(img.id))?.title || 'Selected Item')
                            : selectedIds.size > 1
                                ? `${selectedIds.size} ITEMS SELECTED`
                                : 'ARCHIVIST STUDIO'
                        }
                    </span>
                </div>
            )}

            <div className="flex-1 flex overflow-hidden relative">
                {tooltip && (
                    <div
                        className="fixed left-[70px] z-[100] px-3 py-1.5 bg-zinc-900 border border-white/10 rounded-lg shadow-xl animate-fade-in pointer-events-none"
                        style={{ top: tooltip.y, transform: 'translateY(-50%)' }}
                    >
                        <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-zinc-900 border-l border-b border-white/10 rotate-45 transform"></div>
                        <span className="text-[10px] font-bold text-white whitespace-nowrap relative z-10">{tooltip.text}</span>
                    </div>
                )}

                <ArchiveSidebar
                    sources={sources}
                    images={images}
                    activeSourceId={activeSourceId}
                    setActiveSourceId={setActiveSourceId}
                    showVaultManager={showVaultManager}
                    setShowVaultManager={setShowVaultManager}
                    handleMouseEnter={handleMouseEnter}
                    handleMouseLeave={handleMouseLeave}
                    editingSourceId={editingSourceId}
                    editingName={editingName}
                    setEditingName={setEditingName}
                    handleSaveRename={handleSaveRename}
                    handleCancelRename={handleCancelRename}
                    handleStartRename={handleStartRename}
                    confirmUnlink={confirmUnlink}
                    setConfirmUnlink={setConfirmUnlink}
                    handleUnlinkSource={handleUnlinkSource}
                    addLocalFolder={addLocalFolder}
                    isElectron={isElectron}
                    platform={platform}
                />

                <div className="flex-1 flex flex-col min-w-0 bg-surface relative">
                    <ArchiveHeader
                        showFilters={showFilters}
                        setShowFilters={setShowFilters}
                        activeFilter={activeFilter}
                        undo={undo}
                        redo={redo}
                        canUndo={canUndo}
                        canRedo={canRedo}
                        search={search}
                        setSearch={setSearch}
                        workspaceMode={workspaceMode}
                        setWorkspaceMode={setWorkspaceMode}
                        generalSettings={generalSettings}
                        updateGeneralSettings={updateGeneralSettings}
                        checkActiveSource={checkActiveSource}
                    />

                    <div className="flex-1 bg-background rounded-tl-xl border-l border-t border-white/[0.03] overflow-hidden relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] z-10 flex flex-col mt-1">
                        <ArchiveFilters
                            showFilters={showFilters}
                            filterCategory={filterCategory}
                            setFilterCategory={setFilterCategory}
                            activeFilter={activeFilter}
                            setActiveFilter={setActiveFilter}
                            activeCategoryItems={activeCategoryItems}
                        />

                        <div className="flex-1 bg-background overflow-hidden relative" style={{ '--grid-item-size': `${generalSettings.gridItemSize}px` } as React.CSSProperties}>
                            {workspaceMode === 'gallery' ? (
                                images.length === 0 && activeSourceId === 'all' && !isLoading ? (
                                    <EmptyState type="empty-library" onAction={() => setShowVaultManager(true)} />
                                ) : filteredImages.length === 0 ? (
                                    <EmptyState type="no-results" onClearFilters={() => setActiveFilter(null)} />
                                ) : (
                                    filteredImages.length <= 200 ? (
                                        <div className="h-full w-full overflow-y-auto p-6 pt-10 custom-scrollbar" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(var(--grid-item-size, 240px), 1fr))', gridAutoRows: 'max-content', gap: '1.5rem', alignContent: 'start' }}>
                                            {filteredImages.map((img) => (
                                                <GalleryItem
                                                    key={img.id}
                                                    img={img}
                                                    isSelected={selectedIds.has(img.id)}
                                                    toggleSelection={toggleSelection}
                                                    setSelectedImage={setSelectedImage}
                                                    updateImage={updateImage}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <VirtuosoGrid
                                            style={{ height: '100%', width: '100%' }}
                                            totalCount={filteredImages.length}
                                            computeItemKey={(index) => filteredImages[index].id}
                                            overscan={1000}
                                            components={virtuosoComponents}
                                            itemContent={(index) => (
                                                <GalleryItem
                                                    img={filteredImages[index]}
                                                    isSelected={selectedIds.has(filteredImages[index].id)}
                                                    toggleSelection={toggleSelection}
                                                    setSelectedImage={setSelectedImage}
                                                    updateImage={updateImage}
                                                />
                                            )}
                                        />
                                    )
                                )
                            ) : (
                                <div className="w-full max-w-7xl mx-auto h-full p-6 flex flex-col">
                                    <div className="flex items-center justify-between mb-4 px-2 shrink-0">
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleSelectAll} className="flex items-center gap-2 text-xs font-bold text-zinc-500 hover:text-white transition-colors">
                                                {selectedIds.size === filteredImages.length && filteredImages.length > 0 ? <CheckCircle size={14} className="text-accent" /> : <Circle size={14} />}
                                                Select All
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-[10px] text-zinc-600 uppercase font-bold tracking-wider flex items-center gap-2">
                                                <Sparkles size={12} /> Dataset Workbench
                                            </span>

                                            <WorkbenchColumnsMenu
                                                isOpen={showColumnsMenu}
                                                setIsOpen={setShowColumnsMenu}
                                                currentColumns={generalSettings.workbenchColumns || []}
                                                updateGeneralSettings={updateGeneralSettings}
                                            />
                                        </div>
                                    </div>
                                    <Virtuoso
                                        style={{ flex: 1 }}
                                        totalCount={filteredImages.length}
                                        itemContent={(index) => (
                                            <WorkbenchItem
                                                img={filteredImages[index]}
                                                isSelected={selectedIds.has(filteredImages[index].id)}
                                                toggleSelection={toggleSelection}
                                                setSelectedImage={setSelectedImage}
                                                columns={generalSettings.workbenchColumns || []}
                                                sources={sources}
                                            />
                                        )}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <SelectionFloatingBar
                selectedIds={selectedIds}
                isBatchProcessing={isBatchProcessing}
                generateBatchCaptions={generateBatchCaptions}
                showRenameModal={showRenameModal}
                setShowRenameModal={setShowRenameModal}
                handleRenameAction={handleRenameAction}
                showAddVaultMenu={showAddVaultMenu}
                setShowAddVaultMenu={setShowAddVaultMenu}
                sources={sources}
                handleAddToVault={handleAddToVault}
                addLocalFolder={addLocalFolder}
                showExportOptions={showExportOptions}
                setShowExportOptions={setShowExportOptions}
                exportOptions={exportOptions}
                setExportOptions={setExportOptions}
                handleExport={handleExport}
                batchDeleteImages={batchDeleteImages}
                clearSelection={clearSelection}
                selectAll={selectAll}
                images={images}
                filteredImages={filteredImages}
                generalSettings={generalSettings}
            />
        </div>
    );
};

export default Archive;