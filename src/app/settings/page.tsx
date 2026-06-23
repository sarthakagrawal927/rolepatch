import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure your AI provider for resume tailoring
        </p>
      </div>
      <SettingsForm />
    </main>
  );
}
