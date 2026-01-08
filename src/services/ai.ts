import { GoogleGenAI } from "@google/genai";
import { AISettings, OpenAIMessage } from "../types";
import { normalizePath, blobToBase64 } from "../utils";

const resolveImageSource = async (input: string | { src?: string, blob?: Blob }): Promise<string> => {
  let src = typeof input === 'string' ? input : (input.src || '');
  const blob = typeof input === 'object' && input.blob ? input.blob : undefined;

  if (blob) return blobToBase64(blob, true);

  if (window.electronAPI && (src.startsWith('file://') || src.startsWith('media://'))) {
    const cleanPath = normalizePath(src);

    try {
      const result = await window.electronAPI.readImage(cleanPath);
      if (result.success && result.data) return result.data;
    } catch (e) {
      console.warn("IPC Read Failed, falling back to fetch:", e);
    }
  }

  if (src.startsWith('blob:') || src.startsWith('http')) {
    try {
      const response = await fetch(src);
      const b = await response.blob();
      return blobToBase64(b, true);
    } catch (e) {
      console.warn("Fetch failed for URL:", src, e);
    }
  }

  return src;
};

const getImageData = (dataUrl: string) => {
  const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!matches || matches.length !== 3) return null;
  return { mimeType: matches[1], data: matches[2] };
};

const resolveOpenAIEndpoint = (baseUrl: string): string => {
  let endpoint = baseUrl.trim().replace(/\/+$/, '');
  if (!endpoint.endsWith('/chat/completions')) {
    if (!endpoint.includes('/v1')) {
      if (endpoint.includes('openrouter.ai') && !endpoint.includes('/api/v1')) endpoint += '/api/v1';
    }
    endpoint += '/chat/completions';
  }
  return endpoint;
};

const callOpenAI = async (settings: AISettings, model: string, messages: OpenAIMessage[], jsonMode: boolean): Promise<string> => {
  if (!settings.apiKey) throw new Error("API Key required");
  if (!settings.baseUrl) throw new Error("Base URL required");

  const endpoint = resolveOpenAIEndpoint(settings.baseUrl);

  try {
    const body: { model: string; messages: OpenAIMessage[]; response_format?: { type: "json_object" } } = {
      model: model,
      messages: messages
    };
    if (jsonMode) {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${settings.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Provider Error ${response.status}: ${errText.substring(0, 200)}`);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response from AI Provider");
    return content.trim();
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Network Error";
    throw new Error(msg);
  }
};

export const generateCaption = async (imageInput: string | { src?: string, blob?: Blob }, settings: AISettings): Promise<string> => {
  const finalImageSrc = await resolveImageSource(imageInput);
  const imageData = getImageData(finalImageSrc);
  const systemInstruction = settings.prompts[settings.activeCaptionStyle];

  if (settings.provider === 'google') {
    if (!imageData) throw new Error("Google Gemini requires a loaded image (Base64).");
    const geminiKey = settings.apiKey || import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) throw new Error("Google Gemini API Key is missing.");

    let geminiModel = settings.captionModel;
    if (!geminiModel || geminiModel.includes('/') || geminiModel.includes('fal')) geminiModel = 'gemini-2.0-flash';

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: {
          parts: [
            { inlineData: { mimeType: imageData.mimeType, data: imageData.data } },
            { text: "Analyze this image based on the system instructions provided." }
          ]
        },
        config: { systemInstruction }
      });
      return response.text || "";
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown Gemini API error";
      throw new Error(`Gemini Caption Failed: ${msg}`);
    }
  }
  else if (settings.provider === 'openai_compatible' || settings.provider === 'ollama') {
    const combinedPrompt = `${systemInstruction}\n\nDescribe this image.`;

    // Ollama doesn't require an API Key, but callOpenAI enforces it.
    // If provider is Ollama and no key is present, use a dummy one.
    // If provider is Ollama and no Base URL is present, use default localhost.
    const effectiveSettings = { ...settings };

    if (settings.provider === 'ollama') {
      if (!effectiveSettings.apiKey) effectiveSettings.apiKey = 'ollama';
      if (!effectiveSettings.baseUrl) effectiveSettings.baseUrl = 'http://localhost:11434/v1';
    }

    return callOpenAI(
      effectiveSettings,
      settings.captionModel,
      [
        {
          role: "user",
          content: [
            { type: "text", text: combinedPrompt },
            { type: "image_url", image_url: { url: finalImageSrc } }
          ]
        }
      ],
      false
    );
  }
  else if (settings.provider === 'fal') {
    if (!settings.apiKey) throw new Error("Fal.ai API Key required");
    const model = settings.captionModel || 'fal-ai/llava-next';
    const endpoint = `https://queue.fal.run/${model}`;
    const promptText = (systemInstruction || "Describe this image in detail.").trim();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Authorization": `Key ${settings.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, image_url: finalImageSrc })
      });

      if (!response.ok) throw new Error(`Fal.ai Error: ${response.status}`);
      const json = await response.json();

      if (json.output) {
        const out = json.output.content || json.output;
        return typeof out === 'string' ? out : JSON.stringify(out);
      }

      if (json.request_id || json.status_url) {
        const statusUrl = json.status_url || `https://queue.fal.run/requests/${json.request_id}/status`;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const s = await fetch(statusUrl, { headers: { "Authorization": `Key ${settings.apiKey}` } });
          if (s.ok) {
            const sj = await s.json();
            if (sj.status === 'COMPLETED') {
              const rUrl = json.response_url || sj.response_url;
              const res = await fetch(rUrl, { headers: { "Authorization": `Key ${settings.apiKey}` } });
              const rj = await res.json();
              const out = rj.output;
              return (typeof out === 'string') ? out : (out.content || JSON.stringify(out));
            }
            if (sj.status === 'FAILED') throw new Error("Fal failed");
          }
        }
      }
      return "";
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Fal.ai unknown error";
      throw new Error(msg);
    }
  }

  throw new Error("Unknown provider");
};
