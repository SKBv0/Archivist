import { useState, useCallback } from 'react';
import { AISettings, GeneralSettings } from '../../types';
import { DEFAULT_AI_SETTINGS, DEFAULT_GENERAL_SETTINGS } from '../../constants';
import { db } from '../../db';

interface UseSettingsReturn {
    aiSettings: AISettings;
    setAiSettings: React.Dispatch<React.SetStateAction<AISettings>>;
    updateAISettings: (settings: Partial<AISettings>) => void;
    generalSettings: GeneralSettings;
    setGeneralSettings: React.Dispatch<React.SetStateAction<GeneralSettings>>;
    updateGeneralSettings: (settings: Partial<GeneralSettings>) => void;
}


export function useSettings(): UseSettingsReturn {
    const [aiSettings, setAiSettings] = useState<AISettings>(DEFAULT_AI_SETTINGS);
    const [generalSettings, setGeneralSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);

    const updateAISettings = useCallback((settings: Partial<AISettings>) => {
        setAiSettings(prev => {
            let next = { ...prev, ...settings };


            if (settings.provider && settings.provider !== prev.provider) {
                const newProvider = settings.provider;


                const savedModel = prev.providerModels?.[newProvider];
                if (savedModel) {
                    next.captionModel = savedModel;
                } else {

                    if (newProvider === 'google') next.captionModel = 'gemini-2.0-flash';
                    else if (newProvider === 'fal') next.captionModel = 'fal-ai/llava-next';
                    else if (newProvider === 'ollama') next.captionModel = 'llava';
                    else if (newProvider === 'openai_compatible') next.captionModel = 'gpt-4o';
                }


                const savedUrl = prev.providerUrls?.[newProvider];
                if (savedUrl) {
                    next.baseUrl = savedUrl;
                } else {

                    if (newProvider === 'google') next.baseUrl = 'https://generativelanguage.googleapis.com'; // Placeholder
                    else if (newProvider === 'fal') next.baseUrl = 'https://fal.run';
                    else if (newProvider === 'ollama') next.baseUrl = 'http://localhost:11434/v1';
                    else if (newProvider === 'openai_compatible') next.baseUrl = 'https://openrouter.ai/api/v1';
                }


                const savedKey = prev.providerKeys?.[newProvider];
                if (savedKey !== undefined) {
                    next.apiKey = savedKey;
                } else if (newProvider === 'ollama') {
                    next.apiKey = 'ollama'; // Dummy key for Ollama
                } else {
                    next.apiKey = '';
                }
            }

            // Sync current state to provider-specific mappings
            const currentProvider = next.provider;

            next.providerModels = {
                ...(prev.providerModels || {}),
                [currentProvider]: next.captionModel
            };

            next.providerUrls = {
                ...(prev.providerUrls || {}),
                [currentProvider]: next.baseUrl
            };

            next.providerKeys = {
                ...(prev.providerKeys || {}),
                [currentProvider]: next.apiKey
            };

            db.settings.put({ key: 'aiSettings', value: next });
            return next;
        });
    }, []);

    const updateGeneralSettings = useCallback((settings: Partial<GeneralSettings>) => {
        setGeneralSettings(prev => {
            const next = { ...prev, ...settings };


            if (settings.localVaultPath) {
                let rawPath = settings.localVaultPath.replace(/\\/g, '/');
                if (rawPath.endsWith('/')) rawPath = rawPath.slice(0, -1);


                if (rawPath.toLowerCase().endsWith('/imported')) {
                    next.localVaultPath = rawPath.substring(0, rawPath.length - '/imported'.length);
                } else {
                    next.localVaultPath = rawPath;
                }
            }

            db.settings.put({ key: 'generalSettings', value: next });
            return next;
        });
    }, []);

    return {
        aiSettings,
        setAiSettings,
        updateAISettings,
        generalSettings,
        setGeneralSettings,
        updateGeneralSettings
    };
}
