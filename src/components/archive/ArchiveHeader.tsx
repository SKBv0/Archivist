import { FC } from 'react';
import {
    SlidersHorizontal, Undo2, Redo2, HardDrive, FolderCog,
    Palette, Image as ImageIcon, RefreshCw
} from 'lucide-react';
import { SearchBar, SegmentedControl } from '../Common';
import { AIImage, LibrarySource, GeneralSettings } from '../../types';
import { THEME_PRESETS } from '../../constants';

interface ArchiveHeaderProps {
    showFilters: boolean;
    setShowFilters: (val: boolean) => void;
    activeFilter: string | null;
    undo: () => void;
    redo: () => void;
    canUndo: boolean;
    canRedo: boolean;
    search: string;
    setSearch: (val: string) => void;
    workspaceMode: 'gallery' | 'workbench';
    setWorkspaceMode: (mode: 'gallery' | 'workbench') => void;
    generalSettings: GeneralSettings;
    updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
    checkActiveSource: () => void;
}

const ArchiveHeader: FC<ArchiveHeaderProps> = ({
    showFilters, setShowFilters, activeFilter,
    undo, redo, canUndo, canRedo,
    search, setSearch,
    workspaceMode, setWorkspaceMode,
    generalSettings, updateGeneralSettings, checkActiveSource
}) => {
    return (
        <header className="flex flex-col bg-surface/50 backdrop-blur-md z-20 shrink-0 relative h-16">
            <div className="flex-1 flex items-center justify-between px-6 relative" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <div className="flex items-center gap-3">
                    <button onClick={() => setShowFilters(!showFilters)} className={`h-8 px-3 rounded-lg border transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wide ${showFilters || activeFilter ? 'bg-zinc-100 text-black border-zinc-100' : 'bg-transparent text-zinc-500 border-white/10 hover:text-white hover:bg-white/5'}`}>
                        <SlidersHorizontal size={14} /> <span>Filters</span> {activeFilter && <span className="w-1.5 h-1.5 rounded-full bg-accent ml-1"></span>}
                    </button>

                    <button
                        onClick={checkActiveSource}
                        className="h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 bg-transparent text-zinc-500 hover:text-white hover:bg-white/5 transition-all"
                        title="Scan for missing files"
                    >
                        <RefreshCw size={14} />
                    </button>

                    <div className="flex items-center gap-1">
                        <button onClick={undo} disabled={!canUndo} className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-30 rounded hover:bg-white/5" title="Undo" aria-label="Undo"><Undo2 size={16} /></button>
                        <button onClick={redo} disabled={!canRedo} className="p-1.5 text-zinc-500 hover:text-white disabled:opacity-30 rounded hover:bg-white/5" title="Redo" aria-label="Redo"><Redo2 size={16} /></button>
                    </div>
                    <SearchBar value={search} onChange={setSearch} placeholder="Search current stream..." className="w-52" />
                </div>

                <div className="absolute left-1/2 -translate-x-1/2 flex items-center pointer-events-none">
                    <div className="pointer-events-auto">
                        <SegmentedControl
                            value={workspaceMode}
                            onChange={setWorkspaceMode}
                            options={[
                                { value: 'gallery', label: 'Gallery', icon: HardDrive },
                                { value: 'workbench', label: 'Dataset', icon: FolderCog }
                            ]}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3">


                    <div className="flex items-center gap-2">
                        {workspaceMode === 'gallery' && (
                            <label className="flex items-center gap-2 mx-2">
                                <span className="sr-only">Adjust grid item size</span>
                                <ImageIcon size={12} className="text-zinc-600" />
                                <input
                                    type="range"
                                    min={150}
                                    max={500}
                                    value={generalSettings.gridItemSize}
                                    onChange={(e) => updateGeneralSettings({ gridItemSize: parseInt(e.target.value) })}
                                    className="w-16 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-zinc-300 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:bg-white"
                                />
                            </label>
                        )}

                        <div className="relative group/theme z-50">
                            <button aria-label="Quick Theme Switcher" className="w-8 h-8 flex items-center justify-center rounded-lg border border-white/10 text-zinc-500 hover:text-white hover:bg-white/5 transition-all">
                                <Palette size={14} />
                            </button>
                            <div className="absolute top-full right-0 mt-2 p-3 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-[280px] opacity-0 invisible group-hover/theme:opacity-100 group-hover/theme:visible transition-all duration-200 translate-y-2 group-hover/theme:translate-y-0">
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
                    </div>
                </div>
            </div>
        </header>
    );
};

export default ArchiveHeader;
