import { getAccessToken } from "./googleAuth";

const SCOPE = "https://www.googleapis.com/auth/siteverification";
const BASE = "https://www.googleapis.com/siteVerification/v1";

const SITE = { identifier: "room714.com", type: "INET_DOMAIN" };
const METHOD = "DNS_TXT";

export async function getDnsTxtToken() {
  const token = await getAccessToken(SCOPE);
  const res = await fetch(`${BASE}/token`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site: SITE,
      verificationMethod: METHOD,
    }),
  });
  if (!res.ok) {
    throw new Error(
      `SiteVerification getToken ${res.status}: ${await res.text()}`,
    );
  }
  return res.json();
}

export async function claimOwnership() {
  const token = await getAccessToken(SCOPE);
  const res = await fetch(
    `${BASE}/webResource?verificationMethod=${METHOD}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ site: SITE }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `SiteVerification insert ${res.status}: ${await res.text()}`,
    );
  }
  return res.json();
}
