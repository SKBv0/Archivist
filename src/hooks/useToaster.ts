import { useState, useCallback } from 'react';
import { Toast, ToastType } from '../components/Toaster';
import { generateId } from '../utils';

export const useToaster = () => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((type: ToastType, message: string, customDuration?: number) => {
        const id = generateId();
        setToasts(prev => [...prev, { id, type, message }]);

        // Error/warning toasts stay longer for readability
        const duration = customDuration ?? (type === 'error' || type === 'warning' ? 8000 : 4000);

        if (duration > 0) {
            setTimeout(() => {
                removeToast(id);
            }, duration);
        }
    }, [removeToast]);

    return { toasts, addToast, removeToast };
};
