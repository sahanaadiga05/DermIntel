import { verifyAppToken } from "../lib/session.js";

export function requireAuth(request, response, next) {
  const authHeader = request.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return response.status(401).json({ message: "Authentication required." });
  }

  try {
    const payload = verifyAppToken(token);
    request.auth = {
      userId: payload.sub,
      email: payload.email
    };
    return next();
  } catch (_error) {
    return response.status(401).json({ message: "Invalid or expired session." });
  }
}

