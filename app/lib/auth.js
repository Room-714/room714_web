import { getToken } from "next-auth/jwt";

/**
 * Autoriza si la request trae:
 * - Authorization: Bearer CRON_SECRET (para llamadas server-to-server / curl tests)
 * - O una cookie de sesión NextAuth válida (admin desde el navegador)
 */
export async function isAuthorizedAdmin(request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${process.env.CRON_SECRET}`) return true;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });
  return !!token;
}
