import { SettingsForm } from '@/components/settings-form';

export default function SettingsPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8">AI Provider Settings</h1>
      <SettingsForm />
    </main>
  );
}
