// auth.config.ts
import type { NextAuthConfig } from 'next-auth';

const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');
      if (isOnDashboard) return isLoggedIn;
      if (isLoggedIn) return Response.redirect(new URL('/dashboard', nextUrl));
      return true;
    },
  },
  providers: [], // i provider li dichiareremo in auth.ts
};

export default authConfig;
