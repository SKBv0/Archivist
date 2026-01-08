import { useState, useCallback, useRef } from 'react';
import { HistoryAction } from '../../types';

interface UseHistoryReturn {
    history: HistoryAction[];
    setHistory: React.Dispatch<React.SetStateAction<HistoryAction[]>>;
    future: HistoryAction[];
    setFuture: React.Dispatch<React.SetStateAction<HistoryAction[]>>;
    pushHistory: (action: HistoryAction) => void;
    canUndo: boolean;
    canRedo: boolean;
    undoRef: React.MutableRefObject<(() => Promise<void>) | undefined>;
    redoRef: React.MutableRefObject<(() => Promise<void>) | undefined>;
}


export function useHistory(): UseHistoryReturn {
    const [history, setHistory] = useState<HistoryAction[]>([]);
    const [future, setFuture] = useState<HistoryAction[]>([]);


    const undoRef = useRef<() => Promise<void>>();
    const redoRef = useRef<() => Promise<void>>();

    const pushHistory = useCallback((action: HistoryAction) => {
        setHistory(prev => [...prev, action]);
        setFuture([]);
    }, []);

    return {
        history,
        setHistory,
        future,
        setFuture,
        pushHistory,
        canUndo: history.length > 0,
        canRedo: future.length > 0,
        undoRef,
        redoRef
    };
}
