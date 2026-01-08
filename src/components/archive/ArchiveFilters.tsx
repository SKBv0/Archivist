import { FC } from 'react';
import {
    Hash, Box, Layers, Activity, Cpu, Scale, Star, Palette
} from 'lucide-react';
import { FilterCategory } from '../../types';

interface ArchiveFiltersProps {
    showFilters: boolean;
    filterCategory: FilterCategory;
    setFilterCategory: (cat: FilterCategory) => void;
    activeFilter: string | null;
    setActiveFilter: (filter: string | null) => void;
    activeCategoryItems: [string, number][];
}

const ArchiveFilters: FC<ArchiveFiltersProps> = ({
    showFilters, filterCategory, setFilterCategory,
    activeFilter, setActiveFilter, activeCategoryItems
}) => {
    return (
        <div className={`w-full bg-surface/30 border-b border-white/5 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden flex flex-col shadow-inner shrink-0 ${showFilters ? 'max-h-80 opacity-100 pb-2' : 'max-h-0 opacity-0'}`}>
            <div className="h-10 flex items-center px-6 gap-2 border-b border-border bg-black/20 overflow-x-auto no-scrollbar">
                {(['tags', 'models', 'loras', 'samplers', 'steps', 'cfg', 'ratio', 'rating', 'colors'] as FilterCategory[]).map((cat) => (
                    <button key={cat} onClick={() => setFilterCategory(cat)} className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-3 py-1 rounded transition-colors whitespace-nowrap ${filterCategory === cat ? 'text-white bg-white/10 border border-white/10' : 'text-zinc-500 hover:text-zinc-300 border border-transparent'}`}>
                        {cat === 'tags' && <Hash size={12} />}
                        {cat === 'models' && <Box size={12} />}
                        {cat === 'loras' && <Box size={12} className="rotate-45" />}
                        {cat === 'samplers' && <Layers size={12} />}
                        {cat === 'steps' && <Activity size={12} />}
                        {cat === 'cfg' && <Cpu size={12} />}
                        {cat === 'ratio' && <Scale size={12} />}
                        {cat === 'rating' && <Star size={12} />}
                        {cat === 'colors' && <Palette size={12} />}
                        {cat}
                    </button>
                ))}
            </div>
            <div className="flex-1 flex flex-wrap content-start p-4 gap-2 overflow-y-auto custom-scrollbar">
                <button onClick={() => setActiveFilter(null)} className={`shrink-0 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${!activeFilter ? 'bg-white text-black border-white' : 'bg-transparent text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}>All Items</button>
                {activeCategoryItems.map(([item, count]) => {
                    const isColor = filterCategory === 'colors';
                    return (
                        <button key={item} onClick={() => setActiveFilter(item === activeFilter ? null : item)} className={`shrink-0 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[10px] font-bold transition-all border ${activeFilter === item ? 'bg-accent/10 text-accent border-accent/30 ring-1 ring-accent/20' : 'bg-zinc-900/40 text-zinc-500 border-white/5 hover:border-white/20 hover:text-zinc-300'}`}>
                            {isColor && <div className="w-2.5 h-2.5 rounded-full border border-white/10" style={{ backgroundColor: item }}></div>}
                            {isColor ? item.toUpperCase() : item}
                            <span className={`ml-1 text-[9px] px-1.5 rounded-full ${activeFilter === item ? 'bg-accent/20 text-accent' : 'bg-black/40 text-zinc-600'}`}>{count}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    );
};

export default ArchiveFilters;
