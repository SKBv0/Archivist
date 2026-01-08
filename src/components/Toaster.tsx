import { FC, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToasterProps {
  toasts: Toast[];
  removeToast: (id: string) => void;
}

const Toaster: FC<ToasterProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem: FC<{ toast: Toast; onDismiss: () => void }> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const icons = {
    success: <CheckCircle size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-red-500" />,
    info: <Info size={18} className="text-blue-500" />,
    warning: <AlertTriangle size={18} className="text-amber-500" />,
  };

  const borders = {
    success: 'border-emerald-500/20',
    error: 'border-red-500/20',
    info: 'border-blue-500/20',
    warning: 'border-amber-500/20',
  };

  return (
    <div className={`
      pointer-events-auto flex items-center gap-3 px-4 py-3 bg-[#121214] border ${borders[toast.type]} 
      rounded-lg shadow-[0_8px_30px_rgb(0,0,0,0.4)] min-w-[300px] animate-slide-in-right backdrop-blur-md
    `}>
      {icons[toast.type]}
      <p className="flex-1 text-sm font-medium text-zinc-200">{toast.message}</p>
      <button onClick={onDismiss} className="text-zinc-500 hover:text-zinc-300 transition-colors">
        <X size={14} />
      </button>
    </div>
  );
};

export default Toaster;