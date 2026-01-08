export interface AIImage {
  id: string;
  sourceId: string;
  title: string;
  src: string;
  prompt: string;
  negativePrompt?: string;
  model: string;
  sampler: string;
  cfgScale: number;
  steps: number;
  seed: number;
  width: number;
  height: number;
  date: string;
  tags: string[];
  rating?: number;
  dominantColors?: string[];
  hash?: string;
  blob?: Blob;
  duplicates?: DuplicateInfo[];
  loras?: { name: string; weight?: number; }[];
  originalSrc?: string; // Original source path before moving to local vault (for round-trip prevention)
}

export interface AIImageDB extends Omit<AIImage, 'src'> {
  blob?: Blob;
  src?: string;
}

export interface DuplicateInfo extends AIImage {
  sourceName: string;
}

export interface LibrarySource {
  id: string;
  name: string;
  type: 'internal' | 'local_folder';
  path?: string;
  count: number;
}
export type AIProvider = 'google' | 'openai_compatible' | 'fal' | 'ollama';
export type CaptionStyle = 'stable_diffusion' | 'natural_language';

export interface AISettings {
  provider: AIProvider;
  baseUrl: string;
  apiKey: string;
  captionModel: string;
  activeCaptionStyle: CaptionStyle;

  providerModels?: Record<string, string>;
  providerUrls?: Record<string, string>;
  providerKeys?: Record<string, string>;
  prompts: {
    stable_diffusion: string;
    natural_language: string;
  };
}

export interface GradientColors {
  left: string;
  center: string;
  right: string;
}

export type QuickSaveLayout = 'horizontal' | 'vertical';

export interface GeneralSettings {
  localVaultPath: string;
  autoCopyPrompt: boolean;
  reduceMotion: boolean;
  gridItemSize: number;
  themeAccent: string;
  gradientColors: GradientColors;
  workbenchColumns: string[];
  quickSaveLayout: QuickSaveLayout;
  renameLinkedVaultFiles: boolean;
  deleteLinkedVaultFiles: boolean;
}

export interface FileMetadata {
  Title: string;
  Subject: string;
  ImageDescription: string;
  Parameters: string;
  Rating: number;
  Tags: string[];
  Comments: string;
  Authors: string;
  DateTaken: string;
  ProgramName: string;
  Copyright: string;
  ImageWidth: number;
  ImageHeight: number;
  BitDepth: number;
  HorizontalResolution: number;
  VerticalResolution: number;
  ResolutionUnit: string;
  CameraMaker: string;
  CameraModel: string;
  FileSize: string;
  FileType: string;
  MIMEType: string;

  UserComment?: string;
  Prompt?: string;
  Workflow?: string;
  _raw: any;
}

export type FilterCategory = 'tags' | 'models' | 'loras' | 'samplers' | 'steps' | 'cfg' | 'ratio' | 'rating' | 'colors';

export interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
}

export interface CivitaiResource {
  type: string;
  modelName: string;
  weight?: number;
}

export interface HistoryAction {
  type: 'update' | 'delete' | 'add' | 'batch_update' | 'batch_delete';
  timestamp: number;
  payload: any;
  undoPayload: any;
}

