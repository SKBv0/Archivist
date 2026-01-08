import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useApp } from '../hooks/useApp';
import { X, ChevronRight, Save, Zap, Wand2, Hash, Layers, Cpu, AlignLeft, Clipboard, AlertCircle, Star, Upload } from 'lucide-react';
import { AIImage } from '../types';
import { parseGenerationData, generateId } from '../utils';
import { BlobImage } from '../components/Common';

const QuickSave = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as { importedFile?: { src: string; name: string; path?: string; file?: File } };
    const importedFile = state?.importedFile;

    const { saveImage, generalSettings, addToast, sources = [] } = useApp();
    const [targetSourceId, setTargetSourceId] = useState('internal');
    const [showVaultSelect, setShowVaultSelect] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const [showPasteModal, setShowPasteModal] = useState(false);
    const [manualPasteText, setManualPasteText] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        src: "",
        blob: null as Blob | null,
        title: "",
        prompt: "Abstract geometric shapes in neon colors, dark background, 3d render, unreal engine 5, volumetric lighting, 8k",
        negativePrompt: "",
        model: "SDXL 1.0",
        seed: 94829102,
        steps: 30,
        cfg: 7,
        sampler: "Euler a",
        rating: 0,
        width: 1024,
        height: 1024
    });

    useEffect(() => {
        if (importedFile) {
            const isTxt = importedFile.name?.toLowerCase().endsWith('.txt');

            if (!isTxt) {
                const img = new Image();
                img.onload = () => {
                    setFormData(prev => ({
                        ...prev,
                        src: importedFile.path || importedFile.src,
                        title: importedFile.name.split('.')[0].replace(/_/g, ' '),
                        width: img.width,
                        height: img.height,
                        prompt: "Reading metadata from file..."
                    }));

                    // Pre-fetch blob for data or blob URIs
                    if (importedFile.src.startsWith('blob:') || importedFile.src.startsWith('data:')) {
                        fetch(importedFile.src)
                            .then(res => res.blob())
                            .then(blob => {
                                setFormData(prev => ({ ...prev, blob }));
                            })
                            .catch(() => { });
                    }
                };
                img.src = importedFile.src;
            } else {
                setFormData(prev => ({
                    ...prev,
                    src: importedFile.path || importedFile.src,
                    title: importedFile.name.split('.')[0].replace(/_/g, ' '),
                    width: 1024,
                    height: 1024,
                    prompt: "Reading text file content..."
                }));
            }



            if (window.electronAPI && importedFile.path) {
                if (isTxt) {
                    window.electronAPI.readFile(importedFile.path)
                        .then(content => {
                            if (content) {
                                setFormData(prev => ({ ...prev, prompt: content }));
                                addToast('success', 'Text content loaded');
                            }
                        })
                        .catch(() => { });
                } else {

                    window.electronAPI.readMetadata(importedFile.path)
                        .then((result) => {

                            if (result && result.success && result.data) {
                                const meta = result.data;
                                // Aggregate available metadata fields
                                const fullData = [
                                    meta.UserComment,
                                    meta.Comments,
                                    meta.Parameters,
                                    meta.Prompt,
                                    meta.ImageDescription,
                                    meta._raw?.parameters,
                                    meta._raw?.UserComment,
                                    meta._raw?.prompt
                                ].filter(Boolean).join('\n');



                                if (fullData) {
                                    processMetadataText(fullData);
                                    addToast('success', 'Metadata extracted via ExifTool');
                                } else {
                                    setFormData(prev => ({ ...prev, prompt: "No generation data found in file." }));
                                }
                            } else {

                                setFormData(prev => ({ ...prev, prompt: "Metadata read returned no data." }));
                            }
                        })
                        .catch(() => {
                            setFormData(prev => ({ ...prev, prompt: "Metadata read failed." }));
                        });
                }
            } else if (!window.electronAPI) {
                setFormData(prev => ({ ...prev, prompt: "Metadata not readable in browser mode (requires Electron)." }));
            }
        }

        const timer = setTimeout(() => setIsReady(true), 50);
        return () => clearTimeout(timer);
    }, [importedFile]);

    const [isSaving, setIsSaving] = useState(false);

    const handleSave = async () => {
        if (!formData.src) {
            addToast('error', 'Please provide an image.');
            return;
        }
        setIsSaving(true);
        try {
            const newImage: AIImage = {
                id: generateId(),
                sourceId: targetSourceId,
                src: formData.src,
                title: formData.title || "Untitled Creation",
                prompt: formData.prompt,
                negativePrompt: formData.negativePrompt,
                model: formData.model,
                sampler: formData.sampler,
                cfgScale: formData.cfg,
                steps: formData.steps,
                seed: formData.seed,
                width: formData.width,
                height: formData.height,
                date: new Date().toISOString(),
                tags: ["new"],
                rating: formData.rating,
                blob: formData.blob || undefined
            };
            await saveImage(newImage);
            navigate('/');
        } catch (err) {
            addToast('error', 'Failed to save image.');
        } finally {
            setIsSaving(false);
        }
    };

    const processMetadataText = (text: string) => {
        const parsed = parseGenerationData(text);

        const hasStructuredData = !!(parsed.prompt || parsed.negativePrompt || parsed.steps || parsed.sampler || parsed.model);

        setFormData(prev => ({
            ...prev,
            prompt: parsed.prompt || (hasStructuredData ? "" : text),
            negativePrompt: parsed.negativePrompt || prev.negativePrompt,
            model: parsed.model || prev.model,
            sampler: parsed.sampler || prev.sampler,
            steps: parsed.steps || prev.steps,
            cfg: parsed.cfgScale || prev.cfg,
            seed: parsed.seed || prev.seed
        }));
    };

    const handlePasteMetadata = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) {
                addToast('error', 'Clipboard is empty');
                return;
            }
            processMetadataText(text);
        } catch (err) {
            setShowPasteModal(true);
        }
    };

    const handleManualPasteSubmit = () => {
        if (manualPasteText.trim()) {
            processMetadataText(manualPasteText);
        }
        setShowPasteModal(false);
        setManualPasteText("");
    };

    const isHorizontal = generalSettings.quickSaveLayout === 'horizontal';

    const BASE_WIDTH = '400px';
    const BASE_HEIGHT = '600px';
    const EXPANDED_WIDTH = '750px';
    const EXPANDED_HEIGHT = '850px';
    const PANEL_WIDTH = '350px';
    const PANEL_HEIGHT = '250px';

    const containerStyle = {
        width: isHorizontal ? (expanded ? EXPANDED_WIDTH : BASE_WIDTH) : BASE_WIDTH,
        height: !isHorizontal ? (expanded ? EXPANDED_HEIGHT : BASE_HEIGHT) : BASE_HEIGHT,
    };

    return (
        <div className={`
        fixed inset-0 flex items-center justify-center p-4 
        z-[60] bg-black/60 backdrop-blur-sm
        transition-opacity duration-500
        ${isReady ? 'opacity-100' : 'opacity-0'}
    `}>
            {showPasteModal && (
                <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                    <div className="w-[400px] bg-[#121214] border border-white/20 rounded-xl p-6 shadow-2xl flex flex-col gap-4">
                        <div className="flex justify-between items-center">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Clipboard size={16} /> Paste Metadata
                            </h3>
                            <button onClick={() => setShowPasteModal(false)} aria-label="Close modal"><X size={16} className="text-zinc-500 hover:text-white" /></button>
                        </div>
                        <p className="text-[11px] text-zinc-400">Browser security blocked automatic access. Please paste (Ctrl+V) your prompt data below:</p>
                        <textarea
                            autoFocus
                            value={manualPasteText}
                            onChange={(e) => setManualPasteText(e.target.value)}
                            className="w-full h-32 bg-black/50 border border-white/10 rounded-lg p-3 text-xs font-mono text-zinc-300 focus:border-accent outline-none"
                            placeholder="Paste Prompt / Generation Data here..."
                        />
                        <button
                            onClick={handleManualPasteSubmit}
                            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold uppercase tracking-wide transition-colors"
                        >
                            Process Data
                        </button>
                    </div>
                </div>
            )}

            <div
                style={{
                    width: containerStyle.width,
                    height: containerStyle.height,
                    transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1), height 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease-out'
                }}
                className={`
                bg-[#121214] border border-white/20 rounded-3xl shadow-[0_0_50px_rgba(255,255,255,0.1)] overflow-hidden relative group origin-bottom
                ${isReady ? 'scale-100 translate-y-0 opacity-100' : 'scale-[0.2] translate-y-[45vh] opacity-0'}
            `}
            >
                <button
                    onClick={() => navigate(-1)}
                    className="absolute top-4 right-4 z-50 p-2 rounded-full bg-black/40 text-zinc-400 hover:text-white hover:bg-white/10 transition-colors backdrop-blur-md"
                    aria-label="Close QuickSave"
                >
                    <X size={18} />
                </button>

                <div
                    className="absolute top-0 left-0 flex flex-col bg-surface z-20 transition-all duration-300"
                    style={{
                        width: BASE_WIDTH,
                        height: BASE_HEIGHT,
                        borderRight: isHorizontal && expanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                        borderBottom: !isHorizontal && expanded ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                    }}
                >
                    <div
                        className="h-[280px] relative shrink-0 bg-black group-hover:bg-[#0a0a0c] transition-colors cursor-pointer group/image overflow-hidden"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    const objectUrl = URL.createObjectURL(file);

                                    const filePath = window.electronAPI?.getPathForFile ? window.electronAPI.getPathForFile(file) : (file as any).path;

                                    const img = new Image();
                                    img.onload = () => {
                                        setFormData(prev => ({
                                            ...prev,
                                            src: objectUrl,
                                            blob: file,
                                            title: file.name.split('.')[0],
                                            width: img.width,
                                            height: img.height,
                                            prompt: filePath ? "Reading metadata..." : prev.prompt
                                        }));
                                    };
                                    img.src = objectUrl;


                                    if (filePath && window.electronAPI?.readMetadata) {
                                        try {
                                            const result = await window.electronAPI.readMetadata(filePath);
                                            if (result?.success && result.data) {
                                                const meta = result.data;
                                                const fullData = [
                                                    meta.UserComment,
                                                    meta.Comments,
                                                    meta.Parameters,
                                                    meta.Prompt,
                                                    meta.ImageDescription
                                                ].filter(Boolean).join('\n');

                                                if (fullData) {
                                                    processMetadataText(fullData);
                                                    addToast('success', 'Metadata extracted');
                                                }
                                            }
                                        } catch (err) {
                                        }
                                    }
                                }
                            }}
                        />
                        <BlobImage
                            image={{ src: formData.src } as any}
                            alt="Quick save preview"
                            className="w-full h-full object-contain opacity-100 transition-transform duration-500 group-hover/image:scale-105"
                            placeholder={false}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent pointer-events-none"></div>

                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover/image:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-3">
                            <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center text-accent shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                                <Upload size={28} />
                            </div>
                            <span className="text-xs font-bold text-white tracking-widest uppercase">Import Image</span>
                        </div>

                        <div className="absolute top-4 left-4">
                            <div className={`
                            px-3 py-1.5 rounded-xl bg-black/80 backdrop-blur-md border border-border flex items-center gap-2 shadow-lg transition-all duration-700
                            ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                        `}>
                                <Zap size={12} className="text-white fill-white" />
                                <span className="text-[10px] font-bold text-white tracking-wide uppercase">New Entry</span>
                            </div>
                        </div>

                        <div className="absolute bottom-4 right-4 flex gap-1 p-1.5 rounded-lg bg-black/60 backdrop-blur-md border border-white/10" onClick={(e) => e.stopPropagation()}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <button
                                    key={star}
                                    onClick={() => setFormData({ ...formData, rating: star === formData.rating ? 0 : star })}
                                    className={`transition-all hover:scale-110 ${star <= formData.rating ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}
                                >
                                    <Star size={14} fill={star <= formData.rating ? "currentColor" : "none"} />
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={`
                    flex-1 p-6 flex flex-col min-h-0 relative transition-all duration-700 delay-100
                    ${isReady ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
                `}>
                        <div className="mb-5">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Save As</label>
                            <input
                                autoFocus
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Untitled"
                                className="w-full bg-transparent text-xl text-white font-medium placeholder:text-zinc-700 outline-none border-b border-border focus:border-white py-2 transition-colors"
                            />
                        </div>

                        <div className="flex-1 flex flex-col min-h-0 mb-4 relative group/prompt">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex justify-between">
                                <span>Prompt</span>
                                <AlignLeft size={12} />
                            </label>
                            <textarea
                                value={formData.prompt}
                                onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                                className="w-full flex-1 bg-background border border-border rounded-xl p-3 text-xs leading-relaxed text-zinc-300 font-mono resize-none focus:border-accent/50 outline-none custom-scrollbar transition-colors"
                            />
                        </div>

                        <div className="pt-4 flex items-center justify-between shrink-0">
                            <button
                                onClick={() => setExpanded(!expanded)}
                                className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-300
                                ${expanded ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'}
                            `}
                            >
                                <ChevronRight
                                    size={14}
                                    className={`transition-transform duration-500 ${expanded ? (isHorizontal ? 'rotate-180' : '-rotate-90') : (isHorizontal ? '' : 'rotate-90')}`}
                                />
                                <span>Metadata</span>
                            </button>

                            <div className="relative group/vault">
                                <button
                                    onClick={() => setShowVaultSelect(!showVaultSelect)}
                                    className="h-9 px-3 rounded-lg flex items-center gap-2 hover:bg-white/5 transition-all"
                                >
                                    <div className="flex flex-col items-end">
                                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] leading-none mb-0.5">Target</span>
                                        <span className="text-[10px] font-bold text-accent tracking-wide leading-none">{sources.find(s => s.id === targetSourceId)?.name || 'Library'}</span>
                                    </div>
                                    <Layers size={14} className="text-zinc-500 opacity-50 group-hover/vault:opacity-100 group-hover/vault:text-accent transition-all" />
                                </button>

                                {showVaultSelect && (
                                    <div className="absolute bottom-full mb-3 right-0 w-44 bg-surface/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.4)] p-1.5 z-50 animate-fade-in translate-y-[-4px]">
                                        <div className="px-3 py-2 text-[8px] uppercase font-black text-zinc-500 tracking-[0.2em] border-b border-white/5 mb-1">Select Vault</div>
                                        {sources.map(s => (
                                            <button
                                                key={s.id}
                                                onClick={() => { setTargetSourceId(s.id); setShowVaultSelect(false); }}
                                                className={`w-full px-3 py-2 rounded-xl text-left text-[11px] transition-all flex items-center justify-between group ${targetSourceId === s.id ? 'bg-accent/10 text-accent font-bold' : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
                                            >
                                                <span>{s.name}</span>
                                                {targetSourceId === s.id && <div className="w-1 h-1 rounded-full bg-accent"></div>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`flex items-center gap-2 px-8 py-2 bg-white hover:bg-zinc-100 text-black rounded-2xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-95 shadow-xl ${isSaving ? 'opacity-50 cursor-wait' : ''}`}
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-black/10 border-t-black rounded-full animate-spin" />
                                ) : (
                                    <Save size={16} />
                                )}
                                <span>{isSaving ? 'Saving...' : 'Save'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div
                    className={`
                    absolute bg-[#0c0c0e] flex flex-col p-6 z-10
                    transition-all duration-600 cubic-bezier(0.16, 1, 0.3, 1)
                `}
                    style={{
                        // Layout Position
                        top: isHorizontal ? 0 : 'auto',
                        bottom: 0,
                        right: 0,
                        left: isHorizontal ? 'auto' : 0,

                        height: isHorizontal ? '100%' : PANEL_HEIGHT,
                        width: isHorizontal ? PANEL_WIDTH : '100%',

                        opacity: expanded ? 1 : 0,
                        transform: expanded
                            ? 'translate(0, 0)'
                            : isHorizontal
                                ? 'translateX(-10%)'
                                : 'translateY(-10%)',
                        pointerEvents: expanded ? 'auto' : 'none'
                    }}
                >
                    <div className="flex items-center justify-between mb-6 pr-12">
                        <div className="flex items-center gap-2 text-zinc-400">
                            <Wand2 size={16} />
                            <span className="text-sm font-semibold tracking-wide text-zinc-200">Generation Data</span>
                        </div>
                        <button
                            onClick={handlePasteMetadata}
                            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-md text-[10px] font-bold uppercase tracking-wide transition-colors border border-white/5"
                        >
                            <Clipboard size={12} /> Paste Data
                        </button>
                    </div>

                    <div className="space-y-5 overflow-y-auto custom-scrollbar pr-2 h-full pb-4">
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                <AlertCircle size={10} /> Negative Prompt
                            </label>
                            <textarea
                                value={formData.negativePrompt}
                                onChange={(e) => setFormData({ ...formData, negativePrompt: e.target.value })}
                                placeholder="Low quality, ugly..."
                                className="w-full h-16 bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:border-white/30 outline-none transition-colors resize-none"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Model Checkpoint</label>
                            <input
                                value={formData.model}
                                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:border-white/30 outline-none transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                    <Hash size={10} /> Seed
                                </label>
                                <input
                                    type="number"
                                    value={formData.seed}
                                    onChange={(e) => setFormData({ ...formData, seed: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:border-white/30 outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                    <Layers size={10} /> Steps
                                </label>
                                <input
                                    type="number"
                                    value={formData.steps}
                                    onChange={(e) => setFormData({ ...formData, steps: parseInt(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:border-white/30 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                    <Cpu size={10} /> CFG Scale
                                </label>
                                <input
                                    type="number"
                                    value={formData.cfg}
                                    onChange={(e) => setFormData({ ...formData, cfg: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:border-white/30 outline-none"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-600 uppercase tracking-wider">
                                    Sampler
                                </label>
                                <input
                                    value={formData.sampler}
                                    onChange={(e) => setFormData({ ...formData, sampler: e.target.value })}
                                    className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:border-white/30 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickSave;