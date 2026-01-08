import { FC } from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';

interface EmptyStateProps {
    type: 'empty-library' | 'no-results';
    onAction?: () => void;
    onClearFilters?: () => void;
}

const EmptyState: FC<EmptyStateProps> = ({ type, onAction, onClearFilters }) => {
    if (type === 'empty-library') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 mesh-bg">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-accent/5 rounded-full blur-[120px] pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center text-center animate-fade-in">
                    <div className="w-20 h-20 rounded-[24px] bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-700 mb-6 shadow-2xl">
                        <FolderOpen size={32} />
                    </div>
                    <h2 className="text-xl font-light text-white tracking-tighter mb-2">No images linked yet</h2>
                    <p className="text-zinc-500 text-sm max-w-[280px] mb-8 leading-relaxed">Your library is currently empty. Connect a local folder to get started with your AI archive.</p>
                    <button onClick={onAction} className="flex items-center gap-2 px-6 py-3 bg-white text-black text-xs font-black uppercase tracking-widest rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-white/5">
                        <Plus size={16} />
                        Link Local Folder
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
            <div className="w-16 h-16 rounded-3xl bg-zinc-900/50 flex items-center justify-center text-zinc-700 mb-4">
                <X size={24} />
            </div>
            <h3 className="text-zinc-300 font-bold uppercase tracking-widest text-[10px]">No matches found</h3>
            <p className="text-zinc-600 text-[10px] mt-1">Try adjusting your filters or search query</p>
            {onClearFilters && (
                <button onClick={onClearFilters} className="mt-4 text-accent text-[9px] font-black uppercase tracking-widest hover:underline">Clear Filter</button>
            )}
        </div>
    );
};

export default EmptyState;
