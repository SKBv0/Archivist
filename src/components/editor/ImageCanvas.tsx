import { FC, useState } from 'react';
import { ImageIcon, FolderOpen } from 'lucide-react';
import { AIImage, GeneralSettings, LibrarySource } from '../../types';
import { BlobImage } from '../Common';
import { DEFAULTS } from '../../constants';

interface ImageCanvasProps {
    image: AIImage;
    generalSettings?: GeneralSettings;
    updateImage: (id: string, updates: Partial<AIImage>) => void;
    sources: LibrarySource[];
}

const ImageCanvas: FC<ImageCanvasProps> = ({ image, generalSettings, updateImage, sources }) => {
    const [realDimensions, setRealDimensions] = useState<{ width: number; height: number } | null>(null);


    const sourceName = sources.find(s => s.id === image.sourceId)?.name || DEFAULTS.VAULT_NAME;

    const rawAccent = generalSettings?.themeAccent;
    const accentColor = rawAccent ? `hsl(${rawAccent})` : '#A855F7';

    const primaryColor = accentColor;
    const secondaryColor = accentColor;


    const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const img = e.currentTarget;
        const width = img.naturalWidth;
        const height = img.naturalHeight;

        if (width > 0 && height > 0) {
            setRealDimensions({ width, height });


            if (image.width === 0 || image.height === 0) {
                updateImage(image.id, { width, height });
            }
        }
    };


    const displayWidth = realDimensions?.width || image.width || 0;
    const displayHeight = realDimensions?.height || image.height || 0;

    return (
        <div className="flex-1 overflow-hidden relative flex items-center justify-center select-none bg-[#09090b]">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div
                    className="absolute -top-[60%] -left-[60%] w-[220%] h-[220%] opacity-30 blur-[120px] animate-[spin_40s_linear_infinite]"
                    style={{
                        background: `conic-gradient(from 0deg, transparent 0deg, ${primaryColor} 140deg, transparent 240deg)`
                    }}
                />

                <div
                    className="absolute -bottom-[60%] -right-[60%] w-[220%] h-[220%] opacity-20 blur-[100px] animate-[spin_50s_linear_infinite_reverse]"
                    style={{
                        background: `conic-gradient(from 180deg, transparent 0deg, ${secondaryColor} 160deg, transparent 300deg)`
                    }}
                />
            </div>

            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_100%)] opacity-80" />

            <div className="absolute inset-0 pointer-events-none opacity-[0.04] mix-blend-overlay"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}
            />

            <div className="relative group max-w-full max-h-full p-8 z-10 flex items-center justify-center">
                <BlobImage
                    image={image}
                    className="max-w-full max-h-[80vh] w-auto h-auto object-contain shadow-2xl rounded border border-white/10"
                    alt={image.title}
                    placeholder={false}
                    onLoad={handleImageLoad}
                />

                <div className="absolute bottom-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-mono font-bold text-zinc-300 flex items-center gap-1 border border-white/10 shadow-lg">
                        <ImageIcon size={10} /> {displayWidth} x {displayHeight}
                    </span>
                    <span className="px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-mono font-bold text-zinc-300 flex items-center gap-1 border border-white/10 shadow-lg">
                        <FolderOpen size={10} /> {sourceName}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default ImageCanvas;

