'use client';

import { useEffect, useState } from 'react';

type Preset = 'free-ai' | 'cli-bridge' | 'custom';

interface Settings {
  preset: Preset;
  baseURL: string;
  apiKey: string;
  model: string;
}

const PRESET_URLS: Record<string, string> = {
  'free-ai': 'https://free-ai-gateway.sarthakagrawal927.workers.dev/v1',
  'cli-bridge': 'http://localhost:3456/api',
};

const DEFAULT_SETTINGS: Settings = {
  preset: 'free-ai',
  baseURL: PRESET_URLS['free-ai'],
  apiKey: '',
  model: 'auto',
};

const STORAGE_KEY = 'ai-settings';

export function SettingsForm() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        setSettings(JSON.parse(raw));
      } catch {
        // ignore corrupt data
      }
    }
  }, []);

  function handlePresetChange(preset: Preset) {
    const baseURL = PRESET_URLS[preset] ?? settings.baseURL;
    setSettings((prev) => ({ ...prev, preset, baseURL }));
    setSaved(false);
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-6">
      {/* Preset selection */}
      <fieldset>
        <legend className="text-sm font-medium mb-3">Provider Preset</legend>
        <div className="space-y-2">
          {([
            ['free-ai', 'Free AI Gateway'],
            ['cli-bridge', 'CLI Bridge (Local)'],
            ['custom', 'Bring Your Own Key'],
          ] as const).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="preset"
                value={value}
                checked={settings.preset === value}
                onChange={() => handlePresetChange(value)}
                className="accent-blue-600"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Base URL — only shown for custom preset */}
      {settings.preset === 'custom' && (
        <div>
          <label className="block text-sm font-medium mb-1">Base URL</label>
          <input
            type="text"
            value={settings.baseURL}
            onChange={(e) => {
              setSettings((prev) => ({ ...prev, baseURL: e.target.value }));
              setSaved(false);
            }}
            placeholder="https://api.openai.com/v1"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* API Key — hidden for cli-bridge */}
      {settings.preset !== 'cli-bridge' && (
        <div>
          <label className="block text-sm font-medium mb-1">API Key</label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => {
              setSettings((prev) => ({ ...prev, apiKey: e.target.value }));
              setSaved(false);
            }}
            placeholder="sk-..."
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}

      {/* Model */}
      <div>
        <label className="block text-sm font-medium mb-1">Model</label>
        <input
          type="text"
          value={settings.model}
          onChange={(e) => {
            setSettings((prev) => ({ ...prev, model: e.target.value }));
            setSaved(false);
          }}
          placeholder="auto"
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
      >
        {saved ? 'Saved!' : 'Save Settings'}
      </button>
    </div>
  );
}
