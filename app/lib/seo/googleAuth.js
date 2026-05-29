import crypto from "crypto";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const tokenCache = new Map();

export async function getAccessToken(scope) {
  const nowSec = Math.floor(Date.now() / 1000);
  const cached = tokenCache.get(scope);
  if (cached && cached.expiresAt > nowSec + 60) {
    return cached.token;
  }

  const email = process.env.GOOGLE_INDEXING_SA_EMAIL;
  const rawKey = process.env.GOOGLE_INDEXING_SA_PRIVATE_KEY;
  if (!email || !rawKey) {
    throw new Error(
      "GOOGLE_INDEXING_SA_EMAIL o GOOGLE_INDEXING_SA_PRIVATE_KEY no configurados",
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");

  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: email,
      scope,
      aud: TOKEN_ENDPOINT,
      exp: nowSec + 3600,
      iat: nowSec,
    }),
  ).toString("base64url");

  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(`${header}.${claims}`), privateKey)
    .toString("base64url");
  const jwt = `${header}.${claims}.${signature}`;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OAuth token error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  tokenCache.set(scope, {
    token: data.access_token,
    expiresAt: nowSec + (data.expires_in ?? 3600),
  });
  return data.access_token;
}
