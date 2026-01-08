import React, { useState, DragEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Upload, ChevronRight, Loader2 } from 'lucide-react';
import { useApp } from '../hooks/useApp';

interface GlobalDragDropProps {
  children: React.ReactNode;
}

const GlobalDragDrop: React.FC<GlobalDragDropProps> = ({ children }) => {
  const { uploadFiles, sources = [], addToast } = useApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [targetVaultId, setTargetVaultId] = useState('internal');
  const [pendingFiles, setPendingFiles] = useState<FileList | null>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [isDropped, setIsDropped] = useState(false);
  const [, setDragCounter] = useState(0);

  const isQuickSaveActive = location.pathname === '/quick-save';

  const resetDragState = () => {
    setIsDragging(false);
    setIsDropped(false);
    setPendingFiles(null);
    setDragCounter(0);
  };

  const handleDragEnter = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragCounter((prev) => prev + 1);

    if (e.dataTransfer.items?.length > 0) {
      // Determine if drag originates from internal gallery
      // Internal drags use application/text types rather than File objects
      const hasFiles = Array.from(e.dataTransfer.items).some(item => item.kind === 'file');

      if (hasFiles && window.electronAPI?.getPathForFile) {
        // For file drags, check if files are from existing vaults
        try {
          const items = Array.from(e.dataTransfer.items);
          const fileItems = items.filter(item => item.kind === 'file');

          if (fileItems.length > 0) {
            setIsDragging(true);
          }
        } catch {
          setIsDragging(true);
        }
      } else {
        // Default to external import UI for unidentifiable drag sources
        setIsDragging(true);
      }
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isDropped) return;

    setDragCounter((prev) => {
      const newVal = prev - 1;
      if (newVal <= 0) setIsDragging(false);
      return Math.max(0, newVal);
    });
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    setDragCounter(0);
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    // Get file paths (async)
    const filePaths = await Promise.all(
      Array.from(files).map(async f =>
        window.electronAPI?.getPathForFile ? await window.electronAPI.getPathForFile(f) : (f as any).path
      )
    ).then(paths => paths.filter(Boolean));

    // Security check: Whitelist the paths of dropped files
    if (window.electronAPI?.addToAllowedPaths && filePaths.length > 0) {
      await window.electronAPI.addToAllowedPaths(filePaths);
    }

    const file = files[0];
    const isSingleImage = files.length === 1 && file.type.startsWith('image/');

    if (isSingleImage) {
      setIsDropped(true);
      const path = filePaths[0];

      // Initializing transfer
      const reader = new FileReader();
      reader.onload = (ev) => {
        const src = ev.target?.result as string;

        // Artificial delay to preserve visual feedback of drop event
        setTimeout(() => {
          navigate('/quick-save', {
            state: {
              importedFile: { src, name: file.name, path },
              fromDrop: true,
              backgroundLocation: location
            }
          });

          setTimeout(() => setIsDropped(false), 500);
        }, 600);
      };
      reader.readAsDataURL(file);
    } else {
      setIsDropped(true);
      setPendingFiles(files);
    }
  };

  const handleBatchUpload = async () => {
    if (!pendingFiles) return;
    setIsProcessingBatch(true);
    try {
      await uploadFiles(pendingFiles, targetVaultId);
      addToast('success', `${pendingFiles.length} files imported successfully`);
    } catch (err) {
      console.error('Batch upload error:', err);
    } finally {
      setIsProcessingBatch(false);
      resetDragState();
    }
  };

  const cancelBatchUpload = () => {
    resetDragState();
  };

  return (
    <div
      className="relative w-full h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      <div
        className={`
            fixed inset-0 z-[100] bg-black/40 backdrop-blur-xl flex items-center justify-center 
            pointer-events-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]
            ${isQuickSaveActive ? 'hidden' : ''}
            ${(isDragging || isDropped) ? 'opacity-100 visible' : 'opacity-0 invisible'}
        `}
      >
        <div className={`
              w-[320px] bg-[#1a1a1c]/80 backdrop-blur-2xl border border-white/10 rounded-[32px] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] overflow-hidden relative
              transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)
              ${(isDragging || isDropped) ? 'scale-100 opacity-100' : 'scale-90 opacity-0 translate-y-8'}
          `}>

          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-3xl bg-accent flex items-center justify-center shadow-[0_20px_40px_-8px_hsla(var(--accent-hsl),0.4)] mb-6 animate-bounce-subtle">
              <Upload size={28} className="text-white" />
            </div>

            {pendingFiles ? (
              <div className="w-full animate-fade-in pointer-events-auto">
                <h3 className="text-sm font-bold text-white tracking-tight mb-1">Target Vault</h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-[0.2em] mb-6">{pendingFiles.length} Selections</p>

                <div className="space-y-2 mb-8 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {sources.map(s => (
                    <button
                      key={s.id}
                      onClick={() => setTargetVaultId(s.id)}
                      className={`
                          w-full px-4 py-3 rounded-2xl border transition-all duration-300 flex items-center justify-between group
                          ${targetVaultId === s.id
                          ? 'bg-white border-white text-black shadow-lg'
                          : 'bg-white/5 border-white/5 text-zinc-400 hover:bg-white/10'}
                        `}
                    >
                      <span className="text-xs font-bold tracking-tight">{s.name}</span>
                      {targetVaultId === s.id && <ChevronRight size={14} />}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  <button
                    onClick={handleBatchUpload}
                    disabled={isProcessingBatch}
                    className="w-full py-4 bg-accent hover:opacity-90 disabled:opacity-50 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    {isProcessingBatch ? <Loader2 size={16} className="animate-spin" /> : 'Confirm Import'}
                  </button>
                  <button
                    onClick={cancelBatchUpload}
                    className="w-full py-3 text-zinc-600 hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : isDropped ? (
              <div className="animate-pulse">
                <h3 className="text-lg font-light text-white tracking-tight mb-2">Importing...</h3>
                <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">Preparing your image for Quick Save.</p>
              </div>
            ) : (
              <div className="animate-pulse">
                <h3 className="text-lg font-light text-white tracking-tight mb-2">Release to Import</h3>
                <p className="text-xs text-zinc-500 max-w-[200px] leading-relaxed">Your files will be processed and added to the library.</p>
              </div>
            )}
          </div>

          {isProcessingBatch && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-md z-50 flex items-center justify-center animate-fade-in">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin"></div>
                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Hashing...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GlobalDragDrop;