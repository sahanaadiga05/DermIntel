import { Router } from "express";
import { normalizeProfileInput, profileInputSchema } from "../lib/profile-schema.js";
import { getProfileByUserId, upsertProfile } from "../lib/store.js";
import { requireAuth } from "../middleware/require-auth.js";

const router = Router();

router.get("/me", requireAuth, async (request, response, next) => {
  try {
    const profile = await getProfileByUserId(request.auth.userId);
    response.json({ profile });
  } catch (error) {
    next(error);
  }
});

router.put("/me", requireAuth, async (request, response, next) => {
  try {
    const payload = profileInputSchema.parse(request.body);
    const profile = await upsertProfile(request.auth.userId, normalizeProfileInput(payload));

    response.json({
      message: "Profile saved successfully.",
      profile
    });
  } catch (error) {
    next(error);
  }
});

export default router;
