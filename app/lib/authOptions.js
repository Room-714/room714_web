import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions = {
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
    signIn: "/auth/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
