const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, dialog, protocol, shell } = require('electron');
const path = require('path');
const { fileURLToPath } = require('url');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const { exiftool } = require('exiftool-vendored');
// chokidar is loaded dynamically in the watch-folder handler to support ESM versions

const watchers = new Map();
const allowedPaths = new Set();
const ignoredPaths = new Set();

let mainWindow;
let tray;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#09090b',
    icon: fs.existsSync(path.join(__dirname, '../public/icon.png')) ? path.join(__dirname, '../public/icon.png') : undefined,
    title: 'Archivist',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#09090b',
      symbolColor: '#ffffff',
      height: 12
    },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.cjs')
    },
    show: false
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

  if (process.env.npm_lifecycle_event === 'electron:dev') {
    mainWindow.loadURL('http://localhost:6173');
  } else {
    mainWindow.loadURL(startUrl);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting && tray && !tray.isDestroyed()) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  const iconPath = path.join(__dirname, '../public/icon.png');
  if (!fs.existsSync(iconPath)) {
    console.warn('Tray icon not found at:', iconPath);
    return;
  }

  let icon = nativeImage.createEmpty();
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch (e) {
    console.error('Failed to load tray icon:', e);
    return;
  }

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Archivist', click: () => mainWindow.show() },
    { type: 'separator' },
    {
      label: 'Quit', click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Archivist');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// ============================================
// SECURITY: Path Validation Helper
// ============================================


function getDefaultVaultPathString() {
  const basePath = app.isPackaged ? app.getPath('userData') : process.cwd();
  return path.join(basePath, 'archive');
}

function isPathAllowed(targetPath) {
  if (!targetPath) return false;

  const normalizedTarget = path.normalize(targetPath).toLowerCase();


  const defaultVault = getDefaultVaultPathString();
  const normalizedVault = path.normalize(defaultVault).toLowerCase();

  if (normalizedTarget === normalizedVault || normalizedTarget.startsWith(normalizedVault + path.sep)) {
    return true;
  }


  for (const allowed of allowedPaths) {
    const normalizedAllowed = path.normalize(allowed).toLowerCase();


    if (normalizedTarget === normalizedAllowed || normalizedTarget.startsWith(normalizedAllowed + path.sep)) {
      return true;
    }

    // Fallback: Check without trailing separator for drives or roots
    if (normalizedTarget.startsWith(normalizedAllowed)) {
      const charAfter = normalizedTarget[normalizedAllowed.length];
      if (!charAfter || charAfter === path.sep) return true;
    }
  }

  return false;
}

function addAllowedPath(folderPath) {
  if (folderPath) {
    allowedPaths.add(path.normalize(folderPath));
  }
}

function removeAllowedPath(folderPath) {
  if (folderPath) {
    allowedPaths.delete(path.normalize(folderPath));
  }
}


async function getUniquePath(directory, filename) {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  let targetPath = path.join(directory, filename);
  let counter = 1;

  while (fs.existsSync(targetPath)) {
    targetPath = path.join(directory, `${base}_${counter}${ext}`);
    counter++;
  }
  return targetPath;
}

// ============================================
// IPC Handlers
// ============================================

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });

  if (result.canceled) return null;
  const folderPath = result.filePaths[0];

  addAllowedPath(folderPath);

  try {
    const files = await fsPromises.readdir(folderPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];


    const imageFiles = files.filter(file => imageExtensions.includes(path.extname(file).toLowerCase()));

    const images = await Promise.all(imageFiles.map(async file => {
      const fullPath = path.join(folderPath, file);
      try {
        const stats = await fsPromises.stat(fullPath);
        return {
          name: file,
          fullPath: fullPath,
          size: stats.size,
          date: stats.mtime.toISOString()
        };
      } catch (err) {
        return null;
      }
    }));

    return { folderPath, images: images.filter(img => img !== null) };
  } catch (error) {
    console.error('Error reading folder:', error);
    return null;
  }
});


ipcMain.handle('scan-directory', async (event, folderPath) => {


  if (!fs.existsSync(folderPath)) {

    return null;
  }

  addAllowedPath(folderPath);

  try {
    const files = await fsPromises.readdir(folderPath);
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];

    const imageFiles = files.filter(file => imageExtensions.includes(path.extname(file).toLowerCase()));


    const images = await Promise.all(imageFiles.map(async file => {
      const fullPath = path.join(folderPath, file);
      try {
        const stats = await fsPromises.stat(fullPath);
        return {
          name: file,
          fullPath: fullPath,
          size: stats.size,
          date: stats.mtime.toISOString()
        };
      } catch (err) {

        return null;
      }
    }));

    const validImages = images.filter(img => img !== null);

    return { folderPath, images: validImages };
  } catch (error) {
    console.error('[IPC:scan-directory] Error scanning folder:', error);
    return null;
  }
});

ipcMain.handle('write-file', async (event, filePath, content, options = {}) => {
  const dir = path.dirname(filePath);
  const useAtomic = options.atomic !== false;


  if (!isPathAllowed(dir)) {
    console.error('[IPC:write-file] Security: Write blocked to unauthorized path:', filePath);
    return { success: false, error: 'Unauthorized path' };
  }

  try {
    await fsPromises.mkdir(dir, { recursive: true });
    addAllowedPath(dir);

    const normalized = path.normalize(filePath).toLowerCase();

    ignoredPaths.add(normalized);

    const dataToWrite = typeof content === 'string' ? content : Buffer.from(content);

    if (useAtomic) {

      const tempPath = filePath + '.tmp.' + Date.now();
      const tempNormalized = path.normalize(tempPath).toLowerCase();
      ignoredPaths.add(tempNormalized);

      await fsPromises.writeFile(tempPath, dataToWrite);
      await fsPromises.rename(tempPath, filePath);

      ignoredPaths.delete(tempNormalized);
      ;
    } else {
      // Direct write (for non-critical files like sidecars)
      await fsPromises.writeFile(filePath, dataToWrite);

    }

    setTimeout(() => {
      ignoredPaths.delete(normalized);

    }, 2000);

    return { success: true };
  } catch (error) {
    console.error('[IPC:write-file] Error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('read-file', async (event, filePath) => {
  if (!isPathAllowed(path.dirname(filePath))) return null;
  try {
    return await fsPromises.readFile(filePath, 'utf8');
  } catch (err) {
    return null;
  }
});

// Copy image to Local Vault with metadata sidecar
ipcMain.handle('copy-to-vault', async (event, { sourcePath, vaultPath, vaultName, filename, metadata }) => {
  try {
    // Create vault subfolder if needed
    const targetDir = path.join(vaultPath, vaultName);
    await fsPromises.mkdir(targetDir, { recursive: true });
    addAllowedPath(targetDir);

    const targetPath = await getUniquePath(targetDir, filename);
    const targetFilename = path.basename(targetPath);

    // Ignore watcher events for this path temporarily
    const normalized = path.normalize(targetPath).toLowerCase();
    ignoredPaths.add(normalized);

    await fsPromises.copyFile(sourcePath, targetPath);

    // Also ignore sidecars
    const baseP = targetPath.replace(/\.[^.]+$/, '');
    ignoredPaths.add(path.normalize(baseP + '.json').toLowerCase());
    ignoredPaths.add(path.normalize(baseP + '.txt').toLowerCase());

    if (metadata) {
      const sidecarPath = baseP + '.json';
      // CRITICAL: exclude src and blob to prevent data URL being stored
      const { src: _src, blob: _blob, ...safeMeta } = metadata;
      await fsPromises.writeFile(sidecarPath, JSON.stringify(safeMeta, null, 2));

      if (metadata.prompt) {
        await fsPromises.writeFile(baseP + '.txt', metadata.prompt);
      }
    }


    setTimeout(() => {
      ignoredPaths.delete(normalized);
      ignoredPaths.delete(path.normalize(baseP + '.json').toLowerCase());
      ignoredPaths.delete(path.normalize(baseP + '.txt').toLowerCase());
    }, 3000);

    return { success: true, targetPath, targetFilename };
  } catch (error) {
    console.error('[CopyToVault]', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('rename-file', async (event, oldPath, newPath) => {

  if (!isPathAllowed(path.dirname(oldPath)) || !isPathAllowed(path.dirname(newPath))) {
    return { success: false, error: 'Unauthorized path' };
  }

  const oldNormalized = path.normalize(oldPath);
  let targetNormalized = path.normalize(newPath);

  if (oldNormalized.toLowerCase() === targetNormalized.toLowerCase()) {
    return { success: true, finalPath: oldNormalized };
  }

  // If target exists, find a unique path instead of failing
  if (fs.existsSync(targetNormalized)) {
    const dir = path.dirname(targetNormalized);
    const filename = path.basename(targetNormalized);
    targetNormalized = await getUniquePath(dir, filename);

  }

  try {
    const baseOld = oldNormalized.replace(/\.[^.]+$/, '');
    const baseNew = targetNormalized.replace(/\.[^.]+$/, '');

    // CRITICAL: Rename sidecars FIRST, then image
    // This ensures sidecar exists with new name when watcher sees the renamed image
    const sidecarExts = ['.json', '.txt'];
    const toIgnore = [oldNormalized.toLowerCase(), targetNormalized.toLowerCase()];

    // Collect and ignore sidecar paths
    for (const ext of sidecarExts) {
      const pOld = baseOld + ext;
      const pNew = baseNew + ext;
      toIgnore.push(pOld.toLowerCase(), pNew.toLowerCase());
    }

    // Apply ignores for all involved files
    toIgnore.forEach(p => ignoredPaths.add(p));

    // Step 1: Rename sidecars first
    for (const ext of sidecarExts) {
      const pOld = baseOld + ext;
      const pNew = baseNew + ext;
      if (fs.existsSync(pOld)) {
        await fsPromises.rename(pOld, pNew);
      }
    }

    // Step 2: Rename the image file (watcher will see sidecar already renamed)
    if (fs.existsSync(oldNormalized)) {
      await fsPromises.rename(oldNormalized, targetNormalized);
    }


    setTimeout(() => {
      toIgnore.forEach(p => ignoredPaths.delete(p));
    }, 5000);


    return { success: true, finalPath: targetNormalized };
  } catch (err) {
    console.error('Rename failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-fs-path', async (event, fileUrl) => {
  try {
    if (!fileUrl) return { success: false, error: 'Empty path' };

    // Handle media:// protocol by stripping it
    if (fileUrl.startsWith('media://')) {
      return { success: true, path: path.normalize(fileUrl.replace('media://', '')) };
    }

    // Handle file:// protocol using standard utility
    if (fileUrl.startsWith('file://')) {
      return { success: true, path: fileURLToPath(fileUrl) };
    }

    // Assume it's already a raw path
    return { success: true, path: path.normalize(fileUrl) };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('check-file-exists', async (event, filePath) => {
  return fs.existsSync(filePath);
});

ipcMain.handle('get-unique-path', async (event, directory, filename) => {
  if (!isPathAllowed(directory)) return filename;
  return await getUniquePath(directory, filename);
});

ipcMain.handle('trash-file', async (event, filePath) => {
  if (!isPathAllowed(path.dirname(filePath))) {
    console.error('Security: Trash blocked for unauthorized path:', filePath);
    return { success: false, error: 'Unauthorized path' };
  }
  try {
    if (fs.existsSync(filePath)) {
      await shell.trashItem(filePath);
    }
    // Also try to trash sidecars
    const base = filePath.replace(/\.[^.]+$/, '');
    for (const ext of ['.json', '.txt']) {
      const sidecar = base + ext;
      if (fs.existsSync(sidecar)) {
        await shell.trashItem(sidecar);
      }
    }
    return { success: true };
  } catch (e) {
    console.error('Trash error:', e);
    return { success: false, error: e.message };
  }
});

// UNDO SUPPORT: Backup file before deletion
ipcMain.handle('backup-file', async (event, filePath) => {
  if (!isPathAllowed(path.dirname(filePath))) return { success: false };

  try {
    const backupDir = path.join(app.getPath('userData'), 'undo_buffer');
    await fsPromises.mkdir(backupDir, { recursive: true });

    // Generate unique backup name
    const ext = path.extname(filePath);
    const backupName = `${path.basename(filePath, ext)}_${Date.now()}${ext}`;
    const backupPath = path.join(backupDir, backupName);

    await fsPromises.copyFile(filePath, backupPath);

    // Also backup sidecars if exist
    const base = filePath.replace(/\.[^.]+$/, '');
    const backupBase = path.join(backupDir, `${path.basename(filePath, ext)}_${Date.now()}`);

    for (const sideExt of ['.json', '.txt']) {
      if (fs.existsSync(base + sideExt)) {
        await fsPromises.copyFile(base + sideExt, backupBase + sideExt);
      }
    }

    return { success: true, backupPath, backupBase };
  } catch (e) {
    console.error('Backup failed:', e);
    return { success: false, error: e.message };
  }
});

// UNDO SUPPORT: Restore file from backup
ipcMain.handle('restore-file', async (event, { backupPath, targetPath, backupBase }) => {
  // Security check? Target should be allowed.
  if (!isPathAllowed(path.dirname(targetPath))) return { success: false };

  try {
    // Restore main file
    await fsPromises.copyFile(backupPath, targetPath);

    // Restore sidecars
    if (backupBase) {
      const targetBase = targetPath.replace(/\.[^.]+$/, '');
      for (const sideExt of ['.json', '.txt']) {
        if (fs.existsSync(backupBase + sideExt)) {
          await fsPromises.copyFile(backupBase + sideExt, targetBase + sideExt);
        }
      }
    }
    return { success: true };
  } catch (e) {
    console.error('Restore failed:', e);
    return { success: false, error: e.message };
  }
});


ipcMain.handle('mkdir', async (event, dirPath) => {
  if (!isPathAllowed(path.dirname(dirPath))) return { success: false, error: 'Unauthorized' };
  try {
    await fsPromises.mkdir(dirPath, { recursive: true });
    addAllowedPath(dirPath);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

ipcMain.handle('save-blob-to-vault', async (event, { vaultPath, vaultName, filename, buffer, metadata }) => {
  try {
    // Create vault subfolder if needed
    const targetDir = path.join(vaultPath, vaultName);
    await fsPromises.mkdir(targetDir, { recursive: true });
    allowedPaths.add(targetDir);

    const targetPath = await getUniquePath(targetDir, filename);
    const targetFilename = path.basename(targetPath);

    // Ignore watcher events for this path temporarily
    const normalized = path.normalize(targetPath).toLowerCase();
    ignoredPaths.add(normalized);

    await fsPromises.writeFile(targetPath, Buffer.from(buffer));

    // Also ignore sidecars
    const baseP = targetPath.replace(/\.[^.]+$/, '');
    ignoredPaths.add(path.normalize(baseP + '.json').toLowerCase());
    ignoredPaths.add(path.normalize(baseP + '.txt').toLowerCase());

    // Save metadata sidecar (CRITICAL: exclude src and blob to prevent data URL being stored)
    if (metadata) {
      const sidecarPath = baseP + '.json';
      const { src: _src, blob: _blob, ...safeMeta } = metadata;
      await fsPromises.writeFile(sidecarPath, JSON.stringify(safeMeta, null, 2));

      if (metadata.prompt) {
        await fsPromises.writeFile(baseP + '.txt', metadata.prompt);
      }
    }


    setTimeout(() => {
      ignoredPaths.delete(normalized);
      ignoredPaths.delete(path.normalize(baseP + '.json').toLowerCase());
      ignoredPaths.delete(path.normalize(baseP + '.txt').toLowerCase());
    }, 3000);

    return {
      success: true,
      path: targetPath,
      targetPath: targetPath,  // Also add targetPath for compatibility
      filename: targetFilename,
      src: `file://${targetPath.replace(/\\/g, '/')}`
    };
  } catch (err) {
    console.error('Vault save failed:', err);
    return { success: false, error: err.message };
  }
});


ipcMain.handle('clear-vault', async () => {
  const vaultPath = getDefaultVaultPathString();
  if (!fs.existsSync(vaultPath)) return { success: true };

  try {
    const entries = await fsPromises.readdir(vaultPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(vaultPath, entry.name);
      if (entry.isDirectory()) {
        await fsPromises.rm(fullPath, { recursive: true, force: true });
      } else {
        await fsPromises.unlink(fullPath);
      }
    }

    return { success: true };
  } catch (e) {
    console.error('[ClearVault] Error:', e);
    return { success: false, error: e.message };
  }
});

// Get default vault path (project/archive folder for dev, userData/archive for production)
ipcMain.handle('get-default-vault-path', async () => {
  // In production (packaged app), app.getAppPath() points to asar which is read-only
  // Use userData instead which is always writable
  const basePath = app.isPackaged
    ? app.getPath('userData')  // e.g., %APPDATA%/Archivist
    : process.cwd();           // Strictly project root in dev mode

  const archivePath = path.join(basePath, 'archive');

  // Ensure the directory exists
  try {
    await fsPromises.mkdir(archivePath, { recursive: true });
    addAllowedPath(archivePath);
  } catch (e) {
    console.error('[GetDefaultVaultPath] Failed to create archive folder:', e);
  }
  return archivePath;
});

ipcMain.handle('read-metadata', async (event, filePath) => {
  // Security: Check if file exists, but allow reading any user-provided path for drag-and-drop support
  if (!fs.existsSync(filePath)) {

    return { success: false, error: 'File not found' };
  }

  try {

    const tags = await exiftool.read(filePath);

    // Extract UserComment - it might be stored in different formats
    let userComment = '';
    if (tags.UserComment) {
      userComment = typeof tags.UserComment === 'string'
        ? tags.UserComment
        : (tags.UserComment.toString ? tags.UserComment.toString() : JSON.stringify(tags.UserComment));
    }

    // Also check for PNG tEXt chunks (ComfyUI stores data here)
    const pngParameters = tags.parameters || tags.Parameters || '';
    const pngPrompt = tags.prompt || '';
    const pngWorkflow = tags.workflow || '';





    return {
      success: true,
      data: {
        // Description group
        Title: tags.Title || tags.XPTitle || '',
        Subject: tags.Subject || tags.XPSubject || '',
        ImageDescription: tags.ImageDescription || '',
        Parameters: pngParameters,
        Rating: tags.Rating || tags.XPRating || 0,
        Tags: tags.Keywords || tags.XPKeywords || [],
        Comments: tags.Comment || tags.XPComment || userComment || '',

        // AI Generation specific (for ComfyUI/A1111 PNG)
        UserComment: userComment,
        Prompt: pngPrompt,
        Workflow: pngWorkflow,

        // Origin group
        Authors: tags.Artist || tags.XPAuthor || tags.Creator || '',
        DateTaken: tags.DateTimeOriginal || tags.CreateDate || '',
        ProgramName: tags.Software || '',
        Copyright: tags.Copyright || '',

        // Image group
        ImageWidth: tags.ImageWidth || 0,
        ImageHeight: tags.ImageHeight || 0,
        BitDepth: tags.BitsPerSample || tags.BitDepth || 0,
        HorizontalResolution: tags.XResolution || 0,
        VerticalResolution: tags.YResolution || 0,
        ResolutionUnit: tags.ResolutionUnit || '',

        // Camera (if available)
        CameraMaker: tags.Make || '',
        CameraModel: tags.Model || '',

        // File info
        FileSize: tags.FileSize || '',
        FileType: tags.FileType || '',
        MIMEType: tags.MIMEType || '',

        // Raw tags for debugging
        _raw: tags
      }
    };
  } catch (error) {
    console.error('Metadata read error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-metadata', async (event, filePath, metadata) => {
  // Security: Validate path
  if (!isPathAllowed(path.dirname(filePath))) {
    console.error('Security: Metadata write blocked for unauthorized path:', filePath);
    return { success: false, error: 'Unauthorized path' };
  }

  try {

    const writeData = {};
    if (metadata.title) {
      writeData['Title'] = metadata.title;
    }
    if (metadata.prompt) {
      writeData['ImageDescription'] = metadata.prompt;
    }
    if (metadata.rating) writeData['Rating'] = metadata.rating;
    if (metadata.tags && Array.isArray(metadata.tags)) {
      writeData['Keywords'] = metadata.tags;
      writeData['Subject'] = metadata.tags;
    }

    // Ignore watcher events for this path temporarily
    const normalized = path.normalize(filePath).toLowerCase();
    ignoredPaths.add(normalized);

    await exiftool.write(filePath, writeData, ['-overwrite_original']);


    setTimeout(() => {
      ignoredPaths.delete(normalized);
    }, 2000);

    return { success: true };
  } catch (error) {
    console.error('Metadata write error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-dataset', async (event, { items, exportOptions }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Export Directory (Dataset Format)'
  });

  if (result.canceled) return { success: false };
  const baseDir = result.filePaths[0];

  // Security: Add export dir to allowed paths temporarily
  addAllowedPath(baseDir);

  let successCount = 0;

  for (const item of items) {
    try {
      const fileName = item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();

      // 1. Save Image
      const imageExt = item.src ? path.extname(item.src) : '.png';
      const imagePath = path.join(baseDir, `${fileName}${imageExt}`);

      if (item.src && item.src.startsWith('file://')) {
        const sourcePath = decodeURI(item.src.replace('file://', '').replace(/^\/([A-Z]:)/, '$1'));
        await fsPromises.copyFile(sourcePath, imagePath);
      } else if (item.blobData) {
        // If image is from Internal Vault (Blob)
        const buffer = Buffer.from(item.blobData, 'base64');
        await fsPromises.writeFile(imagePath, buffer);
      }

      // 2. Save Prompt (.txt)
      if (exportOptions.includeTxt) {
        await fsPromises.writeFile(path.join(baseDir, `${fileName}.txt`), item.prompt, 'utf8');
      }

      // 3. Save Metadata (.json)
      if (exportOptions.includeJson) {
        const metadata = { ...item };
        delete metadata.blobData; // Remove heavy data from json
        await fsPromises.writeFile(path.join(baseDir, `${fileName}.json`), JSON.stringify(metadata, null, 2), 'utf8');
      }

      successCount++;
    } catch (err) {
      console.error(`Export failed for ${item.title}:`, err);
    }
  }

  return { success: true, count: successCount, path: baseDir };
});

ipcMain.handle('watch-folder', async (event, folderPath) => {
  if (watchers.has(folderPath)) return; // Already watching

  addAllowedPath(folderPath);

  const chokidar = await import('chokidar');
  const watcher = chokidar.watch(folderPath, {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: true,
    depth: 0,
    // Wait for file write to complete before emitting events
    awaitWriteFinish: {
      stabilityThreshold: 500,  // File must be stable for 500ms
      pollInterval: 100
    }
  });

  watcher
    .on('add', filePath => {
      const normalized = path.normalize(filePath).toLowerCase();
      if (ignoredPaths.has(normalized)) {

        return;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file-event', { type: 'add', path: filePath, folder: folderPath });
      }
    })
    .on('unlink', filePath => {
      const normalized = path.normalize(filePath).toLowerCase();
      if (ignoredPaths.has(normalized)) {
        console.info('[Watcher] Ignored internal unlink:', filePath);
        return;
      }
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file-event', { type: 'remove', path: filePath, folder: folderPath });
      }
    });

  watchers.set(folderPath, watcher);
});

ipcMain.handle('unwatch-folder', async (event, folderPath) => {
  const watcher = watchers.get(folderPath);
  if (watcher) {
    await watcher.close();
    watchers.delete(folderPath);
    removeAllowedPath(folderPath);
  }
});

ipcMain.handle('calculate-hash', async (event, filePath) => {
  if (!isPathAllowed(path.dirname(filePath))) {
    return { success: false, error: 'Unauthorized path' };
  }

  try {
    const data = await fsPromises.readFile(filePath);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return { success: true, data: hash };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Hash calculation error:', error);
    }
    return { success: false, error: error.message };
  }
});


ipcMain.handle('read-image', async (event, filePath) => {
  // Security: Validate path
  if (!isPathAllowed(path.dirname(filePath))) {
    console.error('Security: Image read blocked for unauthorized path:', filePath);
    return { success: false, error: 'Unauthorized path' };
  }

  try {
    const data = await fsPromises.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase().replace('.', '');
    const mimeType = `image/${extension === 'jpg' ? 'jpeg' : extension}`;
    return {
      success: true,
      data: `data:${mimeType};base64,${data.toString('base64')}`
    };
  } catch (error) {
    console.error('Image read error:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(() => {
  // Security-enhanced media:// protocol
  protocol.registerFileProtocol('media', (request, callback) => {
    let rawUrl = request.url.replace(/^media:\/{2,3}/, '');

    try {
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(rawUrl);
      } catch {
        decodedPath = rawUrl;
      }

      // Handle leading slashes added by Chromium for drive letters (e.g. /D:/ -> D:/)
      if (process.platform === 'win32') {
        if (/^\/[a-zA-Z]:/.test(decodedPath)) decodedPath = decodedPath.slice(1);
        else if (/^[a-zA-Z]:/.test(decodedPath)) { /* correct already */ }
        else if (!decodedPath.startsWith('\\\\') && decodedPath.startsWith('/')) {
          // Fallback for other weird slash combinations
          decodedPath = decodedPath.slice(1);
        }
      }

      const normalized = path.normalize(decodedPath);

      if (!isPathAllowed(normalized)) {
        console.warn('[Security] media:// access denied (not allowed):', normalized);
        return callback({ statusCode: 403 });
      }

      if (!fs.existsSync(normalized)) {
        console.warn('[Protocol] media:// file not found:', normalized);
        return callback({ statusCode: 404 });
      }

      // Symlink verification
      const realPath = fs.realpathSync(normalized);
      if (realPath !== normalized && !isPathAllowed(realPath)) {
        console.warn('[Security] media:// symlink escape detected:', realPath);
        return callback({ statusCode: 403 });
      }

      return callback(realPath);
    } catch (error) {
      console.error('[ProtocolHandler] Error:', error);
      return callback({ statusCode: 500 });
    }
  });

  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

ipcMain.handle('add-to-allowed-paths', async (event, paths) => {
  if (Array.isArray(paths)) {
    paths.forEach(p => addAllowedPath(p));
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Windows/Linux: App stays in tray, handled by close event
  }
});


app.on('before-quit', async () => {
  isQuitting = true;

  // Close all file watchers
  for (const [folderPath, watcher] of watchers) {
    try {
      await watcher.close();

    } catch (e) {
      console.error('Error closing watcher:', e);
    }
  }
  watchers.clear();
  allowedPaths.clear();

  // Close exiftool process pool
  try {
    await exiftool.end();

  } catch (e) {
    console.error('Error closing exiftool:', e);
  }
});


process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});