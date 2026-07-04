import { ExtensionSetupCard } from '@/components/extension-setup-card';
import { OperationalReadinessCard } from '@/components/operational-readiness-card';
import { SettingsForm } from '@/components/settings-form';
import { getOperationalReadiness } from '@/lib/operational-readiness';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const readiness = await getOperationalReadiness();

  return (
    <main className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure your AI provider and production runtime readiness
        </p>
      </div>
      <div className="space-y-6">
        <OperationalReadinessCard readiness={readiness} />
        <ExtensionSetupCard />
        <SettingsForm />
      </div>
    </main>
  );
}
