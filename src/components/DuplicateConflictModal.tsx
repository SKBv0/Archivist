import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { AIImageDB } from '../types';

interface DuplicateConflictModalProps {
    duplicateState: {
        newImages: AIImageDB[];
        duplicates: AIImageDB[];
        sourceName: string;
    };
    onResolve: (action: 'skip' | 'keep') => void;
    onCancel: () => void;
}

const DuplicateConflictModal: React.FC<DuplicateConflictModalProps> = ({ duplicateState, onResolve, onCancel }) => {
    const { duplicates, newImages, sourceName } = duplicateState;

    return (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#18181b] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-scale">

                {/* Header */}
                <div className="p-6 pb-2">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center mb-4">
                        <AlertTriangle size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-1">Duplicate Images Found</h2>
                    <p className="text-sm text-zinc-400">
                        Found <span className="text-white font-bold">{duplicates.length}</span> duplicates while importing from
                        <span className="text-white font-medium mx-1">"{sourceName}"</span>.
                    </p>
                </div>

                {/* Content Stats */}
                <div className="px-6 py-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                        <div className="flex-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-zinc-500">New Items</span>
                            <span className="text-lg font-bold text-white">{newImages.length}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10"></div>
                        <div className="flex-1">
                            <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-500">Conflicts</span>
                            <span className="text-lg font-bold text-amber-500">{duplicates.length}</span>
                        </div>
                    </div>

                    <p className="mt-4 text-xs text-zinc-500 leading-relaxed">
                        These images have the same content (hash) as files already in your library.
                        Do you want to import them anyway, or skip them?
                    </p>
                </div>

                {/* Actions */}
                <div className="p-6 pt-2 flex flex-col gap-2">
                    <div className="flex gap-2">
                        <button
                            onClick={() => onResolve('keep')}
                            className="flex-1 py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                            Import Duplicates
                        </button>
                        <button
                            onClick={() => onResolve('skip')}
                            className="flex-1 py-3 px-4 bg-accent hover:bg-accent-hover text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-lg shadow-accent/20 transition-colors"
                        >
                            Skip Duplicates
                        </button>
                    </div>
                    <button
                        onClick={onCancel}
                        className="w-full py-2.5 text-zinc-600 hover:text-zinc-400 text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                        Cancel Import
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DuplicateConflictModal;
