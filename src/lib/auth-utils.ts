import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return (session as any)?.userId ?? null;
}
