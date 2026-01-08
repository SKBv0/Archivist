import { useState, useEffect } from 'react';
import * as SyncEngine from '../services/SyncEngine';

interface SyncDebugPanelProps {
    isVisible: boolean;
    onClose: () => void;
}

export function SyncDebugPanel({ isVisible, onClose }: SyncDebugPanelProps) {
    const [logs, setLogs] = useState<SyncEngine.SyncLogEntry[]>([]);
    const [autoRefresh, setAutoRefresh] = useState(true);

    useEffect(() => {
        if (!isVisible) return;

        const refresh = () => {
            setLogs(SyncEngine.getSyncLog());
        };

        refresh();

        if (autoRefresh) {
            const interval = setInterval(refresh, 1000);
            return () => clearInterval(interval);
        }
    }, [isVisible, autoRefresh]);

    if (!isVisible) return null;

    const getResultColor = (result: string) => {
        switch (result) {
            case 'ok': return '#4ade80';
            case 'error': return '#f87171';
            case 'skipped': return '#fbbf24';
            default: return '#94a3b8';
        }
    };

    return (
        <div style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '300px',
            background: 'rgba(0, 0, 0, 0.95)',
            borderTop: '1px solid #333',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'monospace',
            fontSize: '12px'
        }}>
            {/* Header */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 12px',
                borderBottom: '1px solid #333',
                background: '#111'
            }}>
                <span style={{ color: '#fff', fontWeight: 'bold' }}>
                    🔄 Sync Debug Panel ({logs.length} entries)
                </span>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label style={{ color: '#888', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            type="checkbox"
                            checked={autoRefresh}
                            onChange={(e) => setAutoRefresh(e.target.checked)}
                        />
                        Auto-refresh
                    </label>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#333',
                            border: 'none',
                            color: '#fff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Log entries */}
            <div style={{
                flex: 1,
                overflow: 'auto',
                padding: '8px'
            }}>
                {logs.length === 0 ? (
                    <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                        No sync events yet. Try editing an image.
                    </div>
                ) : (
                    logs.slice().reverse().map((entry, i) => (
                        <div
                            key={i}
                            style={{
                                display: 'grid',
                                gridTemplateColumns: '140px 100px 80px 1fr',
                                gap: '8px',
                                padding: '4px 0',
                                borderBottom: '1px solid #222',
                                color: '#ccc'
                            }}
                        >
                            <span style={{ color: '#666' }}>
                                {new Date(entry.ts).toLocaleTimeString()}
                            </span>
                            <span style={{ color: '#60a5fa' }}>
                                {entry.op}
                            </span>
                            <span style={{ color: getResultColor(entry.result) }}>
                                {entry.result}
                            </span>
                            <span style={{ color: '#888', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {entry.id && <span style={{ color: '#a78bfa' }}>[{entry.id.slice(0, 8)}]</span>}
                                {' '}
                                {entry.path && entry.path.split(/[\\/]/).pop()}
                                {entry.reason && <span style={{ color: '#f472b6' }}> ({entry.reason})</span>}
                                {entry.ms && <span style={{ color: '#4ade80' }}> {entry.ms}ms</span>}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
