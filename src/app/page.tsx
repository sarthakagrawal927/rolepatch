import { redirect } from 'next/navigation';

/**
 * Astro owns anon GET `/` in production (landing-astro overlay + run_worker_first).
 * OpenNext fallback sends everyone to the app — landing CTAs already point at /dashboard.
 */
export default function HomePage() {
  redirect('/dashboard');
}
