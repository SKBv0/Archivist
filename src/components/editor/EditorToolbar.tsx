import { FC } from 'react';
import { ArrowLeft, ArrowRight, Trash2, Save, Sliders, FileText, Palette } from 'lucide-react';
import { THEME_PRESETS } from '../../constants';
import { GeneralSettings } from '../../types';

interface EditorToolbarProps {
    onClose: () => void;
    activeTab: 'metadata' | 'caption';
    setActiveTab: (tab: 'metadata' | 'caption') => void;
    currentIndex: number;
    totalCount: number;
    onNavigate: (dir: 'next' | 'prev') => void;
    onDelete: () => void;
    onSave: () => void;
    updateGeneralSettings: (s: Partial<GeneralSettings>) => void;
    title?: string;
}

const EditorToolbar: FC<EditorToolbarProps> = ({
    onClose, activeTab, setActiveTab, currentIndex, totalCount, onNavigate, onDelete, onSave, updateGeneralSettings, title
}) => {
    const isElectron = !!window.electronAPI;
    const platform = window.electronAPI?.platform;

    return (
        <div className={`absolute top-0 left-0 right-0 flex flex-col bg-background/80 backdrop-blur-md border-b border-white/5 z-20 transition-all ${isElectron && platform !== 'darwin' ? 'h-24' : 'h-16'}`}>
            {isElectron && platform !== 'darwin' && (
                <div className="h-8 w-full flex items-center justify-center shrink-0 border-b border-white/[0.03]" style={{ WebkitAppRegion: 'drag' } as any}>
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-500 opacity-40 pointer-events-none">
                        {title || 'EDITOR'}
                    </span>
                </div>
            )}

            <div className="flex-1 flex items-center justify-between px-6" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex items-center gap-4">
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="h-6 w-px bg-white/10 mx-1"></div>

                    <div className="relative group z-50">
                        <button aria-label="Theme Selector" className="p-2 hover:bg-white/5 rounded-full text-zinc-400 hover:text-white transition-colors">
                            <Palette size={20} />
                        </button>
                        <div className="absolute top-full left-0 mt-2 p-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-[280px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 translate-y-2 group-hover:translate-y-0">
                            <div className="grid grid-cols-4 gap-2">
                                {THEME_PRESETS.map((preset) => (
                                    <button
                                        key={preset.name}
                                        onClick={() => updateGeneralSettings({
                                            themeAccent: preset.accent,
                                            gradientColors: { left: preset.left, center: preset.center, right: preset.right }
                                        })}
                                        className="group/item flex flex-col items-center gap-1.5 p-1.5 rounded-lg hover:bg-white/5 transition-all"
                                        title={preset.name}
                                    >
                                        <div
                                            className="w-full aspect-square rounded-md border border-white/10 group-hover/item:border-white/30 transition-all"
                                            style={{
                                                background: `linear-gradient(135deg, hsla(${preset.left}, 1) 0%, hsla(${preset.center}, 1) 100%)`
                                            }}
                                        />
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="flex bg-zinc-900 rounded-lg p-1 border border-white/5">
                        <button onClick={() => setActiveTab('metadata')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'metadata' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            <Sliders size={14} /> Metadata
                        </button>
                        <button onClick={() => setActiveTab('caption')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'caption' ? 'bg-zinc-700 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}>
                            <FileText size={14} /> Captioning
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-zinc-600">{currentIndex + 1} / {totalCount}</span>
                    <div className="flex gap-1">
                        <button onClick={() => onNavigate('prev')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30">
                            <ArrowLeft size={16} />
                        </button>
                        <button onClick={() => onNavigate('next')} className="p-2 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white disabled:opacity-30">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                    <div className="h-6 w-px bg-white/10 mx-2"></div>
                    <button onClick={onDelete} className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors mr-2">
                        <Trash2 size={16} />
                    </button>
                    <button onClick={onSave} className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                        <Save size={14} />
                        <span>Save</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditorToolbar;
