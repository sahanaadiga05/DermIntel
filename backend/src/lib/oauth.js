const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

function requireOauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback";

  if (!clientId || !clientSecret) {
    const error = new Error("Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
    error.statusCode = 500;
    throw error;
  }

  return {
    clientId,
    clientSecret,
    callbackUrl
  };
}

export function getGoogleAuthUrl(state) {
  const { clientId, callbackUrl } = requireOauthConfig();
  const url = new URL(GOOGLE_AUTH_URL);

  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);

  return url.toString();
}

export async function exchangeCodeForGoogleProfile(code) {
  const { clientId, clientSecret, callbackUrl } = requireOauthConfig();
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl,
      grant_type: "authorization_code"
    })
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    const error = new Error("Google token exchange failed.");
    error.statusCode = 502;
    error.details = details;
    throw error;
  }

  const tokenPayload = await tokenResponse.json();
  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${tokenPayload.access_token}`
    }
  });

  if (!userInfoResponse.ok) {
    const details = await userInfoResponse.text();
    const error = new Error("Unable to fetch Google user profile.");
    error.statusCode = 502;
    error.details = details;
    throw error;
  }

  const profile = await userInfoResponse.json();

  return {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name || profile.given_name || "DermIntel User",
    avatarUrl: profile.picture || null
  };
}

