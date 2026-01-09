import { useRef, useState, useEffect, FC, KeyboardEvent } from 'react';
import { Star, Palette, Copy, Check, Loader2, Sparkles, Hash, X, Plus, Wand2, Tags, AlignLeft, BrainCircuit, ChevronDown, ChevronUp, LayoutList } from 'lucide-react';
import { AIImage, AISettings, FileMetadata, LibrarySource } from '../../types';
import { normalizePath } from '../../utils';

interface EditorSidebarProps {
    activeTab: 'metadata' | 'caption';
    localState: AIImage;
    handleChange: (field: keyof AIImage, value: any) => void;
    aiSettings: AISettings;
    updateAISettings: (s: Partial<AISettings>) => void;

    tagInput: string;
    setTagInput: (s: string) => void;
    isTagInputActive: boolean;
    setIsTagInputActive: (b: boolean) => void;
    handleAddTag: () => void;
    handleRemoveTag: (tag: string) => void;
    onTagKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
    handleAutoTag: () => void;
    isAnalyzingTags: boolean;

    handleMagicCaption: () => void;
    isGeneratingCaption: boolean;
    handleCopy: () => void;
    isCopied: boolean;
    sources: LibrarySource[];
    addLocalFolder?: (skipImportPreview?: boolean) => void;
}

const EditorSidebar: FC<EditorSidebarProps> = ({
    activeTab, localState, handleChange, aiSettings, updateAISettings,
    tagInput, setTagInput, isTagInputActive, setIsTagInputActive, handleAddTag, handleRemoveTag, onTagKeyDown,
    handleAutoTag, isAnalyzingTags, handleMagicCaption, isGeneratingCaption, handleCopy, isCopied, sources, addLocalFolder
}) => {
    const tagInputRef = useRef<HTMLInputElement>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [showVaultSelect, setShowVaultSelect] = useState(false);
    const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
    const [metadataLoading, setMetadataLoading] = useState(false);

    useEffect(() => {
        if (isDetailsOpen && localState.src) {
            readRealMetadata();
        }
    }, [isDetailsOpen, localState.src]);

    const readRealMetadata = async () => {
        if (!localState.src) {
            setFileMetadata(null);
            return;
        }

        setMetadataLoading(true);
        try {
            const api = window.electronAPI;
            if (!api || !api.readMetadata) {
                setFileMetadata(null);
                setMetadataLoading(false);
                return;
            }

            const filePath = normalizePath(localState.src);

            const result = await api.readMetadata(filePath);
            if (result.success && result.data) {
                setFileMetadata(result.data);
            } else {
                setFileMetadata(null);
            }
        } catch (e) {
            console.error('Metadata read error:', e);
            setFileMetadata(null);
        }
        setMetadataLoading(false);
    };

    useEffect(() => {
        if (isTagInputActive && tagInputRef.current) {
            tagInputRef.current.focus();
        }
    }, [isTagInputActive]);

    return (
        <div className="w-[450px] bg-surface flex flex-col border-l border-white/5 relative z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            {activeTab === 'metadata' && (
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 animate-slide-in-right">
                    <div className="space-y-2">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">File Name</label>
                        <input type="text" value={localState.title} onChange={(e) => handleChange('title', e.target.value)} className="w-full bg-background border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:border-accent outline-none" />
                    </div>

                    <div className="space-y-2 relative">
                        <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Currently in Vault</label>
                        <button
                            onClick={() => setShowVaultSelect(!showVaultSelect)}
                            className="w-full flex items-center justify-between bg-zinc-900 border border-border rounded-lg px-3 py-2 text-xs text-zinc-300 hover:text-white transition-all group"
                        >
                            <span className="flex items-center gap-2">
                                <LayoutList size={14} className="text-zinc-500 group-hover:text-accent" />
                                {sources.find(s => s.id === localState.sourceId)?.name || 'Local Vault'}
                            </span>
                            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showVaultSelect ? 'rotate-180' : ''}`} />
                        </button>

                        {showVaultSelect && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 animate-fade-in max-h-60 overflow-y-auto custom-scrollbar">
                                {sources.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => { handleChange('sourceId', s.id); setShowVaultSelect(false); }}
                                        className={`w-full px-3 py-2.5 rounded-lg text-left text-[11px] transition-all flex items-center justify-between group ${localState.sourceId === s.id ? 'bg-accent/10 text-accent font-bold' : 'text-zinc-400 hover:bg-white/5 hover:text-white'}`}
                                    >
                                        <div className="flex flex-col">
                                            <span>{s.name}</span>
                                            {s.path && <span className="text-[8px] opacity-50 truncate max-w-[200px]">{s.path}</span>}
                                        </div>
                                        {localState.sourceId === s.id && <Check size={12} />}
                                    </button>
                                ))}

                                {addLocalFolder && (
                                    <>
                                        <div className="border-t border-white/5 my-1" />
                                        <button
                                            onClick={() => { addLocalFolder(true); setShowVaultSelect(false); }}
                                            className="w-full px-3 py-2.5 rounded-lg text-left text-[11px] transition-all flex items-center gap-2 text-accent hover:bg-accent/10"
                                        >
                                            <Plus size={12} strokeWidth={3} />
                                            <span>Create New Vault</span>
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4">
                        <div className="space-y-2 flex-1">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex items-center gap-1"><Star size={10} /> Rating</label>
                            <div className="flex gap-1 p-2 bg-background border border-border rounded-lg">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onClick={() => handleChange('rating', star === localState.rating ? 0 : star)}
                                        className={`transition-colors ${star <= (localState.rating || 0) ? 'text-yellow-400' : 'text-zinc-700 hover:text-zinc-500'}`}
                                    >
                                        <Star size={16} fill={star <= (localState.rating || 0) ? "currentColor" : "none"} />
                                    </button>
                                ))}
                            </div>
                        </div>

                        {localState.dominantColors && localState.dominantColors.length > 0 && (
                            <div className="space-y-2 flex-1">
                                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 flex items-center gap-1"><Palette size={10} /> Colors</label>
                                <div className="flex gap-1 p-2 bg-background border border-border rounded-lg h-[42px] items-center">
                                    {localState.dominantColors.map(color => (
                                        <div key={color} className="w-6 h-6 rounded-full border border-border shadow-sm" style={{ backgroundColor: color }} title={color}></div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-2 relative">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Positive Prompt</label>
                            <div className="flex items-center gap-2">
                                <button onClick={() => updateAISettings({ activeCaptionStyle: aiSettings.activeCaptionStyle === 'stable_diffusion' ? 'natural_language' : 'stable_diffusion' })} className="text-[9px] font-mono font-bold text-zinc-600 hover:text-zinc-300 uppercase bg-white/5 px-1.5 py-0.5 rounded transition-colors">
                                    {aiSettings.activeCaptionStyle === 'stable_diffusion' ? 'SD MODE' : 'VLM MODE'}
                                </button>
                                <div className="w-px h-3 bg-white/10"></div>
                                <button onClick={handleMagicCaption} disabled={isGeneratingCaption} className="group flex items-center gap-1 text-[9px] font-bold text-zinc-500 hover:text-accent disabled:opacity-50 transition-colors">
                                    {isGeneratingCaption ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
                                    <span className="group-hover:underline decoration-accent underline-offset-2">AI CAPTION</span>
                                </button>
                                <div className="w-px h-3 bg-white/10"></div>
                                <button onClick={handleCopy} className="text-zinc-500 hover:text-white transition-colors">
                                    {isCopied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                                </button>
                            </div>
                        </div>
                        <textarea value={localState.prompt} onChange={(e) => handleChange('prompt', e.target.value)} className="w-full h-32 bg-background border border-white/5 rounded-lg p-3 text-xs leading-relaxed text-zinc-300 font-mono focus:border-accent outline-none resize-none custom-scrollbar placeholder:text-zinc-700" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Model</label>
                            <input value={localState.model} onChange={(e) => handleChange('model', e.target.value)} className="w-full bg-background border-white/5 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-accent transition-colors" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Sampler</label>
                            <input value={localState.sampler} onChange={(e) => handleChange('sampler', e.target.value)} className="w-full bg-background border-white/5 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-accent transition-colors" />
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Steps</label>
                            <input type="number" value={localState.steps} onChange={(e) => handleChange('steps', parseInt(e.target.value))} className="w-full bg-background border-white/5 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-accent transition-colors" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">CFG</label>
                            <input type="number" value={localState.cfgScale} onChange={(e) => handleChange('cfgScale', parseFloat(e.target.value))} className="w-full bg-background border-white/5 rounded px-2 py-1.5 text-xs text-zinc-300 outline-none focus:border-accent transition-colors" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Seed</label>
                            <input type="number" value={localState.seed} readOnly className="w-full bg-background/50 border-white/5 rounded px-2 py-1.5 text-xs text-zinc-500 cursor-not-allowed" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <Hash size={12} className="text-zinc-500" />
                                <label className="text-[10px] uppercase tracking-wider font-bold text-zinc-400">Tags</label>
                            </div>
                            <div className="flex items-center gap-2">
                                {(localState.tags || []).length > 0 && (
                                    <button
                                        onClick={() => handleChange('tags', [])}
                                        className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-red-400 font-medium px-1.5 py-0.5 rounded transition-colors hover:bg-red-500/10"
                                        title="Clear all tags"
                                    >
                                        <X size={10} />
                                        CLEAR
                                    </button>
                                )}
                                <button onClick={handleAutoTag} disabled={isAnalyzingTags} className="flex items-center gap-1.5 text-[9px] text-accent hover:text-accent-hover font-bold bg-accent/10 px-2 py-1 rounded-md transition-all hover:bg-accent/20 disabled:opacity-50 disabled:cursor-wait">
                                    {isAnalyzingTags ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                                    {isAnalyzingTags ? 'EXTRACTING...' : 'EXTRACT TAGS'}
                                </button>
                            </div>
                        </div>

                        <div className={`flex flex-wrap gap-2 p-2 rounded-xl border transition-all duration-300 ${isTagInputActive ? 'bg-background border-accent ring-1 ring-accent/30' : 'bg-background/50 border-white/5'}`} onClick={() => setIsTagInputActive(true)}>
                            {(localState.tags || []).map(tag => (
                                <span key={tag} className="group flex items-center gap-1 pl-2 pr-1 py-1 bg-zinc-800 border border-zinc-700 rounded text-[10px] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors select-none">
                                    #{tag}
                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }} className="p-0.5 rounded-full hover:bg-zinc-600 text-zinc-500 group-hover:text-zinc-300 transition-colors">
                                        <X size={10} />
                                    </button>
                                </span>
                            ))}
                            <div className="flex-1 min-w-[60px] relative">
                                {(!isTagInputActive && (localState.tags || []).length === 0) ? (
                                    <button className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-300 py-1 transition-colors" onClick={() => setIsTagInputActive(true)}>
                                        <Plus size={10} /> Add tag...
                                    </button>
                                ) : (
                                    <input ref={tagInputRef} type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={onTagKeyDown} onBlur={() => { handleAddTag(); setIsTagInputActive(false); }} placeholder={(localState.tags || []).length > 0 ? "" : "Type tag & enter..."} className={`w-full bg-transparent outline-none text-[10px] text-white placeholder:text-zinc-600 font-mono py-1 ${!isTagInputActive ? 'hidden' : 'block'}`} />
                                )}
                            </div>
                        </div>
                    </div>

                    {window.electronAPI && (
                        <div className="border-t border-white/5 pt-4 mt-2 pb-8">
                            <button
                                onClick={(e) => {
                                    const target = e.currentTarget;
                                    setIsDetailsOpen(!isDetailsOpen);
                                    if (!isDetailsOpen) {
                                        setTimeout(() => {
                                            if (target) {
                                                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                            }
                                        }, 100);
                                    }
                                }}
                                className="w-full flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-zinc-500 hover:text-zinc-300 transition-colors group"
                            >
                                <span className="flex items-center gap-2 group-hover:text-white transition-colors">
                                    <LayoutList size={14} />
                                    Windows Details
                                </span>
                                {isDetailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>

                            {isDetailsOpen && (
                                <div className="mt-3 bg-zinc-900/50 rounded-xl border border-white/5 overflow-hidden animate-fade-in">
                                    {metadataLoading ? (
                                        <div className="p-6 flex items-center justify-center gap-2 text-zinc-500">
                                            <Loader2 size={16} className="animate-spin" />
                                            <span className="text-[11px]">Reading file properties...</span>
                                        </div>
                                    ) : fileMetadata ? (
                                        <div className="divide-y divide-white/5">
                                            <div className="p-3">
                                                <div className="text-[9px] font-bold text-zinc-500 uppercase mb-2">Description</div>
                                                <div className="space-y-2 text-[11px]">
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Title</span>
                                                        <span className="text-zinc-300 truncate">{fileMetadata.Title || '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Subject</span>
                                                        <span className="text-zinc-300 truncate">{fileMetadata.Subject || '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Rating</span>
                                                        <div className="flex gap-0.5">
                                                            {[1, 2, 3, 4, 5].map(s => (
                                                                <Star key={s} size={10} fill={s <= (fileMetadata.Rating || 0) ? "currentColor" : "none"}
                                                                    className={s <= (fileMetadata.Rating || 0) ? "text-yellow-500" : "text-zinc-700"} />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Tags</span>
                                                        <span className="text-zinc-300 truncate">
                                                            {Array.isArray(fileMetadata.Tags) ? fileMetadata.Tags.join('; ') : fileMetadata.Tags || '—'}
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Comments</span>
                                                        <span className="text-zinc-300 truncate">{fileMetadata.Comments || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3">
                                                <div className="text-[9px] font-bold text-zinc-500 uppercase mb-2">Origin</div>
                                                <div className="space-y-2 text-[11px]">
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Authors</span>
                                                        <span className="text-zinc-300 truncate">{fileMetadata.Authors || '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Date Taken</span>
                                                        <span className="text-zinc-300">{fileMetadata.DateTaken || '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Program</span>
                                                        <span className="text-zinc-300">{fileMetadata.ProgramName || '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Copyright</span>
                                                        <span className="text-zinc-300 truncate">{fileMetadata.Copyright || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3">
                                                <div className="text-[9px] font-bold text-zinc-500 uppercase mb-2">Image</div>
                                                <div className="space-y-2 text-[11px]">
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Dimensions</span>
                                                        <span className="text-zinc-300">{fileMetadata.ImageWidth && fileMetadata.ImageHeight ? `${fileMetadata.ImageWidth} x ${fileMetadata.ImageHeight}` : '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Width</span>
                                                        <span className="text-zinc-300">{fileMetadata.ImageWidth ? `${fileMetadata.ImageWidth} px` : '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Height</span>
                                                        <span className="text-zinc-300">{fileMetadata.ImageHeight ? `${fileMetadata.ImageHeight} px` : '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Resolution</span>
                                                        <span className="text-zinc-300">{fileMetadata.HorizontalResolution ? `${fileMetadata.HorizontalResolution} dpi` : '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">Bit Depth</span>
                                                        <span className="text-zinc-300">{fileMetadata.BitDepth || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-3">
                                                <div className="text-[9px] font-bold text-zinc-500 uppercase mb-2">File</div>
                                                <div className="space-y-2 text-[11px]">
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">File Type</span>
                                                        <span className="text-zinc-300">{fileMetadata.FileType || fileMetadata.MIMEType || '—'}</span>
                                                    </div>
                                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                                        <span className="text-zinc-600">File Size</span>
                                                        <span className="text-zinc-300">{fileMetadata.FileSize || '—'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-6 text-center text-zinc-600 text-[11px] break-all">
                                            <div className="text-red-400 mb-1 font-bold">Metadata Read Failed</div>
                                            {localState.src ? (
                                                <>
                                                    <div>Path: {normalizePath(localState.src)}</div>
                                                    <div className="mt-2 text-[10px] opacity-70">Check file existence & permissions.</div>
                                                </>
                                            ) : 'No file source'}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'caption' && (
                <div className="flex-1 flex flex-col relative animate-fade-in bg-zinc-950">
                    <div className="absolute top-0 left-0 bottom-10 w-12 bg-zinc-900/30 border-r border-white/5 pt-4 flex flex-col items-end pr-3 gap-[4px] select-none">
                        {Array.from({ length: 30 }).map((_, i) => (
                            <span key={i} className="text-[10px] font-mono text-zinc-700 leading-relaxed">{i + 1}</span>
                        ))}
                    </div>
                    <textarea value={localState.prompt} onChange={(e) => handleChange('prompt', e.target.value)} spellCheck={false} className="flex-1 w-full bg-transparent resize-none outline-none text-sm font-mono text-zinc-300 leading-relaxed pl-16 pr-6 py-4 custom-scrollbar selection:bg-accent/20" placeholder="Write a detailed caption..." />

                    <div className="absolute bottom-14 right-6 flex items-center gap-3">
                        <div className="bg-black/40 backdrop-blur rounded-full p-1 border border-white/10 flex gap-1">
                            <button onClick={() => updateAISettings({ activeCaptionStyle: 'stable_diffusion' })} className={`p-2 rounded-full transition-all ${aiSettings.activeCaptionStyle === 'stable_diffusion' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="SD Tags"><Tags size={14} /></button>
                            <button onClick={() => updateAISettings({ activeCaptionStyle: 'natural_language' })} className={`p-2 rounded-full transition-all ${aiSettings.activeCaptionStyle === 'natural_language' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`} title="VLM Natural"><AlignLeft size={14} /></button>
                        </div>
                        <button onClick={handleMagicCaption} disabled={isGeneratingCaption} className="bg-accent hover:bg-accent-hover text-white p-3 rounded-full shadow-[0_0_20px_rgba(139,92,246,0.3)] transition-all hover:scale-110 active:scale-95 disabled:opacity-50">
                            {isGeneratingCaption ? <Loader2 size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorSidebar;
