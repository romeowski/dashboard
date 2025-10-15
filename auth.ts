// auth.ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import authConfig from './auth.config';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import postgres from 'postgres';

// DB client
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// Modella l'utente che leggi dal DB
type DBUser = {
  id: number | string;
  name: string | null;
  email: string;
  password: string; // hash bcrypt
};

// Recupera un utente dal DB
async function getUser(email: string): Promise<DBUser | null> {
  const rows = await sql/* sql */`
    SELECT id, name, email, password
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  return rows[0] ?? null;
}

// Validazione delle credenziali del form di login
const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'Credentials',
      authorize: async (credentials) => {
        const parsed = CredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await getUser(email);
        if (!user) return null;

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;

        // return "public" user object per la session
        return { id: String(user.id), name: user.name ?? user.email, email: user.email };
      },
    }),
  ],
  // (facoltativo) callback per includere info extra nel JWT/session
  // callbacks: { jwt, session, ... }
});
