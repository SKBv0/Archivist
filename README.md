# Archivist

A desktop application for managing AI-generated images from Stable Diffusion, ComfyUI, Midjourney, and other tools. Built with Electron + React, all data stays local on your machine.

For detailed usage instructions and features, please refer to the [User Guide](DOCS.md).

## Features

- **Folder Watching**: Add folders and Archivist automatically detects new images
- **Metadata Extraction**: Reads prompts, models, seeds, samplers, and other parameters from PNG files
- **Advanced Filtering**: Filter by model, sampler, steps, CFG, aspect ratio, tags, colors, and more
- **AI Captioning**: Generate captions using Google Gemini, OpenAI-compatible APIs, or local Ollama models
- **Sidecar Files**: Creates `.json` and `.txt` files alongside images for portable metadata
- **Duplicate Detection**: Automatically identifies duplicate images across vaults
- **Batch Operations**: Rename, caption, move, or export multiple images at once
- **Two View Modes**: Gallery grid view and Dataset table view for different workflows

### Prerequisites
- Node.js 18+
- npm or yarn

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
