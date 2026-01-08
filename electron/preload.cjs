const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {

    platform: process.platform,

    // Get file path from File object (for drag-drop)
    getPathForFile: (file) => webUtils.getPathForFile(file),
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    scanDirectory: (path) => ipcRenderer.invoke('scan-directory', path),
    writeFile: (path, content) => ipcRenderer.invoke('write-file', path, content),
    readMetadata: (filePath) => ipcRenderer.invoke('read-metadata', filePath),

    writeMetadata: (filePath, metadata) => ipcRenderer.invoke('write-metadata', filePath, metadata),
    renameFile: (oldPath, newPath) => ipcRenderer.invoke('rename-file', oldPath, newPath),
    getFsPath: (fileUrl) => ipcRenderer.invoke('get-fs-path', fileUrl),
    checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath),
    watchFolder: (folderPath) => ipcRenderer.invoke('watch-folder', folderPath),
    unwatchFolder: (folderPath) => ipcRenderer.invoke('unwatch-folder', folderPath),
    readImage: (filePath) => ipcRenderer.invoke('read-image', filePath),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    calculateHash: (filePath) => ipcRenderer.invoke('calculate-hash', filePath),
    exportDataset: (data) => ipcRenderer.invoke('export-dataset', data),

    // Local Vault APIs
    copyToVault: (data) => ipcRenderer.invoke('copy-to-vault', data),
    saveBlobToVault: (data) => ipcRenderer.invoke('save-blob-to-vault', data),
    getDefaultVaultPath: () => ipcRenderer.invoke('get-default-vault-path'),
    trashFile: (filePath) => ipcRenderer.invoke('trash-file', filePath),
    backupFile: (filePath) => ipcRenderer.invoke('backup-file', filePath),
    restoreFile: (args) => ipcRenderer.invoke('restore-file', args),
    getUniquePath: (directory, filename) => ipcRenderer.invoke('get-unique-path', directory, filename),
    mkdir: (dirPath) => ipcRenderer.invoke('mkdir', dirPath),
    addToAllowedPaths: (paths) => ipcRenderer.invoke('add-to-allowed-paths', paths),
    clearVault: () => ipcRenderer.invoke('clear-vault'),

    onFileEvent: (callback) => ipcRenderer.on('file-event', (_event, data) => callback(data)),
    offFileEvent: () => ipcRenderer.removeAllListeners('file-event')
});
