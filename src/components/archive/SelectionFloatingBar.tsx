import { FC, useState, useMemo } from 'react';
import {
    Loader2, Sparkles, Pencil, Box, Download, Trash2, X, Plus
} from 'lucide-react';
import { LibrarySource, AIImage, GeneralSettings, CaptionStyle } from '../../types';

interface SelectionFloatingBarProps {
    selectedIds: Set<string>;
    isBatchProcessing: boolean;
    generateBatchCaptions: (overrideStyle?: CaptionStyle) => void;
    showRenameModal: boolean;
    setShowRenameModal: (val: boolean) => void;
    handleRenameAction: (pattern: 'prompt_snippet' | 'model_seq' | 'date') => void;
    showAddVaultMenu: boolean;
    setShowAddVaultMenu: (val: boolean) => void;
    sources: LibrarySource[];
    handleAddToVault: (id: string) => void;
    addLocalFolder: () => void;
    showExportOptions: boolean;
    setShowExportOptions: (val: boolean) => void;
    exportOptions: { includeImage: boolean; includeTxt: boolean; includeJson: boolean };
    setExportOptions: (opts: { includeImage: boolean; includeTxt: boolean; includeJson: boolean }) => void;
    handleExport: () => void;
    batchDeleteImages: (ids: string[], allowPhysicalDelete?: boolean) => void;
    clearSelection: () => void;
    selectAll: (ids: string[]) => void;
    images: AIImage[];
    filteredImages: AIImage[];
    generalSettings: GeneralSettings;
}

const SelectionFloatingBar: FC<SelectionFloatingBarProps> = ({
    selectedIds, isBatchProcessing, generateBatchCaptions,
    showRenameModal, setShowRenameModal, handleRenameAction,
    showAddVaultMenu, setShowAddVaultMenu, sources, handleAddToVault, addLocalFolder,
    showExportOptions, setShowExportOptions, exportOptions, setExportOptions, handleExport,
    batchDeleteImages, clearSelection, selectAll, filteredImages, images,
    generalSettings
}) => {
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);
    const [showCaptionMenu, setShowCaptionMenu] = useState(false);

    const canDeleteFromDisk = useMemo(() => {
        if (selectedIds.size === 0) return false;
        const hasProtectedFile = Array.from(selectedIds).some(id => {
            const img = images.find(i => i.id === id);
            if (!img) return false;
            const source = sources.find(s => s.id === img.sourceId);
            const isLinkedVault = source?.type === 'local_folder';
            return isLinkedVault && !generalSettings.deleteLinkedVaultFiles;
        });
        return !hasProtectedFile;
    }, [selectedIds, images, sources, generalSettings.deleteLinkedVaultFiles]);

    if (selectedIds.size === 0) return null;

    return (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-up origin-bottom">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900/90 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_20px_50px_-10px_rgba(0,0,0,0.8)] ring-1 ring-white/5">

                {/* Counter */}
                <div className="flex flex-col items-center justify-center px-3 border-r border-white/5 mr-1">
                    <span className="text-[13px] font-black text-white leading-none">{selectedIds.size}</span>
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest leading-none mt-0.5">Selected</span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                    {/* Caption Menu */}
                    <div className="relative">
                        <button onClick={() => setShowCaptionMenu(!showCaptionMenu)} disabled={isBatchProcessing} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-accent hover:bg-accent/10 transition-all gap-1 group">
                            {isBatchProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="group-hover:scale-110 transition-transform" />}
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Caption</span>
                        </button>
                        {showCaptionMenu && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col min-w-[80px] animate-fade-in">
                                <div onClick={() => { generateBatchCaptions('stable_diffusion'); setShowCaptionMenu(false); }} className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
                                    SD
                                </div>
                                <div onClick={() => { generateBatchCaptions('natural_language'); setShowCaptionMenu(false); }} className="px-3 py-2 text-center text-[10px] font-black uppercase tracking-wider text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
                                    VLM
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Rename */}
                    <div className="relative">
                        <button onClick={() => setShowRenameModal(!showRenameModal)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all gap-1">
                            <Pencil size={16} />
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Rename</span>
                        </button>
                        {showRenameModal && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col min-w-[160px] animate-fade-in">
                                <div onClick={() => handleRenameAction('prompt_snippet')} className="px-3 py-2.5 hover:bg-accent/10 hover:text-accent text-left text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors">By Prompt</div>
                                <div onClick={() => handleRenameAction('date')} className="px-3 py-2.5 hover:bg-accent/10 hover:text-accent text-left text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors">By Date</div>
                                <div onClick={() => handleRenameAction('model_seq')} className="px-3 py-2.5 hover:bg-accent/10 hover:text-accent text-left text-[10px] font-bold uppercase tracking-wider rounded-lg cursor-pointer transition-colors">By Model</div>
                            </div>
                        )}
                    </div>

                    {/* Vault */}
                    <div className="relative">
                        <button onClick={() => setShowAddVaultMenu(!showAddVaultMenu)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all gap-1">
                            <Box size={16} />
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Vault</span>
                        </button>
                        {showAddVaultMenu && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-1 z-50 flex flex-col min-w-[200px] animate-fade-in">
                                <span className="px-3 py-2 text-[8px] uppercase font-black text-zinc-500 tracking-[0.2em] border-b border-white/5 mb-1.5 flex items-center gap-2">Target Destination</span>
                                <div className="max-h-60 overflow-y-auto custom-scrollbar p-1 space-y-0.5">
                                    {sources.map(source => (
                                        <div key={source.id} onClick={() => handleAddToVault(source.id)} className="px-3 py-2 hover:bg-accent/10 hover:text-accent text-left text-[11px] font-medium text-zinc-300 rounded-lg cursor-pointer flex items-center justify-between group transition-all">
                                            <span>{source.name}</span>
                                            <span className="text-[8px] opacity-0 group-hover:opacity-100 transition-opacity uppercase font-bold text-zinc-500 border border-current px-1 rounded">GO</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="h-px bg-white/5 my-1.5 mx-2"></div>
                                <div onClick={() => { addLocalFolder(); setShowAddVaultMenu(false); }} className="mx-1 mb-1 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-wider rounded-lg cursor-pointer flex items-center gap-2 transition-all">
                                    <Plus size={12} strokeWidth={3} /> Link Vault
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Export */}
                    <div className="relative">
                        <button onClick={() => setShowExportOptions(!showExportOptions)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-all gap-1">
                            <Download size={16} />
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Export</span>
                        </button>
                        {showExportOptions && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 z-50 flex flex-col min-w-[240px] animate-fade-in">
                                <div className="flex items-center gap-2 mb-4 border-b border-white/5 pb-2">
                                    <Download size={14} className="text-accent" />
                                    <span className="text-[10px] uppercase font-black text-white tracking-[0.15em]">Export Config</span>
                                </div>
                                <div className="space-y-3">
                                    <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white/5 rounded-lg transition-all">
                                        <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">Image</span>
                                        <input type="checkbox" checked={exportOptions.includeImage} onChange={e => setExportOptions({ ...exportOptions, includeImage: e.target.checked })} className="w-4 h-4 accent-accent rounded" />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white/5 rounded-lg transition-all">
                                        <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">Prompt .txt</span>
                                        <input type="checkbox" checked={exportOptions.includeTxt} onChange={e => setExportOptions({ ...exportOptions, includeTxt: e.target.checked })} className="w-4 h-4 accent-accent rounded" />
                                    </label>
                                    <label className="flex items-center justify-between cursor-pointer group p-2 hover:bg-white/5 rounded-lg transition-all">
                                        <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">Metadata .json</span>
                                        <input type="checkbox" checked={exportOptions.includeJson} onChange={e => setExportOptions({ ...exportOptions, includeJson: e.target.checked })} className="w-4 h-4 accent-accent rounded" />
                                    </label>
                                </div>
                                <button onClick={handleExport} className="mt-6 w-full py-2.5 bg-accent hover:bg-accent-hover text-white text-[10px] font-black uppercase tracking-[0.1em] rounded-xl shadow-lg shadow-accent/20 transition-all flex items-center justify-center gap-2">
                                    <Download size={14} /> Start Export
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Delete */}
                    <div className="relative">
                        <button onClick={() => setShowDeleteOptions(!showDeleteOptions)} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-400/10 transition-all gap-1">
                            <Trash2 size={16} />
                            <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Delete</span>
                        </button>
                        {showDeleteOptions && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl p-2 z-50 flex flex-col min-w-[200px] animate-fade-in">
                                <div className="px-3 py-2 text-[10px] uppercase font-black text-zinc-500 tracking-wider border-b border-white/5 mb-1 text-center">Delete {selectedIds.size} Items</div>
                                <button onClick={() => { batchDeleteImages(Array.from(selectedIds), false); setShowDeleteOptions(false); }} className="px-3 py-2.5 text-left text-[10px] font-bold text-zinc-300 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                                    Remove from Library
                                    <span className="block text-[8px] font-medium text-zinc-600 mt-0.5">Retains files on disk</span>
                                </button>
                                <button onClick={() => { if (!canDeleteFromDisk) return; if (confirm(`PERMANENTLY DELETE ${selectedIds.size} files?`)) { batchDeleteImages(Array.from(selectedIds), true); setShowDeleteOptions(false); } }} disabled={!canDeleteFromDisk} className={`px-3 py-2.5 text-left text-[10px] font-bold rounded-lg transition-all mt-1 ${canDeleteFromDisk ? 'text-red-400 hover:bg-red-500/10' : 'text-zinc-600 cursor-not-allowed'}`}>
                                    Delete from Disk
                                    <span className={`block text-[8px] font-medium mt-0.5 ${canDeleteFromDisk ? 'text-red-400/60' : 'text-zinc-700'}`}>{canDeleteFromDisk ? "Moves to Trash" : "Enable in Settings"}</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="w-px h-8 bg-white/5 mx-1"></div>

                {/* Selection Controls - All / Clear */}
                <div className="flex items-center gap-1">
                    <button onClick={() => selectAll(filteredImages.map(img => img.id))} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest">ALL</span>
                    </button>
                    <button onClick={clearSelection} className="flex flex-col items-center justify-center w-12 h-12 rounded-xl text-zinc-500 hover:text-white hover:bg-white/5 transition-all gap-1">
                        <X size={16} />
                        <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">Clear</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SelectionFloatingBar;
