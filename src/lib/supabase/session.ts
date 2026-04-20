type SupabaseSession = {
  access_token?: string;
};

type SupabaseAuthClient = {
  auth: {
    getSession(): Promise<{
      data: {
        session: SupabaseSession | null;
      };
      error?: unknown;
    }>;
  };
};

function decodeBase64UrlJson(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const decoded =
    typeof atob === "function"
      ? atob(padded)
      : Buffer.from(padded, "base64").toString("utf-8");

  return JSON.parse(decoded) as Record<string, unknown>;
}

function logAccessTokenDiagnostics(accessToken: string, label: string) {
  const [headerPart, claimsPart] = accessToken.split(".");

  if (!headerPart || !claimsPart) {
    console.warn("[auth debug] Supabase access token is not JWT-shaped.", { label });
    return;
  }

  try {
    const header = decodeBase64UrlJson(headerPart);
    const claims = decodeBase64UrlJson(claimsPart);
    const exp = typeof claims.exp === "number" ? claims.exp : null;

    console.info("[auth debug]", {
      label,
      alg: header.alg,
      kid: header.kid,
      sub: claims.sub,
      email: claims.email,
      aud: claims.aud,
      iss: claims.iss,
      expiresAt: exp ? new Date(exp * 1000).toISOString() : null,
      now: new Date().toISOString()
    });
  } catch (error) {
    console.warn("[auth debug] Unable to decode Supabase access token claims.", {
      label,
      error: error instanceof Error ? error.message : "Unknown decode error"
    });
  }
}

export async function getBackendAccessToken(
  supabase: SupabaseAuthClient,
  label: string
): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    console.error("[auth debug] getSession error", error);
    throw error;
  }

  const accessToken = data.session?.access_token;

  if (!accessToken) {
    console.error("[auth debug] no Supabase session access token", { label });
    return null;
  }

  logAccessTokenDiagnostics(accessToken, label);
  return accessToken;
}
