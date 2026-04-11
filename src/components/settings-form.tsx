'use client';

import { useState, useEffect, useRef } from 'react';

interface Settings {
  endpointUrl: string;
  apiKey: string;
  model: string;
}

const DEFAULT_SETTINGS: Settings = {
  endpointUrl: '',
  apiKey: '',
  model: '',
};

const STORAGE_KEY = 'ai-settings';

function loadInitialSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        endpointUrl: parsed.endpointUrl || parsed.baseURL || '',
        apiKey: parsed.apiKey || '',
        model: parsed.model || '',
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
  const [models, setModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function fetchModels() {
    if (!settings.endpointUrl) return;
    setModelsLoading(true);
    setModelsError(null);
    try {
      const res = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointUrl: settings.endpointUrl,
          apiKey: settings.apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setModelsError(data.error || 'Failed to fetch models');
        setModels([]);
      } else {
        setModels(data.models || []);
        if (data.models?.length > 0) {
          setDropdownOpen(true);
        }
      }
    } catch {
      setModelsError('Failed to connect');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const filteredModels = settings.model
    ? models.filter((m) => m.toLowerCase().includes(settings.model.toLowerCase()))
    : models;

  return (
    <div className="space-y-1">
      {/* Provider config card */}
      <div className="border border-[var(--border)] rounded-xl p-6 space-y-5 bg-[var(--card)]/30">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-[var(--accent)]">
              <path d="M8 1L2 4v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V4L8 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M6 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">AI Provider</h2>
            <p className="text-xs text-[var(--muted-foreground)]">Any OpenAI-compatible endpoint</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">Endpoint URL</label>
          <input
            type="text"
            value={settings.endpointUrl}
            onChange={(e) => {
              setSettings((prev) => ({ ...prev, endpointUrl: e.target.value }));
              setSaved(false);
            }}
            placeholder="https://api.openai.com/v1"
            className="input-base"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">API Key</label>
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
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider">Model</label>
          <div className="relative" ref={comboboxRef}>
            <div className="flex gap-2">
              <input
                type="text"
                value={settings.model}
                onChange={(e) => {
                  setSettings((prev) => ({ ...prev, model: e.target.value }));
                  setSaved(false);
                  if (models.length > 0) setDropdownOpen(true);
                }}
                onFocus={() => {
                  if (models.length > 0) setDropdownOpen(true);
                }}
                placeholder="Enter model name or fetch available models"
                className="input-base flex-1"
              />
              <button
                type="button"
                onClick={fetchModels}
                disabled={!settings.endpointUrl || modelsLoading}
                className="px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-40 transition-colors shrink-0"
              >
                {modelsLoading ? 'Loading...' : 'Fetch Models'}
              </button>
            </div>

            {/* Dropdown */}
            {dropdownOpen && filteredModels.length > 0 && (
              <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg">
                {filteredModels.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, model: m }));
                      setDropdownOpen(false);
                      setSaved(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-[var(--muted)] transition-colors"
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          {modelsError && (
            <p className="text-xs text-red-400 mt-1.5">{modelsError}</p>
          )}
          {models.length > 0 && !modelsError && (
            <p className="text-xs text-[var(--muted-foreground)] mt-1.5">
              {models.length} model{models.length !== 1 ? 's' : ''} available
            </p>
          )}
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          className={`px-5 py-2.5 text-sm font-medium rounded-lg transition-all ${
            saved
              ? 'bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/20'
              : 'bg-white text-gray-900 hover:bg-gray-200'
          }`}
        >
          {saved ? 'Saved' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
