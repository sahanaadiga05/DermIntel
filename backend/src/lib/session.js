import jwt from "jsonwebtoken";

function getSecret() {
  return process.env.JWT_SECRET || "dev-secret";
}

export function createAppToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      provider: user.provider || "GOOGLE"
    },
    getSecret(),
    { expiresIn: "7d" }
  );
}

export function verifyAppToken(token) {
  return jwt.verify(token, getSecret());
}

export function createOauthState(returnTo = "/dashboard") {
  return jwt.sign(
    {
      returnTo
    },
    getSecret(),
    { expiresIn: "10m" }
  );
}

export function readOauthState(state) {
  if (!state) {
    return { returnTo: "/dashboard" };
  }

  try {
    return jwt.verify(state, getSecret());
  } catch (_error) {
    return { returnTo: "/dashboard" };
  }
}

export function buildFrontendAuthRedirect({ token, needsOnboarding = false, error, returnTo }) {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const redirectUrl = new URL("/auth/callback", frontendUrl);

  if (token) {
    redirectUrl.searchParams.set("token", token);
  }

  if (typeof needsOnboarding === "boolean") {
    redirectUrl.searchParams.set("needsOnboarding", needsOnboarding ? "1" : "0");
  }

  if (error) {
    redirectUrl.searchParams.set("error", error);
  }

  if (returnTo) {
    redirectUrl.searchParams.set("returnTo", returnTo);
  }

  return redirectUrl.toString();
}

