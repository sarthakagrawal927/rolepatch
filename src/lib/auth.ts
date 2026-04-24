import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { db } from '@/lib/db';

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      await db.execute({
        sql: `INSERT INTO users (id, email, name, image)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(email) DO UPDATE SET name = ?, image = ?, updated_at = unixepoch()`,
        args: [
          crypto.randomUUID(),
          user.email,
          user.name ?? '',
          user.image ?? '',
          user.name ?? '',
          user.image ?? '',
        ],
      });

      // Initialize token balance for new users (3 free tokens)
      const result = await db.execute({
        sql: 'SELECT id FROM users WHERE email = ?',
        args: [user.email],
      });
      const userId = result.rows[0]?.id as string;
      if (userId) {
        await db.execute({
          sql: `INSERT OR IGNORE INTO token_balances (user_id, balance, total_purchased, total_used) VALUES (?, 3, 0, 0)`,
          args: [userId],
        });
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const result = await db.execute({
          sql: 'SELECT id FROM users WHERE email = ?',
          args: [user.email],
        });
        const row = result.rows[0];
        if (row) token.userId = row.id as string;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.userId && session.user) {
        session.user.id = token.userId as string;
      }
      return session;
    },
  },
});
