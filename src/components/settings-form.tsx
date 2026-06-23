'use client';

import { AISettings } from '@/components/ai-settings';
import { useAIConfig } from '@/lib/ai-vendor-hooks';

const STORAGE_KEY = 'ai-settings';

export function SettingsForm() {
  const { config, setConfig, save } = useAIConfig(STORAGE_KEY);

  return (
    <div className="space-y-1">
      <AISettings
        config={config}
        onChange={setConfig}
        onSave={save}
        modelsApiUrl="/api/ai/models"
        classNames={{
          container: 'border border-[var(--border)] rounded-xl p-6 space-y-5 bg-[var(--card)]/30',
          field: '',
          label:
            'block text-xs font-medium text-[var(--muted-foreground)] mb-1.5 uppercase tracking-wider',
          input: 'input-base flex-1',
          button:
            'px-3 py-2 text-xs font-medium rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-40 transition-colors shrink-0',
          dropdown: 'rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-lg',
          dropdownItem:
            'w-full px-3 py-2 text-left text-sm text-foreground hover:bg-[var(--muted)] transition-colors',
          saveButton:
            'px-5 py-2.5 text-sm font-medium rounded-lg transition-all bg-white text-gray-900 hover:bg-gray-200',
          error: 'text-xs text-red-400',
          hint: 'text-xs text-[var(--muted-foreground)]',
          modelRow: '',
        }}
        labels={{
          endpointUrl: 'Endpoint URL',
          apiKey: 'API Key',
          model: 'Model',
          save: 'Save Settings',
          fetchModels: 'Fetch Models',
        }}
        placeholders={{
          endpointUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-...',
          model: 'Enter model name or fetch available models',
        }}
      />
    </div>
  );
}
