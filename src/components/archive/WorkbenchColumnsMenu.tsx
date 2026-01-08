import { FC } from 'react';
import { Columns, Check } from 'lucide-react';
import { GeneralSettings } from '../../types';

interface WorkbenchColumnsMenuProps {
    isOpen: boolean;
    setIsOpen: (val: boolean) => void;
    currentColumns: string[];
    updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
}

const COLUMNS = [
    { id: 'title', label: 'Title' },
    { id: 'model', label: 'Model' },
    { id: 'vault', label: 'Vault' },
    { id: 'sampler', label: 'Sampler' },
    { id: 'cfg', label: 'CFG' },
    { id: 'steps', label: 'Steps' },
    { id: 'dimensions', label: 'Dimensions' },
    { id: 'prompt', label: 'Prompt' },
    { id: 'tokens', label: 'Tokens' }
];

const WorkbenchColumnsMenu: FC<WorkbenchColumnsMenuProps> = ({
    isOpen, setIsOpen, currentColumns, updateGeneralSettings
}) => {
    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${isOpen ? 'bg-accent/10 text-accent border-accent/20' : 'bg-transparent text-zinc-600 border-white/5 hover:border-white/20 hover:text-zinc-400'}`}
            >
                <Columns size={12} />
                Columns
            </button>

            {isOpen && (
                <div className="absolute top-full mt-2 left-0 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-1.5 z-50 flex flex-col min-w-[140px] animate-fade-in ring-1 ring-white/5">
                    {COLUMNS.map(col => {
                        const isVisible = currentColumns.includes(col.id);
                        return (
                            <button
                                key={col.id}
                                onClick={() => {
                                    const next = isVisible
                                        ? currentColumns.filter(c => c !== col.id)
                                        : [...currentColumns, col.id];
                                    updateGeneralSettings({ workbenchColumns: next });
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-[11px] font-bold transition-all ${isVisible ? 'bg-accent/10 text-accent' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}
                            >
                                {col.label}
                                {isVisible && <Check size={12} />}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default WorkbenchColumnsMenu;
