import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, ArrowRight, Settings, Plus, Home,
    Database, Laptop, Download, Sparkles, CheckCircle, X, Zap
} from 'lucide-react';
import { ElementType } from 'react';
import { useApp } from '../hooks/useApp';
import { normalizePath } from '../utils';

interface CommandItem {
    id: string;
    icon: ElementType;
    label: string;
    shortcut?: string;
    action: () => void;
    group: string;
}

const CommandPalette = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const navigate = useNavigate();
    const {
        images, filteredImages, updateGeneralSettings, generalSettings,
        addToast, activeSourceId, setActiveSourceId, setSelectedImage,
        selectedIds, clearSelection, selectAll, generateBatchCaptions
    } = useApp();

    const commands: CommandItem[] = [
        { id: 'nav-home', icon: Home, label: 'Go to Library', group: 'Navigation', action: () => { navigate('/'); setSelectedImage(null); } },
        { id: 'nav-settings', icon: Settings, label: 'Open Settings', group: 'Navigation', shortcut: 'G S', action: () => { navigate('/settings'); setSelectedImage(null); } },
        { id: 'nav-new', icon: Plus, label: 'Quick Save / Import', group: 'Navigation', shortcut: 'G N', action: () => { navigate('/quick-save'); setSelectedImage(null); } },


        { id: 'view-source-all', icon: Database, label: 'View All Sources', group: 'View', action: () => setActiveSourceId('all') },

        {
            id: 'act-export', icon: Download, label: 'Export Library JSON', group: 'Actions', action: () => {
                const dataStr = JSON.stringify(images, null, 2);
                const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
                const linkElement = document.createElement('a');
                linkElement.setAttribute('href', dataUri);
                linkElement.setAttribute('download', 'library_export.json');
                linkElement.click();
            }
        },
        {
            id: 'act-copy-source', icon: Laptop, label: 'Copy Current Source ID', group: 'Actions', action: () => {
                if (activeSourceId && activeSourceId !== 'all') {
                    navigator.clipboard.writeText(activeSourceId);
                    addToast('success', 'Source ID copied to clipboard');
                } else {
                    addToast('info', 'No specific source selected to copy');
                }
            }
        },

        {
            id: 'act-copy-path',
            icon: Database,
            label: 'Copy Selected Image Path',
            group: 'Selection',
            action: () => {
                if (selectedIds.size === 1) {
                    const id = Array.from(selectedIds)[0];
                    const img = images.find(i => i.id === id);
                    if (img) {
                        navigator.clipboard.writeText(normalizePath(img.src));
                        addToast('success', 'Path copied to clipboard');
                    }
                } else {
                    addToast('info', 'Select exactly one image to copy its path');
                }
            }
        },

        {
            id: 'sel-all',
            icon: CheckCircle,
            label: `Select All Visible (${filteredImages.length})`,
            group: 'Selection',
            action: () => {
                selectAll(filteredImages.map(img => img.id));
                addToast('success', `Selected ${filteredImages.length} visible items`);
            }
        },
        {
            id: 'sel-clear',
            icon: X,
            label: `Clear Selection (${selectedIds.size})`,
            group: 'Selection',
            action: () => clearSelection()
        },
        {
            id: 'sel-copy',
            icon: Laptop,
            label: `Copy Selected Prompts (${selectedIds.size})`,
            group: 'Selection',
            action: () => {
                const selectedPrompts = images
                    .filter(img => selectedIds.has(img.id))
                    .map(img => img.prompt)
                    .join('\n---\n');
                navigator.clipboard.writeText(selectedPrompts);
                addToast('success', 'Prompts copied to clipboard');
            }
        },
        {
            id: 'sel-caption',
            icon: Sparkles,
            label: 'Batch AI Caption Selected',
            group: 'Selection',
            action: () => generateBatchCaptions()
        },

        {
            id: 'pref-motion', icon: Zap, label: 'Toggle Reduced Motion', group: 'Preferences', action: () => {
                updateGeneralSettings({ reduceMotion: !generalSettings.reduceMotion });
                addToast('info', `Reduced Motion: ${!generalSettings.reduceMotion ? 'ON' : 'OFF'}`);
            }
        }
    ];

    const filteredCommands = commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase()) ||
        cmd.group.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        const onKeydown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', onKeydown);
        return () => window.removeEventListener('keydown', onKeydown);
    }, []);

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filteredCommands[selectedIndex]) {
                handleSelect(filteredCommands[selectedIndex]);
            }
        }
    };

    const handleSelect = (item: CommandItem) => {
        item.action();
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[20vh] animate-fade-in"
            onClick={() => setIsOpen(false)}
        >
            <div
                className="w-full max-w-lg bg-surface border border-white/5 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-zoom-in ring-1 ring-white/5"
                onClick={(e) => e.stopPropagation()}
            >
                <label className="h-14 flex items-center px-4 border-b border-white/5 gap-3">
                    <Search size={18} className="text-zinc-500" />
                    <span className="sr-only">Search and run commands</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        placeholder="Type a command or search..."
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 outline-none h-full font-medium"
                    />
                    <div className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 text-[10px] font-bold text-zinc-500">ESC</div>
                </label>

                <div
                    ref={listRef}
                    className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1"
                >
                    {filteredCommands.length > 0 ? filteredCommands.map((item, index) => (
                        <button
                            key={item.id}
                            onClick={() => handleSelect(item)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-left group ${index === selectedIndex ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-1.5 rounded-md ${index === selectedIndex ? 'bg-white/20' : 'bg-white/5'}`}>
                                    <item.icon size={16} />
                                </div>
                                <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            {item.shortcut && (
                                <span className={`text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded ${index === selectedIndex ? 'bg-black/20 text-white/80' : 'bg-white/5 text-zinc-600'}`}>
                                    {item.shortcut}
                                </span>
                            )}
                            {index === selectedIndex && <ArrowRight size={14} className="animate-slide-in-right ml-2" />}
                        </button>
                    )) : (
                        <div className="px-4 py-8 text-center text-zinc-500 text-sm">
                            No commands found for "{query}"
                        </div>
                    )}
                </div>

                <div className="h-8 bg-background/50 border-t border-white/5 flex items-center justify-between px-4">
                    <span className="text-[10px] text-zinc-600 font-medium">
                        {filteredCommands.length} commands available
                    </span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-600">Navigate</span>
                        <div className="flex gap-0.5">
                            <div className="w-4 h-4 bg-white/5 rounded flex items-center justify-center text-[8px] text-zinc-500">↑</div>
                            <div className="w-4 h-4 bg-white/5 rounded flex items-center justify-center text-[8px] text-zinc-500">↓</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CommandPalette;