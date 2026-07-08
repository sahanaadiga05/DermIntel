import { Router } from "express";
import {
  buildFrontendAuthRedirect,
  createAppToken,
  createOauthState,
  readOauthState
} from "../lib/session.js";
import { exchangeCodeForGoogleProfile, getGoogleAuthUrl } from "../lib/oauth.js";
import { getProfileByUserId, getUserById, findOrCreateGoogleUser, serializeUser } from "../lib/store.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.get("/google/start", (request, response) => {
  const returnTo = typeof request.query.returnTo === "string" ? request.query.returnTo : "/dashboard";
  const state = createOauthState(returnTo);
  response.redirect(getGoogleAuthUrl(state));
});

router.get("/google/callback", async (request, response, next) => {
  try {
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const state = typeof request.query.state === "string" ? request.query.state : "";

    if (!code) {
      return response.redirect(buildFrontendAuthRedirect({ error: "missing_code" }));
    }

    const googleProfile = await exchangeCodeForGoogleProfile(code);
    const user = await findOrCreateGoogleUser(googleProfile);
    const profile = await getProfileByUserId(user.id);
    const token = createAppToken(user);
    const oauthState = readOauthState(state);

    return response.redirect(
      buildFrontendAuthRedirect({
        token,
        needsOnboarding: !profile,
        returnTo: oauthState.returnTo
      })
    );
  } catch (error) {
    next(error);
  }
});

router.get("/me", requireAuth, async (request, response, next) => {
  try {
    const user = await getUserById(request.auth.userId);

    if (!user) {
      return response.status(404).json({ message: "User not found." });
    }

    const profile = await getProfileByUserId(user.id);

    return response.json({
      user: serializeUser(user),
      profile,
      needsOnboarding: !profile
    });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", requireAuth, (_request, response) => {
  response.status(204).send();
});

export default router;

