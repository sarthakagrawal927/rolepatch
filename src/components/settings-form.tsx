'use client';

import { useState } from 'react';

interface Settings {
  baseURL: string;
  apiKey: string;
  model: string;
}

const DEFAULT_SETTINGS: Settings = {
  baseURL: 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1',
  apiKey: '',
  model: 'auto',
};

const STORAGE_KEY = 'ai-settings';

function loadInitialSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        baseURL: parsed.baseURL || DEFAULT_SETTINGS.baseURL,
        apiKey: parsed.apiKey || '',
        model: parsed.model || 'auto',
      };
    }
  } catch {
    // ignore corrupt data
  }
  return DEFAULT_SETTINGS;
}

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(loadInitialSettings);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-1">
      {/* Provider config card */}
      <div className="border border-gray-800 rounded-xl p-6 space-y-5 bg-gray-900/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-green-500">
              <path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M6 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Provider</h2>
            <p className="text-xs text-gray-500">Any OpenAI-compatible endpoint</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Base URL</label>
          <input
            type="text"
            value={settings.baseURL}
            onChange={(e) => {
              setSettings((prev) => ({ ...prev, baseURL: e.target.value }));
              setSaved(false);
            }}
            placeholder="https://api.openai.com/v1"
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => {
              setSettings((prev) => ({ ...prev, apiKey: e.target.value }));
              setSaved(false);
            }}
            placeholder="sk-..."
            className="input-base"
          />
          <p className="text-xs text-gray-600 mt-1.5">Leave empty to use the free gateway</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Model</label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => {
              setSettings((prev) => ({ ...prev, model: e.target.value }));
              setSaved(false);
            }}
            placeholder="auto"
            className="input-base"
          />
          <p className="text-xs text-gray-600 mt-1.5">&quot;auto&quot; lets the gateway pick the best available model</p>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            saved
              ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : 'bg-white text-gray-900 hover:bg-gray-200'
          }`}
        >
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
