# User Guide

## Getting Started

When you first open Archivist, you'll see an empty screen. Click the "+" button in the left sidebar to add a folder (vault) or just simple drag image in local vault..

## Vault System

Archivist supports two types of vaults:

1. **Internal Vault**: The app's own managed folder. When you drag-and-drop images, they're saved here.
2. **Linked Folders**: External folders you add. Archivist watches these folders but doesn't move or modify files by default.

You can enable file operations (rename/delete) for linked folders in Settings → Preferences.

## Sidecar Files

Archivist creates two files alongside each image:

- `image.json` - Complete metadata (model, prompt, tags, rating, etc.)
- `image.txt` - Prompt text only

These files make metadata portable. If you copy a folder to another computer, Archivist can read these files and restore all metadata.

## AI Features

Configure AI settings in Settings → Intelligence section. Archivist supports multiple AI providers:

- **Google Gemini**: Free tier available, good for general use
- **OpenAI-Compatible**: Works with OpenRouter, Together AI, and similar services
- **Ollama**: Connect to local LLM instances (no API key required)
- **Fal.ai**: Alternative vision model provider

AI capabilities:
- **Automatic caption generation**: Generate descriptions in SD tag format or natural language
- **Batch processing**: Caption multiple images at once for dataset preparation

## Filtering

Click the "Filters" button in the header to open the filter panel. You can filter by:

- Tags
- Model
- LoRA
- Sampler
- Steps
- CFG Scale
- Aspect Ratio
- Rating (stars)
- Dominant Colors

Filters are cumulative - you can combine multiple filters for precise searches.

## View Modes

Switch between two view modes using the toggle in the header:

1. **Gallery**: Grid view for browsing images visually
2. **Dataset**: Table view showing detailed metadata (model, prompt, sampler, CFG, steps, dimensions, etc.)

In Dataset mode, you can customize which columns to display using the columns menu.

## Batch Operations

Select multiple images (click the checkbox on each image or use "Select All" button in Dataset mode) to reveal the batch operations toolbar at the bottom:

- **Caption**: Generate AI captions for all selected images
- **Rename**: Batch rename using patterns (prompt snippet, model + sequence, date)
- **Move to Vault**: Copy selected images to another vault
- **Export**: Export as a dataset with images and metadata
- **Delete**: Remove from library or delete from disk

## Image Editor

Click any image to open the full editor panel. Here you can:

- Edit title, prompt, and negative prompt
- Change model, sampler, steps, CFG, and seed values
- Add or remove tags
- Rate with stars (1-5)
- Generate AI captions
- Move to different vaults
- View Windows file properties (metadata tab)

**Keyboard shortcuts in editor:**
- `1-5`: Set rating
- `Arrow Left/Right`: Navigate to previous/next image
- `Esc`: Close editor

## Duplicate Detection

Archivist automatically detects duplicate images using perceptual hashing. Duplicates are marked with a badge in the gallery. Click the badge to see all copies and their locations.

You can choose to:
- Keep duplicates in multiple vaults
- Skip importing duplicates
- View which vaults contain copies

## Quick Save

Use the Quick Save feature (accessible via drag-and-drop or command palette) to quickly import images with metadata:

- Drag images directly onto the app
- Edit metadata before saving
- Choose destination vault
- Supports bulk import with preview

## Troubleshooting

**Images not showing:**
- Click the refresh button in the header
- Verify the folder still exists and is accessible
- Check if the vault is still linked in Settings

**AI not working:**
- Verify API key in Settings → Intelligence
- Check internet connection
- Ensure the selected model is available for your provider


## Advanced Features

### Undo/Redo
Archivist tracks changes and supports undo/redo for:
- Metadata edits
- Deletions
- Batch operations

Use `Ctrl+Z` and `Ctrl+Y` or the buttons in the header.

### Command Palette
Press `Ctrl+K` to open the command palette for quick access to:
- Navigation
- Batch operations
- Settings
- View modes


### Export Options
When exporting datasets, you can choose to include:
- Original images
- `.txt` caption files
- `.json` metadata files

