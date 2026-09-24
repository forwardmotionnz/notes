/*
  Token broker for the notes app's GitHub App.

  It exists for one reason: GitHub requires the client secret to turn a
  sign-in code into a token, and a static web page cannot keep a secret.
  So this holds the secret and does that one swap, plus the refresh every
  eight hours. It stores nothing and logs nothing. Your notes never pass
  through it: once the browser has a token it talks to api.github.com
  directly.

  Environment (set these in Cloudflare, never in the code):
    CLIENT_ID       GitHub App client ID              (plain variable)
    CLIENT_SECRET   GitHub App client secret          (secret)
    ALLOWED_ORIGIN  where the app is served, e.g. https://you.github.io
    REDIRECT_URI    the app's exact URL, e.g. https://you.github.io/notes/

  It is a standard fetch handler, so it also runs on Deno Deploy, Bun, or
  anything else that speaks Request/Response.
*/

const TOKEN_URL = "https://github.com/login/oauth/access_token";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const allowed = !!env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN;

    const cors = allowed
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        }
      : { "Vary": "Origin" };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: allowed ? 204 : 403, headers: cors });
    }
    // Only the app's own origin may use this. It is not an open proxy.
    if (!allowed) return reply({ error: "origin_not_allowed" }, 403, cors);
    if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405, cors);
    if (!env.CLIENT_ID || !env.CLIENT_SECRET || !env.REDIRECT_URI) {
      return reply({ error: "broker_not_configured" }, 500, cors);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return reply({ error: "bad_json" }, 400, cors);
    }

    const form = new URLSearchParams({
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
    });

    if (isToken(body.code) && isToken(body.code_verifier)) {
      // Sign-in. PKCE is required: a code arriving without the verifier the
      // app generated is not something this broker will exchange.
      form.set("code", body.code);
      form.set("code_verifier", body.code_verifier);
      form.set("redirect_uri", env.REDIRECT_URI);
    } else if (isToken(body.refresh_token)) {
      form.set("grant_type", "refresh_token");
      form.set("refresh_token", body.refresh_token);
    } else {
      return reply({ error: "bad_request" }, 400, cors);
    }

    let res, data;
    try {
      res = await fetch(TOKEN_URL, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "notes-token-broker",
        },
        body: form.toString(),
      });
      data = await res.json();
    } catch {
      return reply({ error: "github_unreachable" }, 502, cors);
    }

    // GitHub reports grant failures (expired code, reused refresh token) as
    // 200 with an "error" field. Pass the code through so the app can decide
    // to sign out, but never echo anything else back.
    if (!res.ok || data.error || !data.access_token) {
      return reply({
        error: String(data.error || "exchange_failed"),
        error_description: String(data.error_description || ""),
      }, 400, cors);
    }

    return reply({
      access_token: data.access_token,
      expires_in: Number(data.expires_in) || 0,
      refresh_token: data.refresh_token || "",
      refresh_token_expires_in: Number(data.refresh_token_expires_in) || 0,
    }, 200, cors);
  },
};

// Codes, verifiers and tokens are short opaque strings. Anything else is junk.
function isToken(v) {
  return typeof v === "string" && v.length > 0 && v.length <= 512 && /^[\w.~-]+$/.test(v);
}

function reply(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
