import "server-only";
import { Pool } from "@neondatabase/serverless";
import { encryptSecret, hashToken, randomToken } from "./crypto";
import { setUserSessionCookie } from "./auth";

const globalForLogin = globalThis as unknown as { pointedLoginPool?: Pool };

/** Only the validated OAuth callback uses this connection. The login role has
 * EXECUTE on complete_login, no table privileges and no runtime-role membership. */
export async function completeLogin(input: {
  linearUserId: string; organizationId: string; email: string; displayName: string;
  avatarUrl?: string | null; accessToken: string; refreshToken: string; scopes: string[]; expiresAt: Date;
}) {
  if (!process.env.AUTH_DATABASE_URL) throw new Error("AUTH_DATABASE_URL is required");
  const pool = globalForLogin.pointedLoginPool ??= new Pool({ connectionString: process.env.AUTH_DATABASE_URL });
  const token = randomToken();
  const expires = new Date(Date.now() + 14 * 24 * 60 * 60_000);
  await pool.query("select pointed_private.complete_login($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)", [
    input.linearUserId, input.organizationId, input.email, input.displayName, input.avatarUrl ?? null,
    encryptSecret(input.accessToken), encryptSecret(input.refreshToken), input.scopes, input.expiresAt,
    hashToken(token), expires,
  ]);
  await setUserSessionCookie(token, expires);
}
