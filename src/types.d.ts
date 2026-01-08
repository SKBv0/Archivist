import 'react';
import { FileMetadata, AIImage } from './types';


type ImageMetadata = Partial<AIImage>;
type ExportItem = AIImage & { blobData?: string };

declare module 'react' {
    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
        webkitdirectory?: string | boolean;
        directory?: string;
    }
}

interface ElectronAPI {
    platform: string;
    getPathForFile: (file: File) => string;
    selectFolder: () => Promise<{ folderPath: string; images: { name: string; fullPath: string; size: number; date: string }[] } | null>;
    scanDirectory: (path: string) => Promise<{ folderPath: string; images: { name: string; fullPath: string; size: number; date: string }[] } | null>;
    writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
    readMetadata: (filePath: string) => Promise<{ success: boolean; data?: FileMetadata; error?: string }>;
    writeMetadata: (filePath: string, metadata: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
    watchFolder: (folderPath: string) => Promise<void>;
    unwatchFolder: (folderPath: string) => Promise<void>;
    readImage: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    readFile: (filePath: string) => Promise<string | null>;
    calculateHash: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
    exportDataset: (data: { items: ExportItem[], exportOptions: { includeImage?: boolean, includeTxt?: boolean, includeJson?: boolean } }) => Promise<{ success: boolean; count?: number; path?: string }>;


    copyToVault: (data: { sourcePath: string; vaultPath: string; vaultName: string; filename: string; metadata?: ImageMetadata }) => Promise<{ success: boolean; targetPath?: string; targetFilename?: string; error?: string }>;
    saveBlobToVault: (data: { vaultPath: string; vaultName: string; filename: string; buffer: ArrayBuffer; metadata?: ImageMetadata }) => Promise<{ success: boolean; targetPath?: string; targetFilename?: string; error?: string }>;
    getDefaultVaultPath: () => Promise<string>;
    renameFile: (oldPath: string, newPath: string) => Promise<{ success: boolean; finalPath?: string; error?: string }>;
    getFsPath: (fileUrl: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    getUniquePath: (directory: string, filename: string) => Promise<string>;
    trashFile: (filePath: string) => Promise<{ success: boolean; error?: string }>;
    backupFile: (path: string) => Promise<{ success: boolean; backupPath?: string; backupBase?: string; error?: string }>;
    restoreFile: (args: { backupPath: string; targetPath: string; backupBase?: string }) => Promise<{ success: boolean; error?: string }>;
    mkdir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    checkFileExists: (filePath: string) => Promise<boolean>;


    addToAllowedPaths: (paths: string[]) => Promise<void>;
    clearVault: () => Promise<{ success: boolean; error?: string }>;

    onFileEvent: (callback: (data: { type: 'add' | 'remove', path: string, folder: string }) => void) => void;
    offFileEvent: () => void;
}

declare global {
    interface Window {
        electronAPI?: ElectronAPI;
    }
}

export { };
