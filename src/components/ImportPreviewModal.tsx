import { useState, useEffect, useMemo, FC } from 'react';
import { createPortal } from 'react-dom';
import {
    X, Image as ImageIcon, Loader2, CheckCircle, Circle,
    FileText, Sparkles, Grid3X3, List, Eye, EyeOff,
    ChevronDown, ChevronUp, Zap, AlertCircle
} from 'lucide-react';
import { BlobImage } from './Common';
import { toMediaUrl } from '../utils';

interface PendingFile {
    file: File;
    name: string;
    baseName: string;
    preview: string;
    selected: boolean;
    captionFile?: File;
    captionPreview?: string;
    size: string;
}

interface ImportPreviewModalProps {
    files: FileWithPath[];
    allFiles?: FileList | null;
    folderName: string;
    onConfirm: (selectedFiles: FileWithPath[]) => void;
    onCancel: () => void;
    isElectron?: boolean;
}

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

interface FileWithPath extends File {
    fullPath?: string;
}

const ImportPreviewModal: FC<ImportPreviewModalProps> = ({ files, allFiles, folderName, onConfirm, onCancel, isElectron = false }) => {
    const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterMode, setFilterMode] = useState<'all' | 'with_caption' | 'without_caption'>('all');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [showCaptions, setShowCaptions] = useState(true);
    const [expandedItem, setExpandedItem] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        const createdUrls: string[] = [];

        const processFiles = async () => {
            setIsLoading(true);
            setPendingFiles([]);
            const allFilesList = allFiles ? Array.from(allFiles) : [];
            const txtFiles = allFilesList.filter(f => f.name.endsWith('.txt'));

            const imageFiles = (files as FileWithPath[]).filter(f => !f.name.toLowerCase().endsWith('.txt'));
            const CHUNK_SIZE = 20;

            try {
                for (let i = 0; i < imageFiles.length; i += CHUNK_SIZE) {
                    if (!isMounted) break;

                    const chunk = imageFiles.slice(i, i + CHUNK_SIZE);
                    const chunkResults: PendingFile[] = await Promise.all(chunk.map(async file => {
                        const fileName = file.name;
                        const baseName = fileName.substring(0, fileName.lastIndexOf('.'));

                        let captionPreview: string | undefined;
                        let previewUrl: string = "";

                        if (isElectron && file.fullPath) {
                            previewUrl = toMediaUrl(file.fullPath);

                            try {
                                const basePath = file.fullPath.substring(0, file.fullPath.lastIndexOf('.'));
                                const content = await (window as any).electronAPI.readFile(basePath + '.txt');
                                if (content) captionPreview = content.slice(0, 500);
                            } catch (e) {
                                /* Associated caption sidecar missing */
                            }
                        } else {
                            const foundTxt = txtFiles.find(tf => {
                                const txtBaseName = tf.name.substring(0, tf.name.lastIndexOf('.'));
                                return txtBaseName === baseName;
                            });

                            if (foundTxt) {
                                try {
                                    const text = await foundTxt.text();
                                    captionPreview = text.slice(0, 500);
                                } catch (e) {
                                    captionPreview = "[Error reading caption]";
                                }
                            }
                            previewUrl = URL.createObjectURL(file);
                            createdUrls.push(previewUrl);
                        }

                        let actualCaptionFile: File | undefined;
                        if (!isElectron) {
                            actualCaptionFile = txtFiles.find(tf => {
                                const txtBaseName = tf.name.substring(0, tf.name.lastIndexOf('.'));
                                return txtBaseName === baseName;
                            });
                        }

                        return {
                            file,
                            name: fileName,
                            baseName,
                            preview: previewUrl,
                            selected: true,
                            captionFile: actualCaptionFile,
                            captionPreview,
                            size: formatFileSize(file.size || 0)
                        };
                    }));

                    if (isMounted) {
                        setPendingFiles(prev => [...prev, ...chunkResults]);
                        setIsLoading(false);
                    }

                    await new Promise(resolve => setTimeout(resolve, 0));
                }
            } catch (error) {
                console.error("Error processing files for preview:", error);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        processFiles();

        return () => {
            isMounted = false;
            createdUrls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [files, allFiles]);

    const filteredFiles = useMemo(() => {
        if (filterMode === 'all') return pendingFiles;
        if (filterMode === 'with_caption') return pendingFiles.filter(pf => pf.captionFile || pf.captionPreview);
        return pendingFiles.filter(pf => !pf.captionFile && !pf.captionPreview);
    }, [pendingFiles, filterMode]);

    const stats = useMemo(() => ({
        total: pendingFiles.length,
        withCaption: pendingFiles.filter(pf => pf.captionFile || pf.captionPreview).length,
        withoutCaption: pendingFiles.filter(pf => !pf.captionFile && !pf.captionPreview).length,
        selected: pendingFiles.filter(pf => pf.selected).length
    }), [pendingFiles]);

    const toggleSelection = (baseName: string) => {
        setPendingFiles(prev => prev.map(pf =>
            pf.baseName === baseName ? { ...pf, selected: !pf.selected } : pf
        ));
    };

    const selectAll = () => setPendingFiles(prev => prev.map(pf => ({ ...pf, selected: true })));
    const deselectAll = () => setPendingFiles(prev => prev.map(pf => ({ ...pf, selected: false })));
    const selectWithCaptions = () => setPendingFiles(prev => prev.map(pf => ({ ...pf, selected: !!(pf.captionFile || pf.captionPreview) })));

    const handleConfirm = () => {
        const selectedFiles = pendingFiles.filter(pf => pf.selected).map(pf => pf.file);
        onConfirm(selectedFiles as any);
    };

    return createPortal(
        <div className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-[#0a0a0c] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">

                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-gradient-to-r from-zinc-900/50 to-transparent">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            <div className="p-3 bg-gradient-to-br from-accent/20 to-purple-500/10 rounded-xl border border-accent/20">
                                <ImageIcon size={24} className="text-accent" />
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-lg shadow-emerald-500/50">
                                {stats.selected}
                            </div>
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Import Preview</h2>
                            <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-zinc-500 font-medium">{folderName}</span>
                                <span className="text-zinc-700">•</span>
                                <span className="text-xs font-mono text-zinc-400">{stats.total} images</span>
                                {stats.withCaption > 0 && (
                                    <>
                                        <span className="text-zinc-700">•</span>
                                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                                            <FileText size={10} /> {stats.withCaption} with captions
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <button onClick={onCancel} className="p-2 hover:bg-white/5 rounded-xl text-zinc-500 hover:text-white transition-all hover:rotate-90 duration-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between gap-4 bg-black/30">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center bg-zinc-900/80 rounded-lg border border-white/5 p-0.5">
                            <button
                                onClick={() => setFilterMode('all')}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${filterMode === 'all' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                All ({stats.total})
                            </button>
                            <button
                                onClick={() => setFilterMode('with_caption')}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 ${filterMode === 'with_caption' ? 'bg-emerald-500/20 text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <FileText size={10} /> Paired ({stats.withCaption})
                            </button>
                            <button
                                onClick={() => setFilterMode('without_caption')}
                                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all flex items-center gap-1 ${filterMode === 'without_caption' ? 'bg-amber-500/20 text-amber-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <AlertCircle size={10} /> Unpaired ({stats.withoutCaption})
                            </button>
                        </div>

                        <div className="h-5 w-px bg-white/10 mx-1"></div>

                        <div className="flex items-center bg-zinc-900/80 rounded-lg border border-white/5 p-0.5">
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <List size={14} />
                            </button>
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                            >
                                <Grid3X3 size={14} />
                            </button>
                        </div>

                        <button
                            onClick={() => setShowCaptions(!showCaptions)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${showCaptions ? 'bg-accent/10 text-accent border border-accent/20' : 'text-zinc-600 hover:text-zinc-400 border border-white/5'}`}
                        >
                            {showCaptions ? <Eye size={12} /> : <EyeOff size={12} />}
                            Captions
                        </button>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={selectAll} className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors uppercase tracking-wider">
                            Select All
                        </button>
                        <button onClick={selectWithCaptions} className="px-3 py-1.5 text-[10px] font-bold text-emerald-500/70 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors uppercase tracking-wider flex items-center gap-1">
                            <Zap size={10} /> Only Paired
                        </button>
                        <button onClick={deselectAll} className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors uppercase tracking-wider">
                            Deselect All
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-4">
                            <Loader2 size={32} className="text-accent animate-spin" />
                            <p className="text-sm text-zinc-500">Scanning folder...</p>
                        </div>
                    ) : viewMode === 'list' ? (
                        <div className="divide-y divide-white/5">
                            {filteredFiles.map((pf) => (
                                <div
                                    key={pf.baseName}
                                    className={`
                                        group flex items-start gap-4 p-4 transition-all cursor-pointer
                                        ${pf.selected ? 'bg-accent/5' : 'hover:bg-white/[0.02]'}
                                        ${expandedItem === pf.baseName ? 'bg-zinc-900/50' : ''}
                                    `}
                                    onClick={() => toggleSelection(pf.baseName)}
                                >
                                    <div className="pt-1">
                                        {pf.selected ? (
                                            <CheckCircle size={20} className="text-accent" />
                                        ) : (
                                            <Circle size={20} className="text-zinc-700 group-hover:text-zinc-500" />
                                        )}
                                    </div>

                                    <div className="relative shrink-0">
                                        <BlobImage
                                            image={{ src: pf.preview }}
                                            alt={pf.name}
                                            className={`w-20 h-20 object-cover rounded-lg border transition-all ${pf.selected ? 'border-accent/50 ring-2 ring-accent/20' : 'border-white/10'}`}
                                            placeholder={false}
                                        />
                                        {pf.captionFile && (
                                            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                                <FileText size={10} className="text-white" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className={`font-bold truncate ${pf.selected ? 'text-white' : 'text-zinc-400'}`}>
                                                {pf.baseName}
                                            </h3>
                                            <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-1.5 py-0.5 rounded">
                                                {pf.size}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-[10px] text-zinc-600">{pf.name}</span>
                                            {pf.captionFile && (
                                                <span className="text-[10px] text-emerald-500/70 flex items-center gap-1">
                                                    <FileText size={8} /> {pf.captionFile.name}
                                                </span>
                                            )}
                                            {!pf.captionFile && pf.captionPreview && (
                                                <span className="text-[10px] text-emerald-500/70 flex items-center gap-1 font-bold">
                                                    <FileText size={8} /> Linked TXT Found
                                                </span>
                                            )}
                                        </div>

                                        {showCaptions && pf.captionPreview && (
                                            <div
                                                className="relative cursor-pointer group/readmore"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setExpandedItem(expandedItem === pf.preview ? null : pf.preview);
                                                }}
                                            >
                                                <p className={`text-xs text-zinc-500 font-mono bg-black/30 rounded-lg p-3 border border-white/5 leading-relaxed transition-all ${expandedItem === pf.preview ? 'whitespace-pre-wrap' : 'line-clamp-2'}`}>
                                                    {pf.captionPreview}
                                                </p>
                                                {pf.captionPreview.length > 150 && (
                                                    <div className="absolute bottom-2 right-2 text-[9px] font-bold text-accent group-hover/readmore:text-white transition-colors flex items-center gap-0.5 bg-[#0a0a0c]/90 backdrop-blur px-2 py-0.5 rounded-full border border-white/5 shadow-lg">
                                                        {expandedItem === pf.preview ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                                        {expandedItem === pf.preview ? 'Show Less' : 'Read More'}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {!pf.captionFile && !pf.captionPreview && (
                                            <div className="flex items-center gap-2 text-xs text-amber-500/60">
                                                <AlertCircle size={12} />
                                                <span>No matching caption file</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 p-4">
                            {filteredFiles.map((pf) => (
                                <div
                                    key={pf.baseName}
                                    onClick={() => toggleSelection(pf.baseName)}
                                    className={`
                                        relative aspect-square rounded-xl overflow-hidden cursor-pointer group
                                        border-2 transition-all duration-200
                                        ${pf.selected
                                            ? 'border-accent ring-2 ring-accent/30 scale-[0.98]'
                                            : 'border-transparent hover:border-white/20 opacity-60 hover:opacity-100'
                                        }
                                    `}
                                >
                                    <BlobImage image={{ src: pf.preview }} alt={pf.name} className="w-full h-full object-cover" placeholder={false} />

                                    <div className={`absolute inset-0 transition-all ${pf.selected ? 'bg-accent/10' : 'bg-black/30'}`}>
                                        <div className="absolute top-2 left-2">
                                            {pf.selected ? (
                                                <CheckCircle size={20} className="text-white drop-shadow-lg" />
                                            ) : (
                                                <Circle size={20} className="text-white/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            )}
                                        </div>
                                    </div>

                                    {pf.captionFile && (
                                        <div className="absolute top-2 right-2 w-5 h-5 bg-emerald-500 rounded-md flex items-center justify-center shadow-lg">
                                            <FileText size={10} className="text-white" />
                                        </div>
                                    )}

                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
                                        <p className="text-[9px] text-white/80 truncate font-medium">{pf.baseName}</p>
                                        <p className="text-[8px] text-zinc-500">{pf.size}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-gradient-to-r from-zinc-900/50 to-black/50">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${stats.selected > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-700'}`}></div>
                            <span className="text-sm font-bold text-zinc-400">
                                <span className="text-white">{stats.selected}</span> / {stats.total} selected
                            </span>
                        </div>
                        {stats.withCaption > 0 && (
                            <span className="text-xs text-zinc-600">
                                {pendingFiles.filter(pf => pf.selected && (pf.captionFile || pf.captionPreview)).length} with captions
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={onCancel}
                            className="px-5 py-2.5 text-sm font-bold text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-white/10"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={stats.selected === 0}
                            className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-accent to-purple-600 hover:from-accent-hover hover:to-purple-500 disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-accent/20 disabled:shadow-none hover:scale-105 active:scale-95 disabled:hover:scale-100"
                        >
                            <Sparkles size={16} />
                            Import {stats.selected} {stats.selected === 1 ? 'Image' : 'Images'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ImportPreviewModal;
