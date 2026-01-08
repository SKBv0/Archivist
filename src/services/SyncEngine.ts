

import { AIImage, AIImageDB } from '../types';
import { db } from '../db';
import { generateId, normalizePath, parseGenerationData, sanitizeFilename } from '../utils';
import { enrichImageMetadata, createBaseImage } from './imageService';
import { DEFAULTS } from '../constants';



export interface SyncPatch {
    title?: string;
    prompt?: string;
    negativePrompt?: string;
    tags?: string[];
    rating?: number;
    model?: string;
    sampler?: string;
    cfgScale?: number;
    steps?: number;
    seed?: number;
}

export interface FileEvent {
    type: 'add' | 'change' | 'unlink';
    path: string;
    size?: number;
    mtime?: number;
}

export interface SyncResult {
    success: boolean;
    id: string;
    src?: string;
    error?: string;
}

export interface SyncLogEntry {
    ts: number;
    op: string;
    id?: string;
    path?: string;
    result: 'ok' | 'error' | 'skipped';
    reason?: string;
    ms?: number;
}



interface ProcessedEvent {
    path: string;
    size: number;
    mtime: number;
    processedAt: number;
}

const processedEvents = new Map<string, ProcessedEvent>();
const EVENT_TTL_MS = 5000;


function shouldSkipEvent(event: FileEvent): boolean {
    const key = event.path.toLowerCase();
    const cached = processedEvents.get(key);

    if (!cached) return false;

    const now = Date.now();
    if (now - cached.processedAt > EVENT_TTL_MS) {
        processedEvents.delete(key);
        return false;
    }


    if (cached.size === event.size && cached.mtime === event.mtime) {
        return true;
    }

    return false;
}

function markEventProcessed(event: FileEvent): void {
    const key = event.path.toLowerCase();
    processedEvents.set(key, {
        path: event.path,
        size: event.size || 0,
        mtime: event.mtime || 0,
        processedAt: Date.now()
    });
}


setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of processedEvents.entries()) {
        if (now - entry.processedAt > EVENT_TTL_MS) {
            processedEvents.delete(key);
        }
    }
}, 10000);



const syncLocks = new Set<string>();

export function isLocked(id: string): boolean {
    return syncLocks.has(id);
}

export function lock(id: string): void {
    syncLocks.add(id);
}

export function unlock(id: string): void {
    syncLocks.delete(id);
}

async function withLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
    if (syncLocks.has(id)) {

        await new Promise(r => setTimeout(r, 500));
        if (syncLocks.has(id)) {
            throw new Error(`Lock timeout for ${id}`);
        }
    }

    syncLocks.add(id);
    try {
        return await fn();
    } finally {
        syncLocks.delete(id);
    }
}



const syncLog: SyncLogEntry[] = [];
const MAX_LOG_ENTRIES = 500;

function log(entry: Omit<SyncLogEntry, 'ts'>): void {
    const fullEntry: SyncLogEntry = { ts: Date.now(), ...entry };
    syncLog.push(fullEntry);
    if (syncLog.length > MAX_LOG_ENTRIES) {
        syncLog.shift();
    }

}


export function addLog(entry: Omit<SyncLogEntry, 'ts'>): void {
    log(entry);
}

export function getSyncLog(): SyncLogEntry[] {
    return [...syncLog];
}



export async function applyPatch(
    id: string,
    patch: SyncPatch,
    electronAPI: any,
    vaultPath: string
): Promise<SyncResult> {
    const startTime = Date.now();

    return withLock(id, async () => {
        try {
            const dbItem = await db.images.get(id);
            if (!dbItem) {
                log({ op: 'patch', id, result: 'error', reason: 'not_found' });
                return { success: false, id, error: 'Image not found' };
            }


            const merged: Partial<AIImageDB> = { ...patch };


            if (patch.title && patch.title !== dbItem.title && dbItem.src?.startsWith('file://')) {
                const renameResult = await renameImageFile(
                    id,
                    dbItem.src,
                    patch.title,
                    electronAPI
                );

                if (renameResult.success && renameResult.newSrc) {
                    merged.src = renameResult.newSrc;
                }
            }


            await db.images.update(id, merged);


            if (dbItem.src?.startsWith('file://') || merged.src?.startsWith('file://')) {
                const finalSrc = merged.src || dbItem.src;
                await writeSidecar(id, finalSrc!, { ...dbItem, ...merged }, electronAPI);
            }

            log({ op: 'patch', id, result: 'ok', ms: Date.now() - startTime });
            return { success: true, id, src: merged.src || dbItem.src };

        } catch (error) {
            const msg = error instanceof Error ? error.message : 'Unknown error';
            log({ op: 'patch', id, result: 'error', reason: msg });
            return { success: false, id, error: msg };
        }
    });
}



export async function saveNewImage(
    imageData: {
        title: string;
        prompt?: string;
        blob?: Blob;
        dataUrl?: string;
    },
    electronAPI: any,
    vaultPath: string,
    forcedId?: string
): Promise<SyncResult> {
    const startTime = Date.now();
    const id = forcedId || generateId();

    try {
        if (!vaultPath) {
            throw new Error('Vault path not configured');
        }

        const sep = electronAPI.platform === 'win32' ? '\\' : '/';
        const importedDir = normalizeVaultPath(vaultPath);



        await electronAPI.mkdir(importedDir);


        let buffer: ArrayBuffer | undefined;
        let mime = 'image/png';

        if (imageData.blob) {
            try {

                const blobAny = imageData.blob as any;
                if (typeof blobAny.arrayBuffer === 'function') {
                    buffer = await blobAny.arrayBuffer();
                } else if (blobAny instanceof ArrayBuffer) {
                    buffer = blobAny;
                } else if (blobAny instanceof Blob) {

                    buffer = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as ArrayBuffer);
                        reader.onerror = () => reject(new Error('Failed to read blob'));
                        reader.readAsArrayBuffer(blobAny);
                    });
                } else {

                    throw new Error('Invalid blob object');
                }
                mime = blobAny.type || mime;
            } catch (e) {

            }
        }

        if (!buffer && imageData.dataUrl) {
            const res = await fetch(imageData.dataUrl);
            buffer = await res.arrayBuffer();
            mime = res.headers.get('content-type') || mime;
        }

        if (!buffer) {
            throw new Error('No valid image data provided (blob failed and no dataUrl)');
        }

        const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
        const safeTitle = sanitizeFilename(imageData.title || id);


        const tempPath = `${importedDir}${sep}${id}.tmp`;
        const finalPath = await electronAPI.getUniquePath(importedDir, `${safeTitle}.${ext}`);


        const writeResult = await electronAPI.writeFile(tempPath, buffer as ArrayBuffer);
        if (!writeResult.success) {
            throw new Error(writeResult.error || 'Write failed');
        }


        const renameResult = await electronAPI.renameFile(tempPath, finalPath);
        if (!renameResult.success) {
            // Cleanup temp file
            try { await electronAPI.trashFile(tempPath); } catch { }
            throw new Error(renameResult.error || 'Rename failed');
        }

        const actualPath = renameResult.finalPath || finalPath;
        const src = `file://${actualPath.replace(/\\/g, '/')}`;

        let dbEntry: AIImageDB;

        if (forcedId) {

            const existingRecord = await db.images.get(id);

            if (existingRecord) {

                await db.images.update(id, {
                    src,
                    sourceId: 'internal',
                    blob: undefined
                });

                dbEntry = (await db.images.get(id))!;
            } else {


                dbEntry = createBaseImage({
                    id,
                    title: imageData.title || safeTitle,
                    prompt: imageData.prompt || '',
                    src,
                    sourceId: 'internal',
                    date: new Date().toISOString()
                });
                await db.images.add(dbEntry);
            }
        } else {

            dbEntry = createBaseImage({
                id,
                title: imageData.title || safeTitle,
                prompt: imageData.prompt || '',
                src,
                sourceId: 'internal',
                date: new Date().toISOString()
            });
            await db.images.add(dbEntry);
        }


        if (dbEntry) {
            await writeSidecar(id, src, dbEntry, electronAPI);
        } else {
            console.error(`[SyncEngine:saveNewImage] dbEntry is undefined after save, skipping sidecar`);
        }

        log({ op: 'save_new', id, path: actualPath, result: 'ok', ms: Date.now() - startTime });
        return { success: true, id, src };

    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        log({ op: 'save_new', id, result: 'error', reason: msg });
        return { success: false, id, error: msg };
    }
}



export async function onFileEvent(
    event: FileEvent,
    electronAPI: any,
    vaultPath: string
): Promise<void> {

    if (shouldSkipEvent(event)) {
        log({ op: 'watcher', path: event.path, result: 'skipped', reason: 'duplicate_event' });
        return;
    }

    markEventProcessed(event);

    const ext = event.path.split('.').pop()?.toLowerCase();
    const isImage = ext && ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext);
    const isSidecar = ext === 'json' || ext === 'txt';

    if (event.type === 'add') {
        if (isImage) {
            await handleNewFile(event.path, electronAPI, vaultPath);
        } else if (isSidecar) {
            await handleSidecarChange(event.path, electronAPI);
        }
    } else if (event.type === 'unlink') {
        if (isImage) {

        }
    }
}

async function handleNewFile(path: string, electronAPI: any, vaultPath: string): Promise<void> {
    const fileUrl = `file://${path.replace(/\\/g, '/')}`;


    const existingBySrc = await db.images.where('src').equals(fileUrl).first();
    if (existingBySrc) {
        log({ op: 'watcher_add', path, result: 'skipped', reason: 'already_tracked_by_src' });
        return;
    }


    const sidecarPath = path.replace(/\.[^.]+$/, '.json');
    try {
        const sidecarContent = await electronAPI.readFile(sidecarPath);
        if (sidecarContent) {
            const sidecar = JSON.parse(sidecarContent);
            if (sidecar.id) {

                const existingById = await db.images.get(sidecar.id);
                if (existingById) {

                    await db.images.update(sidecar.id, { src: fileUrl });
                    log({ op: 'watcher_add', path, id: sidecar.id, result: 'ok', reason: 'path_updated' });
                    return;
                }
            }
        }
    } catch { }


    try {
        const hashResult = await electronAPI.calculateHash(path);
        if (hashResult.success && hashResult.data) {
            const existingHash = await db.images.where('hash').equals(hashResult.data).first();
            if (existingHash) {
                log({ op: 'watcher_add', path, result: 'skipped', reason: 'duplicate_hash' });
                return;
            }
            // Assign hash to new image

        }
    } catch (e) {

    }


    const fileName = path.split(/[\\/]/).pop() || 'Untitled';
    const title = fileName.split('.')[0];


    let fileHash = '';
    try {
        const h = await electronAPI.calculateHash(path);
        if (h.success) fileHash = h.data;
    } catch { }

    if (fileHash) {
        const dup = await db.images.where('hash').equals(fileHash).first();
        if (dup) {
            log({ op: 'watcher_add', path, result: 'skipped', reason: 'duplicate_hash' });
            return;
        }
    }


    let sourceId: string | null = null;

    const normPath = path.replace(/\\/g, '/').toLowerCase();
    const normVault = vaultPath ? vaultPath.replace(/\\/g, '/').toLowerCase() : '';
    const normVaultWithSlash = normVault && (normVault.endsWith('/') ? normVault : normVault + '/');



    if (normVaultWithSlash && normPath.startsWith(normVaultWithSlash)) {
        sourceId = 'internal';
    } else {


        const sources = await db.sources.toArray();


        for (const s of sources) {
            if (s.path) {

                const normSourcePath = s.path.replace(/\\/g, '/').toLowerCase();


                if (normPath.startsWith(normSourcePath)) {
                    sourceId = s.id;

                    break;
                }
            }
        }
    }

    if (!sourceId) {
        console.warn(`[SyncEngine:handleNewFile] Could not determine source for path: ${path}. Skipping import to prevent data loss.`);
        log({ op: 'watcher_add', path, result: 'skipped', reason: 'unknown_source' });
        return;
    }



    const newImage = createBaseImage({
        src: fileUrl,
        title,
        sourceId,
        date: new Date().toISOString(),
        hash: fileHash
    });


    try {
        const { updates } = await enrichImageMetadata(newImage);
        Object.assign(newImage, updates);
    } catch { }

    await db.images.add(newImage);


    await writeSidecar(newImage.id, fileUrl, newImage, electronAPI);

    log({ op: 'watcher_add', path, id: newImage.id, result: 'ok', reason: 'imported' });
}

async function handleSidecarChange(path: string, electronAPI: any): Promise<void> {
    const ext = path.split('.').pop()?.toLowerCase();
    const basePath = path.replace(/\.[^.]+$/, '');


    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'];
    let targetImage: AIImageDB | undefined;

    for (const imgExt of imageExtensions) {
        const imgUrl = `file://${basePath}.${imgExt}`.replace(/\\/g, '/');
        targetImage = await db.images.where('src').equals(imgUrl).first();
        if (targetImage) break;
    }

    if (!targetImage) {
        log({ op: 'watcher_sidecar', path, result: 'skipped', reason: 'no_matching_image' });
        return;
    }

    try {
        const content = await electronAPI.readFile(path);
        if (!content) return;

        if (ext === 'txt') {
            await db.images.update(targetImage.id, { prompt: content });
        } else if (ext === 'json') {
            const sidecar = JSON.parse(content);

            const { id: _, src: __, ...safeUpdates } = sidecar;
            await db.images.update(targetImage.id, safeUpdates);
        }

        log({ op: 'watcher_sidecar', path, id: targetImage.id, result: 'ok' });
    } catch (e) {
        log({ op: 'watcher_sidecar', path, result: 'error', reason: String(e) });
    }
}

export async function reconcile(electronAPI: any, vaultPath: string): Promise<{
    updated: number;
    orphaned: number;
    imported: number;
}> {
    const startTime = Date.now();
    let updated = 0;
    let orphaned = 0;
    let imported = 0;

    if (!electronAPI || !vaultPath) {

        return { updated, orphaned, imported };
    }


    const dbImages = await db.images.where('src').startsWith('file://').toArray();


    for (const img of dbImages) {
        if (!img.src) continue;


        let fsPath = img.src.replace('file://', '');


        if (electronAPI.platform === 'win32') {

            fsPath = fsPath.replace(/\//g, '\\');

            if (fsPath.startsWith('\\') && fsPath[2] === ':') {
                fsPath = fsPath.substring(1);
            }
        }

        const exists = await electronAPI.checkFileExists(fsPath);

        if (!exists) {

            await db.images.delete(img.id);
            orphaned++;
            log({ op: 'reconcile', id: img.id, path: fsPath, result: 'ok', reason: 'orphan_removed' });
        }
    }


    log({ op: 'reconcile_complete', result: 'ok', ms: Date.now() - startTime });
    return { updated, orphaned, imported };
}



export async function deleteFileFromDisk(
    src: string,
    electronAPI: any,
    generalSettings: { localVaultPath: string; deleteLinkedVaultFiles: boolean },
    force: boolean = false
): Promise<{ success: boolean; backupPath?: string; backupBase?: string; skipped?: boolean }> {
    if (!electronAPI || !src || !src.startsWith('file://')) {
        return { success: false, skipped: true };
    }

    try {
        const pRes = await electronAPI.getFsPath(src);
        if (!pRes.success || !pRes.path) return { success: false, skipped: true };

        const safeFilePath = normalizePath(pRes.path).toLowerCase();
        const vaultPath = generalSettings.localVaultPath || '';
        const safeVaultPath = normalizePath(vaultPath).toLowerCase();

        const isPhysicallyInVault = safeVaultPath && safeFilePath.includes(safeVaultPath);
        const shouldPhysicalDelete = force || isPhysicallyInVault || (generalSettings.deleteLinkedVaultFiles ?? false);

        if (!shouldPhysicalDelete) {

            return { success: true, skipped: true };
        }

        const result: { success: boolean; backupPath?: string; backupBase?: string } = { success: true };


        if (electronAPI.backupFile) {
            const backupRes = await electronAPI.backupFile(pRes.path);
            if (backupRes.success) {
                result.backupPath = backupRes.backupPath;
                result.backupBase = backupRes.backupBase;
            }
        }


        await electronAPI.trashFile(pRes.path);


        const basePath = pRes.path.substring(0, pRes.path.lastIndexOf('.'));
        for (const ext of ['.txt', '.json']) {
            try { await electronAPI.trashFile(basePath + ext); } catch { }
        }

        return result;
    } catch (e) {
        console.error("[SyncEngine] Physical delete failed", e);
        return { success: false };
    }
}



function normalizeVaultPath(path: string): string {
    return path.replace(/\\/g, '/');
}

async function renameImageFile(
    id: string,
    currentSrc: string,
    newTitle: string,
    electronAPI: any
): Promise<{ success: boolean; newSrc?: string }> {
    try {
        const pathResult = await electronAPI.getFsPath(currentSrc);
        if (!pathResult.success || !pathResult.path) {
            return { success: false };
        }

        const currentPath = pathResult.path;
        const dir = currentPath.substring(0, currentPath.lastIndexOf(electronAPI.platform === 'win32' ? '\\' : '/'));
        const ext = currentPath.split('.').pop();
        const newFilename = sanitizeFilename(newTitle) + '.' + ext;
        const newPath = `${dir}${electronAPI.platform === 'win32' ? '\\' : '/'}${newFilename}`;

        if (currentPath.toLowerCase() === newPath.toLowerCase()) {
            return { success: true, newSrc: currentSrc };
        }

        const result = await electronAPI.renameFile(currentPath, newPath);
        if (result.success) {

            try {
                const oldBase = currentPath.substring(0, currentPath.lastIndexOf('.'));
                await Promise.all([
                    electronAPI.trashFile(oldBase + '.json').catch(() => { }),
                    electronAPI.trashFile(oldBase + '.txt').catch(() => { })
                ]);
            } catch { }

            const finalPath = result.finalPath || newPath;
            return { success: true, newSrc: `file://${finalPath.replace(/\\/g, '/')}` };
        }

        return { success: false };
    } catch {
        return { success: false };
    }
}

export async function writeSidecar(
    id: string,
    src: string,
    data: Partial<AIImageDB>,
    electronAPI: any
): Promise<void> {
    try {
        let basePath: string;


        if (src.startsWith('file://')) {
            const pathResult = await electronAPI.getFsPath(src);
            if (!pathResult.success || !pathResult.path) return;
            basePath = pathResult.path.replace(/\.[^.]+$/, '');
        } else {

            basePath = src.replace(/\.[^.]+$/, '');
        }


        const sidecar = {
            id,
            title: data.title,
            prompt: data.prompt,
            negativePrompt: data.negativePrompt,
            model: data.model,
            sampler: data.sampler,
            cfgScale: data.cfgScale,
            steps: data.steps,
            seed: data.seed,
            tags: data.tags,
            rating: data.rating
        };

        await electronAPI.writeFile(basePath + '.json', JSON.stringify(sidecar, null, 2));


        if (data.prompt) {
            await electronAPI.writeFile(basePath + '.txt', data.prompt);
        }
    } catch (e) {
        console.warn('[SyncEngine] Failed to write sidecar:', e);
    }
}
