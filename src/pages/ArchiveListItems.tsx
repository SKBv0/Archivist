import { memo, MouseEvent } from 'react';
import { AIImage, LibrarySource } from '../types';
import { Star, Maximize2, CheckCircle, Circle, AlertTriangle, Copy } from 'lucide-react';
import { BlobImage } from '../components/Common';

export const GalleryItem = memo(({
    img,
    isSelected,
    toggleSelection,
    setSelectedImage,
    updateImage
}: {
    img: AIImage,
    isSelected: boolean,
    toggleSelection: (id: string) => void,
    setSelectedImage: (img: AIImage) => void,
    updateImage: (id: string, updates: Partial<AIImage>) => void
}) => {

    const handleRate = (e: MouseEvent, rating: number) => {
        e.stopPropagation();
        updateImage(img.id, { rating: rating === 0 ? undefined : rating });
    };

    return (
        <div
            onClick={() => setSelectedImage(img)}
            className={`group relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-900/40 cursor-pointer shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-1.5 border ${isSelected ? 'border-accent ring-2 ring-accent/20 scale-[0.98]' : 'border-white/[0.03] hover:border-white/20'}`}
        >
            <BlobImage image={img} alt={img.title} className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${isSelected ? 'opacity-100' : 'opacity-80 group-hover:opacity-100'}`} />

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    toggleSelection(img.id);
                }}
                className={`absolute top-2 left-2 z-20 p-1 rounded-lg transition-all ${isSelected ? 'bg-accent text-white opacity-100' : 'bg-black/40 text-white/50 opacity-0 group-hover:opacity-100 hover:bg-black/60 hover:text-white'}`}
            >
                {isSelected ? <CheckCircle size={12} strokeWidth={3} /> : <Circle size={12} />}
            </button>

            <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-30">
                {img.duplicates && img.duplicates.length > 0 && (
                    <div className="relative group/duplicate">
                        <div className="bg-amber-500/90 text-black p-1 rounded-lg border border-amber-400/50 shadow-lg animate-pulse hover:animate-none transition-all">
                            <Copy size={10} strokeWidth={3} />
                        </div>
                        <div className="absolute top-full right-0 mt-1 p-2 bg-zinc-950/95 backdrop-blur-md border border-white/10 rounded-lg shadow-2xl w-40 opacity-0 invisible group-hover/duplicate:opacity-100 group-hover/duplicate:visible transition-all duration-200 translate-y-1 group-hover/duplicate:translate-y-0 z-50">
                            <div className="flex items-center gap-1.5 mb-1.5 pb-1.5 border-b border-white/5">
                                <AlertTriangle size={12} className="text-amber-500" />
                                <span className="text-[9px] uppercase font-black text-amber-500 tracking-wider">Duplicate</span>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[8px] text-zinc-500 uppercase font-bold">In Vaults:</p>
                                {img.duplicates.map((dupe, i) => (
                                    <div
                                        key={i}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedImage(dupe);
                                        }}
                                        className="flex flex-col gap-0.5 hover:bg-white/5 p-1 rounded transition-colors cursor-pointer group/item"
                                    >
                                        <span className="text-[9px] text-white font-bold truncate group-hover/item:text-accent transition-colors">{dupe.sourceName}</span>
                                        <span className="text-[8px] text-zinc-500 truncate italic">"{dupe.title}"</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-end gap-1 pointer-events-auto">
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(img.prompt);
                            }}
                            className="p-1 bg-black/60 backdrop-blur rounded border border-white/10 text-zinc-400 hover:text-white transition-all hover:scale-110"
                            title="Copy Prompt"
                        >
                            <Copy size={10} />
                        </button>
                        <div className="flex items-center gap-0.5 px-1 py-0.5 bg-black/60 backdrop-blur rounded border border-white/10" onClick={(e) => e.stopPropagation()}>
                            {[1, 2, 3, 4, 5].map(star => (
                                <button key={star} onClick={(e) => handleRate(e, star === img.rating ? 0 : star)} className={`transition-colors p-0.5 hover:scale-110 ${star <= (img.rating || 0) ? 'text-yellow-400' : 'text-zinc-600 hover:text-zinc-400'}`}>
                                    <Star size={8} fill={star <= (img.rating || 0) ? "currentColor" : "none"} />
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className="text-[8px] font-mono font-bold bg-black/60 backdrop-blur text-zinc-300 px-1 py-0.5 rounded border border-white/10 truncate max-w-full">{(img.model || '').slice(0, 10)}</span>
                </div>
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col justify-end p-2 sm:p-3 pointer-events-none">
                <h3 className="text-[10px] sm:text-xs font-bold text-white truncate">{img.title}</h3>
                <p className="text-[8px] sm:text-[10px] text-zinc-400 line-clamp-1 opacity-70">{img.prompt}</p>
            </div>
        </div>
    );
});

export const WorkbenchItem = memo(({
    img,
    isSelected,
    toggleSelection,
    setSelectedImage,
    columns,
    sources
}: {
    img: AIImage,
    isSelected: boolean,
    toggleSelection: (id: string) => void,
    setSelectedImage: (img: AIImage) => void,
    columns: string[],
    sources: LibrarySource[]
}) => {
    const sourceMap = new Map(sources.map(s => [s.id, s.name]));
    const currentVaultName = sourceMap.get(img.sourceId) || 'Local Vault';

    return (
        <div className={`group flex items-center gap-4 p-2 pr-4 rounded-2xl border transition-all duration-500 mb-3 ${isSelected ? 'bg-accent/[0.08] border-transparent shadow-[0_10px_40px_rgba(0,0,0,0.3)] ring-1 ring-white/5' : 'bg-transparent border-white/[0.03] hover:border-white/10 hover:bg-white/[0.02]'}`}>
            <button onClick={() => toggleSelection(img.id)} className="pl-2 text-zinc-600 hover:text-white transition-colors">
                {isSelected ? <CheckCircle size={18} className="text-accent" /> : <Circle size={18} />}
            </button>
            <div className="w-12 h-12 rounded-xl bg-black overflow-hidden relative shrink-0 border border-white/5 group-hover:border-white/10 transition-colors">
                <BlobImage image={img} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                {img.duplicates && img.duplicates.length > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center bg-amber-500/20 backdrop-blur-[1px]">
                        <Copy size={16} className="text-amber-500" />
                    </div>
                )}
            </div>
            <div className="flex-1 min-w-0 grid grid-cols-[200px_1fr_minmax(80px,auto)_50px_60px_100px_60px] gap-6 items-center">
                <div className="min-w-0">
                    {columns.includes('title') ? (
                        <div className="flex items-center gap-2">
                            <p className={`text-sm font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-300'}`}>{img.title}</p>
                            {img.duplicates && img.duplicates.length > 0 && (
                                <span className="text-[8px] px-1 bg-amber-500/20 text-amber-500 rounded border border-amber-500/30 font-black uppercase tracking-tighter shrink-0">Duplicate</span>
                            )}
                        </div>
                    ) : <div />}
                    <div className="flex items-center gap-2 mt-0.5">
                        {columns.includes('model') && <span className="text-[10px] text-zinc-500 font-mono truncate">{img.model}</span>}
                        {columns.includes('vault') && (
                            <>
                                <span className="text-[10px] text-zinc-700 mx-0.5">•</span>
                                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter truncate">{currentVaultName}</span>
                            </>
                        )}
                    </div>
                </div>

                {columns.includes('prompt') ? (
                    <div className="min-w-0">
                        <p className="text-xs text-zinc-500 line-clamp-1 font-mono opacity-80">{img.prompt}</p>
                    </div>
                ) : <div />}

                {columns.includes('sampler') ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Sampler</span>
                        <span className="text-[10px] font-mono text-zinc-400 truncate max-w-[100px]">{img.sampler}</span>
                    </div>
                ) : <div />}

                {columns.includes('cfg') ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">CFG</span>
                        <span className="text-[10px] font-mono text-zinc-400">{img.cfgScale}</span>
                    </div>
                ) : <div />}

                {columns.includes('steps') ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Steps</span>
                        <span className="text-[10px] font-mono text-zinc-400">{img.steps}</span>
                    </div>
                ) : <div />}

                {columns.includes('dimensions') ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Size</span>
                        <span className="text-[10px] font-mono text-zinc-400">{img.width}×{img.height}</span>
                    </div>
                ) : <div />}

                {columns.includes('tokens') ? (
                    <div className="flex flex-col items-end">
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Tokens</span>
                        <span className={`text-[11px] font-mono font-black ${img.prompt.length < 20 ? 'text-red-400/80' : 'text-emerald-500/80'}`}>{Math.round(img.prompt.length / 4)}</span>
                    </div>
                ) : <div />}
            </div>

            <div className="flex items-center gap-2 shrink-0">
                <div className="w-px h-6 bg-white/5 mx-1"></div>
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(img.prompt);
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-zinc-900/50 hover:bg-white hover:text-black rounded-xl text-zinc-500 transition-all hover:scale-105 active:scale-95 border border-white/5"
                    title="Copy Prompt"
                >
                    <Copy size={14} />
                </button>
                <button onClick={() => setSelectedImage(img)} className="w-9 h-9 flex items-center justify-center bg-zinc-900/50 hover:bg-white hover:text-black rounded-xl text-zinc-500 transition-all hover:scale-105 active:scale-95 border border-white/5" title="Open Editor"><Maximize2 size={14} /></button>
            </div>
        </div>
    );
});
