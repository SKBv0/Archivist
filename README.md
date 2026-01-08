# Archivist

A desktop application for managing AI-generated images from Stable Diffusion, ComfyUI, Midjourney, and other tools. Built with Electron + React, all data stays local on your machine. 

For detailed usage instructions and features, please refer to the [User Guide](DOCS.md).
<p align="left">
  <img src="https://github.com/user-attachments/assets/44c5d966-aa55-4060-bbc3-03d31ebf38b1" width="190" />
  <img src="https://github.com/user-attachments/assets/866d5381-5004-4177-b7b4-310efce10eb3" width="190" />
  <img src="https://github.com/user-attachments/assets/76ce4319-c8a2-4bda-acc8-9c4923d936e3" width="190" />
  <img src="https://github.com/user-attachments/assets/8229387d-5d0d-4da5-9dc8-2cceca77a5d2" width="190" />
  <img src="https://github.com/user-attachments/assets/3792d7fa-6415-41db-bd00-b66beeaac4dd" width="190" />
</p>

## Features

- **Folder Watching**: Add folders and Archivist automatically detects new images
- **Metadata Extraction**: Reads prompts, models, seeds, samplers, and other parameters from PNG files
- **Advanced Filtering**: Filter by model, sampler, steps, CFG, aspect ratio, tags, colors, and more
- **AI Captioning**: Generate captions using Google Gemini, OpenAI-compatible APIs, or local Ollama models
- **Sidecar Files**: Creates `.json` and `.txt` files alongside images for portable metadata
- **Duplicate Detection**: Automatically identifies duplicate images across vaults
- **Batch Operations**: Rename, caption, move, or export multiple images at once
- **Two View Modes**: Gallery grid view and Dataset table view for different workflows


### Setup

```bash
# Clone the repository
git clone https://github.com/SKBv0/archivist.git
cd archivist

# Install dependencies
npm install
```

### Running in Development Mode

```bash
npm run electron:dev
```

This will:
1. Start the Vite dev server on `http://localhost:6173`
2. Launch Electron with hot-reload enabled
3. Open DevTools automatically for debugging

### Building for Production

```bash
npm run electron:build
```

The output is generated in the `dist-electron/win-unpacked/` folder. You can run the `Archivist.exe`  directly.


## API Configuration (Optional)

AI features require API keys. You can configure them in two ways:

### 1. In-App Settings (Recommended)
- Open the app → Settings → Intelligence section
- Enter your API keys
- Settings are stored in IndexedDB and persist across sessions

### 2. Environment Variables (For Development)
To avoid entering keys repeatedly during development:

```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local and add your real API keys
# Example:
# VITE_GEMINI_API_KEY=your_actual_api_key_here
```

**Note:** `.env.local` is gitignored and won't be committed to version control.

## Requirements

- Operating System: Windows (Currently only tested on Windows)
- Node.js 18+
- npm or yarn

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+K` | Open command palette |
| `1-5` | Rate selected image |
| `Esc` | Close / Clear selection |
| `Ctrl+Shift+D` | Toggle debug panel (developer) |
| `Arrow Keys` | Navigate between images (in editor) |

## Tech Stack

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Desktop**: Electron
- **Database**: Dexie (IndexedDB wrapper)
- **File Watching**: Chokidar
- **Metadata**: exiftool-vendored
- **AI**: Google Gemini API, OpenAI-compatible APIs, Ollama


## Important Notes

- Don't delete `.json` files next to images - they contain metadata
- The app continues running in the system tray when closed. Use "Quit" from the tray to fully exit
- Linked folders are read-only by default. Enable file operations in Settings if needed


## License

MIT
