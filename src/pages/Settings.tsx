import { FC, ReactNode, ElementType } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft, HardDrive,
    Sparkles, FileJson, Trash2, Sliders,
    Monitor, Keyboard, Database, Server, Key,
    LayoutTemplate, Download, Columns, Rows, Cpu, Zap, Palette, FolderSync
} from 'lucide-react';
import { useApp } from '../hooks/useApp';
import { THEME_PRESETS } from '../constants';
import { SegmentedControl, Toggle } from '../components/Common';

const SettingsSection: FC<{ title: string; children: ReactNode }> = ({ title, children }) => (
    <div className="mb-8 animate-fade-in">
        <h3 className="px-4 text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">{title}</h3>
        <div className="bg-surface border border-white/5 rounded-xl divide-y divide-white/5 overflow-hidden shadow-sm">
            {children}
        </div>
    </div>
);

const SettingsItem = ({
    icon: Icon,
    label,
    description,
    value,
    children,
    onClick
}: {
    icon: ElementType,
    label: string,
    description?: string,
    value?: string,
    children?: ReactNode,
    onClick?: () => void
}) => {
    const Container = onClick ? 'button' : 'div';
    return (
        <Container
            onClick={onClick}
            type={onClick ? "button" : undefined}
            className={`
            w-full px-5 py-4 flex items-center justify-between group text-left
            ${onClick ? 'cursor-pointer hover:bg-white/[0.02] focus:outline-none focus:bg-white/[0.05]' : ''}
        `}
        >
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400 group-hover:text-zinc-200 group-hover:border-white/10 transition-all">
                    <Icon size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-sm text-zinc-200 font-medium">{label}</span>
                    {description && <span className="text-[10px] text-zinc-500">{description}</span>}
                    {value && <span className="text-[11px] text-zinc-500">{value}</span>}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {children}
            </div>
        </Container>
    );
};

const InputRow = ({ value, onChange, placeholder, type = "text", disabled = false }: { value: string, onChange: (v: string) => void, placeholder?: string, type?: string, disabled?: boolean }) => (
    <label className="flex items-center gap-2">
        <span className="sr-only">{placeholder || "Setting input"}</span>
        <input
            type={type}
            value={value}
            autoComplete={type === 'password' ? 'current-password' : 'off'}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className={`bg-transparent text-sm text-zinc-200 text-right focus:outline-none placeholder:text-zinc-700 w-64 border-b border-transparent focus:border-zinc-700 transition-colors pb-1 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
    </label>
);

const Settings = () => {
    const navigate = useNavigate();
    const {
        images,
        aiSettings, updateAISettings,
        generalSettings, updateGeneralSettings,
        factoryReset
    } = useApp();

    const handleExport = () => {
        const dataStr = JSON.stringify(images, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', `ai-archivist-backup-${new Date().toISOString().slice(0, 10)}.json`);
        linkElement.click();
    };

    const handleClearCache = async () => {
        if (window.confirm("Are you sure? This will delete ALL images and reset settings. This action cannot be undone.")) {
            await factoryReset();
        }
    };

    const isElectron = !!window.electronAPI;
    const platform = window.electronAPI?.platform;

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 bg-background relative border-t border-white/5 overflow-hidden">
                <div className={`shrink-0 bg-surface border-b border-white/5 px-4 h-14 flex items-center justify-between ${isElectron && platform !== 'darwin' ? 'pr-[115px]' : ''}`}>
                    <div className="flex items-center gap-3">
                        <button onClick={() => navigate('/')} className="p-1.5 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
                            <ArrowLeft size={18} />
                        </button>
                        <h1 className="text-sm font-bold tracking-tight">Settings</h1>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <form onSubmit={(e) => e.preventDefault()} className="max-w-3xl mx-auto w-full px-4 py-8 space-y-2">
                        <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden="true" />

                        <SettingsSection title="Intelligence">
                            <SettingsItem icon={Sparkles} label="AI Provider">
                                <SegmentedControl
                                    value={aiSettings.provider}
                                    onChange={(v) => updateAISettings({ provider: v as any })}
                                    options={[
                                        { value: 'google', label: 'Gemini', icon: Cpu },
                                        { value: 'openai_compatible', label: 'OpenAI / OpenRouter', icon: Server },
                                        { value: 'ollama', label: 'Ollama', icon: Monitor }, // Used Monitor icon for local
                                        { value: 'fal', label: 'Fal.ai', icon: Zap }
                                    ]}
                                />
                            </SettingsItem>

                            {aiSettings.provider === 'google' && (
                                <SettingsItem icon={Key} label="Gemini API Key">
                                    <InputRow type="password" value={aiSettings.apiKey} onChange={(v) => updateAISettings({ apiKey: v })} placeholder="AIza..." />
                                </SettingsItem>
                            )}

                            {aiSettings.provider === 'openai_compatible' && (
                                <>
                                    <SettingsItem icon={Server} label="Base URL">
                                        <div className="flex flex-col items-end gap-1">
                                            <InputRow value={aiSettings.baseUrl} onChange={(v) => updateAISettings({ baseUrl: v })} placeholder="https://api.openai.com/v1" />
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => updateAISettings({ baseUrl: 'https://api.openai.com/v1' })}
                                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    OpenAI
                                                </button>
                                                <button
                                                    onClick={() => updateAISettings({ baseUrl: 'https://openrouter.ai/api/v1' })}
                                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    OpenRouter
                                                </button>
                                                <button
                                                    onClick={() => updateAISettings({ baseUrl: 'http://localhost:1234/v1' })}
                                                    className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    LM Studio
                                                </button>
                                            </div>
                                        </div>
                                    </SettingsItem>
                                    <SettingsItem icon={Key} label="API Key">
                                        <InputRow type="password" value={aiSettings.apiKey} onChange={(v) => updateAISettings({ apiKey: v })} placeholder="sk-..." />
                                    </SettingsItem>
                                </>
                            )}

                            {aiSettings.provider === 'ollama' && (
                                <>
                                    <SettingsItem icon={Server} label="Ollama URL">
                                        <InputRow
                                            value={aiSettings.baseUrl || 'http://localhost:11434/v1'}
                                            onChange={(v) => updateAISettings({ baseUrl: v })}
                                            placeholder="http://localhost:11434/v1"
                                        />
                                    </SettingsItem>
                                    <SettingsItem icon={Database} label="Model Name">
                                        <InputRow
                                            value={aiSettings.captionModel}
                                            onChange={(v) => updateAISettings({ captionModel: v })}
                                            placeholder="llava"
                                        />
                                        <div className="text-[10px] text-zinc-600 mt-1 text-right">Must support vision (e.g. llava, moondream)</div>
                                    </SettingsItem>

                                </>
                            )}

                            {aiSettings.provider === 'fal' && (
                                <SettingsItem icon={Key} label="Fal.ai Key">
                                    <InputRow type="password" value={aiSettings.apiKey} onChange={(v) => updateAISettings({ apiKey: v })} placeholder="key-..." />
                                </SettingsItem>
                            )}

                            {aiSettings.provider !== 'ollama' && (
                                <SettingsItem icon={Database} label="Vision Model">
                                    <InputRow
                                        value={aiSettings.captionModel}
                                        onChange={(v) => updateAISettings({ captionModel: v })}
                                        placeholder={aiSettings.provider === 'fal' ? 'fal-ai/llava-next' : 'gemini-2.0-flash'}
                                    />
                                </SettingsItem>
                            )}
                            <div className="px-5 py-4">
                                <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs font-medium text-zinc-400 flex items-center gap-2">
                                        <Sliders size={14} /> System Instructions
                                    </span>
                                    <SegmentedControl
                                        value={aiSettings.activeCaptionStyle}
                                        onChange={(v) => updateAISettings({ activeCaptionStyle: v as any })}
                                        size="sm"
                                        options={[
                                            { value: 'stable_diffusion', label: 'SD Tags' },
                                            { value: 'natural_language', label: 'Natural' }
                                        ]}
                                    />
                                </div>
                                <textarea
                                    value={aiSettings.prompts[aiSettings.activeCaptionStyle]}
                                    onChange={(e) => {
                                        const newPrompts = { ...aiSettings.prompts, [aiSettings.activeCaptionStyle]: e.target.value };
                                        updateAISettings({ prompts: newPrompts });
                                    }}
                                    className="w-full h-32 bg-black/30 border border-white/5 rounded-lg p-4 text-[11px] font-mono text-zinc-400 focus:border-accent/50 focus:bg-black/50 outline-none resize-none transition-all leading-relaxed"
                                />
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Appearance">
                            <div className="px-5 py-4">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="p-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-400">
                                        <Palette size={18} />
                                    </div>
                                    <div>
                                        <span className="text-sm text-zinc-200 font-medium">Theme Presets</span>
                                        <p className="text-[11px] text-zinc-500">Instant visual styles</p>
                                    </div>
                                </div>


                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                    {THEME_PRESETS.map((preset) => {
                                        const isActive = generalSettings.gradientColors?.center === preset.center;
                                        return (
                                            <button
                                                key={preset.name}
                                                type="button"
                                                onClick={() => updateGeneralSettings({
                                                    themeAccent: preset.accent,
                                                    gradientColors: { left: preset.left, center: preset.center, right: preset.right }
                                                })}
                                                className={`group flex items-center gap-2 p-1.5 rounded-lg transition-all border ${isActive
                                                    ? 'bg-zinc-800 border-accent/50 ring-1 ring-accent/20'
                                                    : 'hover:bg-white/5 border-transparent hover:border-white/10'
                                                    }`}
                                            >
                                                <div
                                                    className="w-6 h-6 rounded-full shrink-0 shadow-sm"
                                                    style={{
                                                        background: `linear-gradient(135deg, hsla(${preset.left}, 1) 0%, hsla(${preset.center}, 1) 100%)`
                                                    }}
                                                />
                                                <span className={`text-[10px] font-medium truncate ${isActive ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`}>
                                                    {preset.name}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </SettingsSection>

                        <SettingsSection title="Preferences">
                            <SettingsItem icon={HardDrive} label="Local Vault Path" description="Electron-only: Images will be saved to this folder.">
                                <InputRow value={generalSettings.localVaultPath} onChange={(v) => updateGeneralSettings({ localVaultPath: v })} placeholder={isElectron ? "Select a folder..." : "Electron-only feature"} disabled={!isElectron} />
                            </SettingsItem>

                            <SettingsItem icon={LayoutTemplate} label="Quick Save Layout">
                                <SegmentedControl
                                    value={generalSettings.quickSaveLayout}
                                    onChange={(v) => updateGeneralSettings({ quickSaveLayout: v as any })}
                                    options={[
                                        { value: 'horizontal', label: 'Side-by-Side', icon: Columns },
                                        { value: 'vertical', label: 'Stacked', icon: Rows }
                                    ]}
                                />
                            </SettingsItem>

                            <SettingsItem icon={FolderSync} label="Rename Files in Linked Vaults" description="When title changes, also rename the file in external/linked vaults">
                                <Toggle checked={generalSettings.renameLinkedVaultFiles ?? false} onChange={(v) => updateGeneralSettings({ renameLinkedVaultFiles: v })} />
                            </SettingsItem>

                            <SettingsItem icon={Trash2} label="Delete Files in Linked Vaults" description="When deleting an image, also delete the actual file in external vaults">
                                <Toggle checked={generalSettings.deleteLinkedVaultFiles ?? false} onChange={(v) => updateGeneralSettings({ deleteLinkedVaultFiles: v })} />
                            </SettingsItem>
                        </SettingsSection>

                        <SettingsSection title="Data & Maintenance">
                            <SettingsItem icon={FileJson} label="Export Library" value={`${images.length} items`} onClick={handleExport}>
                                <Download size={16} className="text-zinc-500 group-hover:text-white transition-colors" />
                            </SettingsItem>

                            <SettingsItem icon={Trash2} label="Clear Library & Cache" onClick={handleClearCache}>
                                <div className="text-[10px] font-bold text-red-400 border border-red-500/20 bg-red-500/5 px-2 py-1 rounded-md uppercase tracking-wider group-hover:bg-red-500 group-hover:text-white transition-colors">Factory Reset</div>
                            </SettingsItem>
                        </SettingsSection>

                        <div className="pt-6 text-center">
                            <p className="text-[10px] text-zinc-600 font-mono">AI Archivist v1.0</p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Settings;