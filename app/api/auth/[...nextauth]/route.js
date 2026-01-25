import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (
          credentials.username === process.env.ADMIN_USER &&
          credentials.password === process.env.ADMIN_PASS
        ) {
          return { id: "1", name: "Admin" };
        }
        return null;
      },
    }),
  ],
  pages: {
    signIn: "/auth/login", // Esto le dice a NextAuth dónde está nuestra página
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
