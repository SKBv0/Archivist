import { FC } from 'react';
import {
    Infinity as InfinityIcon, Database, FolderOpen, Library, X,
    FolderEdit, CheckCircle, Unlink, Plus
} from 'lucide-react';
import { LibrarySource, AIImage } from '../../types';

interface ArchiveSidebarProps {
    sources: LibrarySource[];
    images: AIImage[];
    activeSourceId: string;
    setActiveSourceId: (id: string) => void;
    showVaultManager: boolean;
    setShowVaultManager: (val: boolean) => void;
    handleMouseEnter: (e: React.MouseEvent, text: string) => void;
    handleMouseLeave: () => void;
    editingSourceId: string | null;
    editingName: string;
    setEditingName: (val: string) => void;
    handleSaveRename: () => void;
    handleCancelRename: () => void;
    handleStartRename: (id: string, name: string) => void;
    confirmUnlink: string | null;
    setConfirmUnlink: (val: string | null) => void;
    handleUnlinkSource: (id: string, deleteImages: boolean) => void;
    addLocalFolder: () => void;
    isElectron: boolean;
    platform: string | undefined;
}

const ArchiveSidebar: FC<ArchiveSidebarProps> = ({
    sources, images, activeSourceId, setActiveSourceId,
    showVaultManager, setShowVaultManager,
    handleMouseEnter, handleMouseLeave,
    editingSourceId, editingName, setEditingName,
    handleSaveRename, handleCancelRename, handleStartRename,
    confirmUnlink, setConfirmUnlink, handleUnlinkSource,
    addLocalFolder, isElectron, platform
}) => {
    return (
        <>
            <div className={`w-[64px] h-full flex flex-col items-center gap-5 shrink-0 z-30 bg-surface ${isElectron && platform === 'darwin' ? 'pt-12' : 'pt-3 pb-6'}`}>
                <button
                    onClick={() => setActiveSourceId('all')}
                    onMouseEnter={(e) => handleMouseEnter(e, "Unified Stream")}
                    onMouseLeave={handleMouseLeave}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group relative ${activeSourceId === 'all' ? 'text-white' : 'text-zinc-600 hover:text-zinc-300'}`}
                    aria-label="Unified Stream"
                >
                    <div className={`absolute inset-0 bg-white/5 rounded-xl scale-75 opacity-0 transition-all duration-300 ${activeSourceId === 'all' ? 'scale-100 opacity-100' : 'group-hover:opacity-100'}`} />
                    <InfinityIcon size={22} strokeWidth={activeSourceId === 'all' ? 2.5 : 2} className="relative z-10" />
                    {activeSourceId === 'all' && <div className="absolute -bottom-2 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white] animate-fade-in"></div>}
                </button>

                <div className="w-4 h-px bg-white/5 rounded-full my-1"></div>

                <div className="flex flex-col gap-2 w-full items-center overflow-y-auto custom-scrollbar no-scrollbar flex-1 pb-4">
                    {(sources || []).map(source => (
                        <button
                            key={source.id}
                            onClick={() => setActiveSourceId(source.id)}
                            onMouseEnter={(e) => handleMouseEnter(e, source.name)}
                            onMouseLeave={handleMouseLeave}
                            className="relative group w-10 h-10 flex items-center justify-center"
                            aria-label={source.name}
                        >
                            {activeSourceId === source.id && <div className="absolute left-0 w-0.5 h-3 bg-white rounded-r-full shadow-[0_0_10px_rgba(255,255,255,0.5)] animate-fade-in"></div>}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${activeSourceId === source.id ? 'bg-zinc-800 text-white' : 'text-zinc-600 group-hover:text-zinc-400 group-hover:bg-white/5'}`}>
                                {source.type === 'internal' ? <Database size={16} /> : <FolderOpen size={16} />}
                            </div>
                        </button>
                    ))}
                </div>

                <div className="mt-auto">
                    <button
                        onClick={() => setShowVaultManager(!showVaultManager)}
                        onMouseEnter={(e) => handleMouseEnter(e, "Manage Vaults")}
                        onMouseLeave={handleMouseLeave}
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${showVaultManager ? 'bg-accent text-white' : 'border border-white/10 hover:border-white/30 text-zinc-600 hover:text-white hover:bg-white/5'}`}
                        aria-label="Manage Vaults"
                    >
                        <Library size={18} />
                    </button>
                </div>
            </div>

            <div className={`h-full bg-surface z-20 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] border-r border-white/5 ${showVaultManager ? 'w-[280px] opacity-100 shadow-[20px_0_40px_rgba(0,0,0,0.5)]' : 'w-0 opacity-0'}`}>
                <div className={`w-[280px] h-full flex flex-col bg-surface/50 backdrop-blur-xl ${isElectron && platform === 'darwin' ? 'pt-12' : ''}`}>
                    <div className="py-6 pl-3 pr-4 border-b border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex flex-col">
                                <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Vault Manager</h3>
                                <p className="text-[10px] text-zinc-600 font-medium">Manage your creative sources</p>
                            </div>
                            <button onClick={() => setShowVaultManager(false)} className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-white hover:bg-white/5 rounded-full transition-all" aria-label="Close Vault Manager">
                                <X size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar pl-3 pr-4 py-4 space-y-3">
                        {(sources || []).map(source => {
                            const sourceImageCount = images.filter(img => img.sourceId === source.id).length;
                            const isEditing = editingSourceId === source.id;
                            const isConfirming = confirmUnlink === source.id;

                            return (
                                <div key={source.id} className={`group relative overflow-hidden rounded-[20px] border transition-all duration-300 ${activeSourceId === source.id ? 'bg-white/[0.03] border-white/10' : 'bg-transparent border-white/[0.03] hover:border-white/10'}`}>
                                    <div className="p-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 ${source.type === 'internal' ? 'bg-accent/20 text-accent shadow-[0_0_20px_hsla(var(--accent-hsl),0.2)]' : 'bg-zinc-800/50 text-zinc-400'}`}>
                                                {source.type === 'internal' ? <Database size={18} /> : <FolderOpen size={18} />}
                                            </div>

                                            <div className="flex-1 min-w-0 pt-0.5">
                                                {isEditing ? (
                                                    <div className="flex items-center gap-1 animate-fade-in">
                                                        <label htmlFor={`rename-source-${source.id}`} className="sr-only">Rename source</label>
                                                        <input
                                                            id={`rename-source-${source.id}`}
                                                            type="text"
                                                            value={editingName}
                                                            onChange={(e) => setEditingName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleSaveRename();
                                                                if (e.key === 'Escape') handleCancelRename();
                                                            }}
                                                            autoFocus
                                                            className="flex-1 bg-black/40 border border-accent/50 px-2 py-1.5 rounded-lg text-xs text-white outline-none min-w-0 font-bold"
                                                            aria-label="Rename source"
                                                            title="Rename source"
                                                        />
                                                        <button onClick={handleSaveRename} className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 rounded-lg"><CheckCircle size={14} /></button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <h4 className="text-sm font-bold text-zinc-200 truncate tracking-tight">{source.name}</h4>
                                                        {source.type !== 'internal' && (
                                                            <button
                                                                onClick={() => handleStartRename(source.id, source.name)}
                                                                className="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-600 hover:text-white rounded-lg transition-all"
                                                                aria-label="Rename source"
                                                            >
                                                                <FolderEdit size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-2 mt-1.5">
                                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{sourceImageCount} Images</span>
                                                    {source.type === 'internal' && (
                                                        <span className="text-[8px] bg-accent text-white px-2 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-lg shadow-accent/20">Core</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {source.type !== 'internal' && (
                                            <div className={`mt-4 pt-4 border-t border-white/[0.03] transition-all duration-500 ${isConfirming ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden group-hover:h-auto group-hover:opacity-100'}`}>
                                                {isConfirming ? (
                                                    <div className="space-y-3 animate-fade-in">
                                                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider text-center">Unlink this vault?</p>

                                                        <p className="text-[9px] text-zinc-600 text-center px-2 leading-tight">
                                                            Library data will be removed. Your actual files will stay on disk.
                                                        </p>

                                                        <button
                                                            onClick={() => handleUnlinkSource(source.id, true)}
                                                            className="w-full py-2 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-red-500/20 transition-all hover:bg-red-600"
                                                        >
                                                            Confirm Unlink
                                                        </button>

                                                        <button
                                                            onClick={() => setConfirmUnlink(null)}
                                                            className="w-full text-center text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 py-1"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setConfirmUnlink(source.id)}
                                                        className="w-full flex items-center justify-center gap-2 py-2 text-zinc-600 hover:text-red-400 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-transparent hover:border-red-500/10 hover:bg-red-500/[0.02]"
                                                    >
                                                        <Unlink size={12} />
                                                        Unlink Source
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {activeSourceId === source.id && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-accent rounded-r-full shadow-[4px_0_15px_hsla(var(--accent-hsl),0.5)]"></div>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            onClick={() => addLocalFolder()}
                            className="w-full group mt-4 flex flex-col items-center justify-center gap-3 p-8 border border-dashed border-white/5 rounded-[32px] hover:border-accent/40 hover:bg-accent/[0.02] transition-all duration-500"
                        >
                            <div className="w-12 h-12 rounded-[18px] bg-zinc-900 flex items-center justify-center text-zinc-600 group-hover:bg-accent group-hover:text-white transition-all duration-500 group-hover:rotate-90 group-hover:shadow-[0_15px_30px_hsla(var(--accent-hsl),0.3)]">
                                <Plus size={24} />
                            </div>
                            <div className="flex flex-col items-center gap-1">
                                <span className="text-[11px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-300 transition-colors">Link Local Vault</span>
                                <span className="text-[9px] font-medium text-zinc-700">Add an existing local folder</span>
                            </div>
                        </button>
                    </div>

                    <div className="p-4 mt-auto">
                        <div className="bg-white/[0.03] backdrop-blur-md border border-white/5 rounded-[24px] p-4 shadow-2xl">
                            <div className="grid grid-cols-2 gap-4 relative">
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1">Total Assets</span>
                                    <span className="text-xl font-light text-zinc-300 tracking-tighter">{images.length}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-1 text-right">Active Vaults</span>
                                    <span className="text-xl font-light text-accent tracking-tighter">{sources.length}</span>
                                </div>
                                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-6 bg-white/5"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default ArchiveSidebar;
