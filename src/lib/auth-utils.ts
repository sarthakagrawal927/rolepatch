import { headers } from 'next/headers';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function getCurrentUserId(requestHeaders?: Headers): Promise<string | null> {
  const session = await auth.api.getSession({ headers: requestHeaders ?? (await headers()) });
  const user = session?.user;
  if (!user?.id) return null;

  // Lazy sync: ensure user exists in app users table with token balance
  try {
    await db.execute({
      sql: `INSERT INTO users (id, email, name, image)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(email) DO UPDATE SET name = ?, image = ?, updated_at = unixepoch()`,
      args: [
        user.id,
        user.email!,
        user.name ?? '',
        user.image ?? '',
        user.name ?? '',
        user.image ?? '',
      ],
    });
    await db.execute({
      sql: `INSERT OR IGNORE INTO token_balances (user_id, balance, total_purchased, total_used) VALUES (?, 3, 0, 0)`,
      args: [user.id],
    });
  } catch {
    // non-fatal
  }

  return user.id;
}
