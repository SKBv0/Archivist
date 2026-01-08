import { FC, ElementType, useState, useEffect } from 'react';
import { Search, AlignLeft } from 'lucide-react';
import { toMediaUrl } from '../utils';

interface SearchBarProps {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  className?: string;
}
export const SearchBar: FC<SearchBarProps> = ({ value, onChange, placeholder = "Search...", className = "" }) => (
  <label className={`relative group ${className}`}>
    <span className="sr-only">Search images</span>
    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
    <input
      type="text"
      value={value}
      autoComplete="off"
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-zinc-900/40 border border-white/5 rounded-xl pl-9 pr-4 py-1.5 text-xs text-zinc-200 outline-none focus:border-accent/40 transition-all duration-300 placeholder:text-zinc-600 focus:bg-zinc-900 ring-1 ring-transparent focus:ring-accent/10"
    />
  </label>
);
export const SegmentedControl = <T extends string>({ options, value, onChange, size = 'md' }: { options: { value: T, label: string, icon?: ElementType }[], value: T, onChange: (val: T) => void, size?: 'sm' | 'md' }) => (
  <div className="flex bg-black/20 p-1 rounded-lg border border-white/5">
    {options.map((opt) => {
      const isActive = value === opt.value;
      const Icon = opt.icon;
      return (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`
                        flex items-center gap-2 rounded-lg font-bold uppercase tracking-widest transition-all
                        ${size === 'sm' ? 'px-2 py-1 text-[9px]' : 'px-3 py-1.5 text-[10px]'}
                        ${isActive
              ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10'
              : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5 border border-transparent'
            }
                    `}
        >
          {Icon && <Icon size={size === 'sm' ? 12 : 14} />}
          {opt.label}
        </button>
      );
    })}
  </div>
);

export const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={`w-9 h-5 rounded-full relative transition-all duration-300 border ${checked ? 'bg-accent border-accent/20' : 'bg-zinc-900 border-white/10'}`}
  >
    <div className={`absolute top-0.5 bottom-0.5 w-3.5 bg-white rounded-full shadow-lg transition-all duration-300 ${checked ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

interface BlobImageProps {
  image: { src?: string; blob?: Blob; title?: string };
  className?: string;
  alt?: string;
  placeholder?: boolean;
  onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
}

export const BlobImage = ({
  image,
  className,
  alt,
  placeholder = true,
  onLoad
}: BlobImageProps) => {
  const [src, setSrc] = useState('');

  useEffect(() => {
    let currentBlobUrl: string | null = null;

    if (image.blob && image.blob instanceof Blob) {
      try {
        const url = URL.createObjectURL(image.blob);
        currentBlobUrl = url;
        setSrc(url);
      } catch (e) {
        console.error("Failed to create object URL from blob:", e);
        // Fallback to src if blob fails
        if (image.src) setSrc(image.src);
      }
    } else if (image.src) {
      const isElectron = !!(window as any).electronAPI;
      const isAbsolutePath = image.src.includes(':/') || image.src.includes(':\\') || image.src.startsWith('/');


      const isBrowserUrl = image.src.startsWith('blob:') || image.src.startsWith('data:');
      const isProtocolPath = image.src.startsWith('file://') || image.src.startsWith('media://') || image.src.startsWith('http');

      if (isBrowserUrl) {

        setSrc(image.src);
      } else if (isElectron && isAbsolutePath && !isProtocolPath) {
        setSrc(toMediaUrl(image.src));
      } else if (image.src.startsWith('file://')) {
        setSrc(toMediaUrl(image.src));
      } else {
        setSrc(image.src);
      }
    } else {
      setSrc('');
    }

    // Delayed cleanup for React Strict Mode stability
    return () => {
      if (currentBlobUrl) {
        const urlToRevoke = currentBlobUrl;
        setTimeout(() => URL.revokeObjectURL(urlToRevoke), 1000);
      }
    };
  }, [image.blob, image.src]);

  if (!src && placeholder) {
    if (image.src?.toLowerCase().endsWith('.txt')) {
      return (
        <div className={`${className} bg-zinc-900 flex flex-col items-center justify-center p-4 border border-white/5 gap-2`}>
          <div className="w-8 h-10 bg-zinc-800 rounded border border-white/10 flex items-center justify-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-3 h-3 bg-zinc-700 rounded-bl-sm border-l border-b border-black/50" />
            <span className="text-[8px] font-black text-zinc-500 uppercase mt-2">TXT</span>
          </div>
          <span className="text-[9px] text-zinc-500 truncate w-full text-center px-2">{image.title || 'Text File'}</span>
        </div>
      );
    }
    return (
      <div className={`${className} bg-zinc-800 flex items-center justify-center text-zinc-600 text-xs text-center p-2`}>
        {image.title || 'No image'}
      </div>
    );
  }

  if (!src) return null;

  if (image.src?.toLowerCase().endsWith('.txt')) {
    return (
      <div className={`${className} bg-zinc-900 flex flex-col items-center justify-center p-4 border border-white/5 gap-3 group-hover:bg-zinc-800 transition-colors`}>
        <div className="w-10 h-12 bg-zinc-800 rounded-md border border-white/10 flex items-center justify-center relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-4 h-4 bg-zinc-600 rounded-bl-md border-l border-b border-black/40" />
          <AlignLeft size={16} className="text-zinc-500 mt-2" />
        </div>
        <div className="flex flex-col items-center gap-1 w-full">
          <span className="text-[10px] font-bold text-zinc-300 truncate w-full text-center">{image.title}</span>
          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Text Document</span>
        </div>
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} loading="lazy" onLoad={onLoad} />;
};
