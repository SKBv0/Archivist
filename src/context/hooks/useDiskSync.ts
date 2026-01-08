import { useCallback } from 'react';
import { AIImage, AIImageDB, LibrarySource, GeneralSettings } from '../../types';
import { db } from '../../db';
import { ToastType } from '../../components/Toaster';
import { sanitizeFilename } from '../../utils';
import * as SyncEngine from '../../services/SyncEngine';

interface UseDiskSyncOptions {
    isElectron: boolean;
    generalSettings: GeneralSettings;
    sources: LibrarySource[];
    addToast: (type: ToastType, message: string) => void;
}

interface UseDiskSyncReturn {
    performDiskSync: (id: string, originalImage: AIImageDB) => Promise<AIImage | undefined>;
}

const toUI = (item: AIImageDB): AIImage => ({ ...item, src: item.src || '' } as AIImage);

async function handleRoundTrip(
    id: string,
    dbItem: AIImageDB,
    localPath: string,
    targetVaultPath: string,
    electronAPI: any
): Promise<{ handled: boolean; newDbItem?: AIImageDB }> {
    const origSrc = dbItem.originalSrc;
    if (!origSrc) return { handled: false };


    const pRes = await electronAPI.getFsPath(origSrc);
    if (!pRes.success || !pRes.path) return { handled: false };
    const origPath = pRes.path;


    const normOrig = origPath.replace(/\\/g, '/').toLowerCase();
    const normTarget = targetVaultPath.replace(/\\/g, '/').toLowerCase();

    // Ensure trailing slash for directory prefix matching
    const normTargetWithSlash = normTarget.endsWith('/') ? normTarget : normTarget + '/';
    const isRoundTrip = normOrig.startsWith(normTargetWithSlash);

    if (isRoundTrip) {
        const originalExists = await electronAPI.checkFileExists(origPath);

        if (originalExists) {
            await db.images.update(id, { src: origSrc, originalSrc: undefined });
            const newDbItem = (await db.images.get(id))!;

            await electronAPI.trashFile(localPath);
            const basePath = localPath.replace(/\.[^.]+$/, '');
            await electronAPI.trashFile(basePath + '.json').catch(() => { });
            await electronAPI.trashFile(basePath + '.txt').catch(() => { });

            return { handled: true, newDbItem };
        }
    }

    return { handled: false };
}

async function copyToExternalVault(
    id: string,
    dbItem: AIImageDB,
    localPath: string,
    targetVaultPath: string,
    electronAPI: any,
    addToast: (type: ToastType, message: string) => void
): Promise<AIImageDB | null> {
    const ext = localPath.split('.').pop() || 'png';
    const fileName = `${sanitizeFilename(dbItem.title).toLowerCase()}.${ext}`;

    try {
        const result = await electronAPI.copyToVault({
            vaultPath: targetVaultPath,
            vaultName: '',
            filename: fileName,
            sourcePath: localPath,
            metadata: { id: dbItem.id, title: dbItem.title, prompt: dbItem.prompt }
        });

        if (result.success && result.targetPath) {
            const newSrc = `file://${result.targetPath.replace(/\\/g, '/')}`;
            await db.images.update(id, { src: newSrc, originalSrc: undefined });
            const newDbItem = (await db.images.get(id))!;

            await electronAPI.trashFile(localPath);
            const basePath = localPath.replace(/\.[^.]+$/, '');
            await electronAPI.trashFile(basePath + '.json').catch(() => { });
            await electronAPI.trashFile(basePath + '.txt').catch(() => { });

            return newDbItem;
        } else {
            console.error(`[DiskSync:${id}] Copy to external failed:`, result.error);
            await db.images.update(id, { sourceId: 'internal' });
            addToast('error', 'Failed to copy to external vault');
            return null;
        }
    } catch (err) {
        console.error(`[DiskSync:${id}] Error copying to external:`, err);
        await db.images.update(id, { sourceId: 'internal' });
        addToast('error', 'Failed to copy to external vault');
        return null;
    }
}

async function copyToLocalVault(
    id: string,
    dbItem: AIImageDB,
    localVaultPath: string,
    safeOriginalSourceId: string,
    electronAPI: any
): Promise<AIImageDB | null> {
    const pRes = await electronAPI.getFsPath(dbItem.src || '');
    if (!pRes.success || !pRes.path) return null;

    const srcPath = pRes.path;
    const externalSrc = dbItem.src!;
    const ext = srcPath.split('.').pop() || 'png';
    const fileName = `${sanitizeFilename(dbItem.title).toLowerCase()}.${ext}`;

    try {
        const result = await electronAPI.copyToVault({
            vaultPath: localVaultPath,
            vaultName: '',
            filename: fileName,
            sourcePath: srcPath,
            metadata: { id: dbItem.id, title: dbItem.title, prompt: dbItem.prompt }
        });


        if (result.success && result.targetPath) {
            const newSrc = `file://${result.targetPath.replace(/\\/g, '/')}`;

            await electronAPI.trashFile(srcPath).catch((err: any) => console.warn("Failed to trash external file:", err));
            const externalBase = srcPath.substring(0, srcPath.lastIndexOf('.'));
            await electronAPI.trashFile(externalBase + '.json').catch(() => { });
            await electronAPI.trashFile(externalBase + '.txt').catch(() => { });

            await db.images.update(id, { src: newSrc, blob: undefined, sourceId: 'internal', originalSrc: externalSrc });
            const updated = await db.images.get(id);
            return updated || null;
        } else {
            console.error(`[DiskSync:${id}] Copy failed:`, result.error);
            await db.images.update(id, { sourceId: safeOriginalSourceId });
            return null;
        }
    } catch (err) {
        console.error(`[DiskSync:${id}] Copy to vault error:`, err);
        await db.images.update(id, { sourceId: safeOriginalSourceId });
        return null;
    }
}

async function saveMemoryToDisk(
    id: string,
    dbItem: AIImageDB,
    originalImage: AIImageDB,
    localVaultPath: string,
    electronAPI: any
): Promise<AIImageDB | null> {
    const imageData = {
        title: originalImage?.title || dbItem.title,
        prompt: dbItem.prompt,
        blob: dbItem.blob as Blob,
        dataUrl: dbItem.src?.startsWith('data:') ? dbItem.src : undefined
    };

    const result = await SyncEngine.saveNewImage(
        imageData,
        electronAPI,
        localVaultPath,
        id
    );

    if (result.success && result.src) {
        let newDbItem = (await db.images.get(id))!;
        if (!newDbItem.src?.startsWith('file://')) {
            await db.images.update(id, { src: result.src, blob: undefined });
            newDbItem = (await db.images.get(id))!;
        }
        return newDbItem;
    } else {
        throw new Error(result.error || "SyncEngine save failed");
    }
}

async function handleFileRename(
    id: string,
    dbItem: AIImageDB,
    originalImage: AIImageDB,
    fsPath: string,
    isExternalSource: boolean,
    renameLinkedVaultFiles: boolean,
    electronAPI: any
): Promise<{ newFsPath: string; newDbItem: AIImageDB }> {
    const oldT = originalImage?.title || dbItem.title;
    const newT = dbItem.title;

    const shouldRename = !isExternalSource || renameLinkedVaultFiles;
    if (shouldRename && newT && oldT && newT !== oldT) {
        const dir = fsPath.substring(0, Math.max(fsPath.lastIndexOf('/'), fsPath.lastIndexOf('\\')));
        const ext = fsPath.substring(fsPath.lastIndexOf('.'));
        const sep = fsPath.includes('\\') ? '\\' : '/';
        const safeNew = sanitizeFilename(newT);
        const targetRename = `${dir}${sep}${safeNew}${ext}`;

        if (fsPath.toLowerCase() !== targetRename.toLowerCase()) {
            const oldBase = fsPath.substring(0, fsPath.lastIndexOf('.'));
            const rRes = await electronAPI.renameFile(fsPath, targetRename);

            if (rRes.success) {
                const actualPath = rRes.finalPath || targetRename;
                const updatedSrc = `file://${actualPath.replace(/\\/g, '/')}`;
                await db.images.update(id, { src: updatedSrc });

                // Verify if previous file persists as ghost
                const oldFileExists = await electronAPI.checkFileExists(fsPath);
                if (oldFileExists) {
                    await electronAPI.trashFile(fsPath).catch((e: any) => console.error("Failed to cleanup ghost file:", e));
                }

                try {
                    await Promise.all([
                        electronAPI.trashFile(oldBase + '.json').catch(() => { }),
                        electronAPI.trashFile(oldBase + '.txt').catch(() => { })
                    ]);
                } catch { }

                const newDbItem = (await db.images.get(id))!;
                return { newFsPath: actualPath, newDbItem };
            } else {
                console.error(`[DiskSync:${id}] Rename failed: ${rRes.error}`);
            }
        }
    }

    return { newFsPath: fsPath, newDbItem: dbItem };
}

async function syncMetadataAndSidecars(
    id: string,
    dbItem: AIImageDB,
    fsPath: string,
    isExternalSource: boolean,
    electronAPI: any
): Promise<void> {
    const { blob: _b, src: _s, id: _i, ...safeExif } = dbItem;
    await Promise.all([
        electronAPI.writeMetadata(fsPath, { id, ...safeExif }),
        SyncEngine.writeSidecar(id, fsPath, dbItem, electronAPI)
    ]);
}

export function useDiskSync({
    isElectron,
    generalSettings,
    sources,
    addToast
}: UseDiskSyncOptions): UseDiskSyncReturn {

    const performDiskSync = useCallback(async (id: string, originalImage: AIImageDB): Promise<AIImage | undefined> => {
        if (SyncEngine.isLocked(id)) {
            await new Promise(r => setTimeout(r, 500));
            if (SyncEngine.isLocked(id)) return (await db.images.get(id)) as AIImage;
        }

        SyncEngine.lock(id);
        const electronAPI = (window as any).electronAPI;

        try {
            let dbItemRaw = await db.images.get(id);
            if (!dbItemRaw) return { id, src: '', title: 'Deleted' } as AIImage;
            let dbItem = dbItemRaw;

            if (!isElectron || !electronAPI || !generalSettings.localVaultPath) return toUI(dbItem);
            if (!originalImage) return toUI(dbItem);

            // Standardize paths for comparison
            const normLocalVaultPath = generalSettings.localVaultPath.replace(/\\/g, '/').toLowerCase();
            const normLocalVaultWithSlash = normLocalVaultPath.endsWith('/') ? normLocalVaultPath : normLocalVaultPath + '/';


            const srcUrl = dbItem.src || '';
            const pRes = await electronAPI.getFsPath(srcUrl);
            const currentFsPath = pRes.success ? pRes.path : '';
            const normCurrentPath = currentFsPath.replace(/\\/g, '/').toLowerCase();

            const isInLocalVault = normCurrentPath.startsWith(normLocalVaultWithSlash);

            const sourceIdChanged = originalImage.sourceId !== dbItem.sourceId;


            if (!sourceIdChanged && dbItem.sourceId === 'internal' && srcUrl.startsWith('file://') && !isInLocalVault) {
                const matchingSource = sources.find(s => {
                    if (!s.path) return false;
                    const normS = s.path.replace(/\\/g, '/').toLowerCase();
                    const normSWithSlash = normS.endsWith('/') ? normS : normS + '/';
                    return normCurrentPath.startsWith(normSWithSlash);
                });
                if (matchingSource) {
                    await db.images.update(id, { sourceId: matchingSource.id });
                    dbItem.sourceId = matchingSource.id;
                }
            }

            const safeOriginalSourceId = originalImage?.sourceId ?? dbItem.sourceId;
            const safeOriginalSrc = originalImage?.src ?? dbItem.src;
            const wasExternal = safeOriginalSourceId !== 'internal';
            const wasInternal = safeOriginalSourceId === 'internal';
            const nowInternal = dbItem.sourceId === 'internal';
            const nowExternal = dbItem.sourceId !== 'internal';
            const sourceIdActuallyChanged = safeOriginalSourceId !== dbItem.sourceId;

            const needsCopyToLocal = sourceIdActuallyChanged && wasExternal && nowInternal && srcUrl.startsWith('file://');
            const needsRemoveFromLocal = sourceIdActuallyChanged && wasInternal && nowExternal && safeOriginalSrc?.startsWith('file://');

            // PHASE -1: Move back to external vault (from local)
            if (needsRemoveFromLocal && safeOriginalSrc) {
                const sRes = await electronAPI.getFsPath(safeOriginalSrc);
                const oldFsPath = sRes.success ? sRes.path : '';
                const normOldPath = oldFsPath.replace(/\\/g, '/').toLowerCase();

                if (normOldPath.startsWith(normLocalVaultWithSlash)) {

                    const targetSource = sources.find(s => s.id === dbItem.sourceId);
                    const targetVaultPath = targetSource?.path;

                    if (targetVaultPath) {
                        const roundTripResult = await handleRoundTrip(id, dbItem, oldFsPath, targetVaultPath, electronAPI);
                        if (roundTripResult.handled && roundTripResult.newDbItem) {
                            dbItem = roundTripResult.newDbItem;
                        } else {
                            const newDbItem = await copyToExternalVault(id, dbItem, oldFsPath, targetVaultPath, electronAPI, addToast);
                            if (newDbItem) dbItem = newDbItem;
                        }
                    } else {
                        await db.images.update(id, { sourceId: 'internal' });
                    }
                }
            }

            const isExternalSource = dbItem.sourceId !== 'internal' && !needsCopyToLocal;

            // PHASE 0: Copy from external to local
            if (needsCopyToLocal && srcUrl) {
                const newDbItem = await copyToLocalVault(id, dbItem, generalSettings.localVaultPath, safeOriginalSourceId, electronAPI);
                if (!newDbItem) return (await db.images.get(id)) as AIImage;
                dbItem = newDbItem;
            }

            if (!dbItem) return { id, src: '', title: 'Deleted' } as AIImage;

            // PHASE 1: Memory -> Disk
            if (!isExternalSource && !dbItem.src?.startsWith('file://')) {
                const isActuallyMemory = dbItem.src?.startsWith('data:') || dbItem.src?.startsWith('blob:') || !!dbItem.blob;
                if (isActuallyMemory) {
                    const newDbItem = await saveMemoryToDisk(id, dbItem, originalImage, generalSettings.localVaultPath, electronAPI);
                    if (newDbItem) dbItem = newDbItem;
                }
            }

            // PHASE 2: Resolve Path (final verification)
            const finalRes = await electronAPI.getFsPath(dbItem.src || '');
            let fsPath = finalRes.success ? finalRes.path : '';
            if (!fsPath) return toUI(dbItem);

            // PHASE 3: Handle Rename
            const renameResult = await handleFileRename(
                id, dbItem, originalImage, fsPath, isExternalSource,
                generalSettings.renameLinkedVaultFiles, electronAPI
            );
            fsPath = renameResult.newFsPath;
            dbItem = renameResult.newDbItem;

            // PHASE 4: Sync Metadata
            await syncMetadataAndSidecars(id, dbItem, fsPath, isExternalSource, electronAPI);

            return toUI(dbItem);
        } catch (e) {
            console.error(`[DiskSync:${id}] Fatal error:`, e);
            addToast('error', `Disk sync failed: ${(e as Error).message}`);
            const fallback = await db.images.get(id);
            return fallback ? toUI(fallback) : { id, src: '', title: 'Error' } as AIImage;
        } finally {
            SyncEngine.unlock(id);
        }
    }, [isElectron, generalSettings, addToast, sources]);

    return { performDiskSync };
}
