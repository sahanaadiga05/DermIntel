import { randomUUID } from "node:crypto";
import { profiles, users } from "../data/mock-data.js";
import { expandStoredProfile } from "./profile-schema.js";

let prismaClientPromise;

function nowIso() {
  return new Date().toISOString();
}

async function getPrismaClient() {
  if (prismaClientPromise !== undefined) {
    return prismaClientPromise;
  }

  prismaClientPromise = (async () => {
    if (!process.env.DATABASE_URL) {
      return null;
    }

    try {
      const prismaModule = await import("@prisma/client");
      const client = new prismaModule.PrismaClient();
      await client.$connect();
      return client;
    } catch (error) {
      console.warn(
        "Prisma client is unavailable or the database is not ready. Falling back to in-memory storage.",
        error.message
      );
      return null;
    }
  })();

  return prismaClientPromise;
}

export function serializeUser(user) {
  return {
    id: user.id,
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    provider: user.provider || "GOOGLE",
    createdAt: user.createdAt
  };
}

function cloneProfile(profile) {
  const expanded = expandStoredProfile(profile);

  return expanded
    ? {
        ...expanded,
        primarySkinConcerns: [...(expanded.primarySkinConcerns || [])],
        hairConcerns: [...(expanded.hairConcerns || [])],
        cosmeticAllergies: [...(expanded.cosmeticAllergies || [])],
        primarySkincareGoals: [...(expanded.primarySkincareGoals || [])],
        haircareGoals: [...(expanded.haircareGoals || [])],
        avoidIngredients: [...(expanded.avoidIngredients || [])]
      }
    : null;
}

export async function findOrCreateGoogleUser(googleProfile) {
  const prisma = await getPrismaClient();

  if (prisma) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }]
      }
    });

    if (existing) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: googleProfile.googleId,
          email: googleProfile.email,
          name: googleProfile.name,
          avatarUrl: googleProfile.avatarUrl
        }
      });
    }

    return prisma.user.create({
      data: {
        googleId: googleProfile.googleId,
        email: googleProfile.email,
        name: googleProfile.name,
        avatarUrl: googleProfile.avatarUrl,
        provider: "GOOGLE"
      }
    });
  }

  const existing = users.find(
    (entry) => entry.googleId === googleProfile.googleId || entry.email === googleProfile.email
  );

  if (existing) {
    existing.googleId = googleProfile.googleId;
    existing.email = googleProfile.email;
    existing.name = googleProfile.name;
    existing.avatarUrl = googleProfile.avatarUrl;
    return existing;
  }

  const user = {
    id: randomUUID(),
    googleId: googleProfile.googleId,
    email: googleProfile.email,
    name: googleProfile.name,
    avatarUrl: googleProfile.avatarUrl,
    provider: "GOOGLE",
    createdAt: nowIso(),
    updatedAt: nowIso()
  };

  users.push(user);
  return user;
}

export async function getUserById(userId) {
  const prisma = await getPrismaClient();

  if (prisma) {
    return prisma.user.findUnique({
      where: { id: userId }
    });
  }

  return users.find((entry) => entry.id === userId) || null;
}

export async function getProfileByUserId(userId) {
  const prisma = await getPrismaClient();

  if (prisma) {
    const profile = await prisma.profile.findUnique({
      where: { userId }
    });

    return cloneProfile(profile);
  }

  return cloneProfile(profiles.find((entry) => entry.userId === userId) || null);
}

export async function upsertProfile(userId, input) {
  const prisma = await getPrismaClient();

  if (prisma) {
    const profile = await prisma.profile.upsert({
      where: { userId },
      update: {
        ...input,
        completedAt: new Date(input.completedAt)
      },
      create: {
        userId,
        ...input,
        completedAt: new Date(input.completedAt)
      }
    });

    return cloneProfile(profile);
  }

  const existingIndex = profiles.findIndex((entry) => entry.userId === userId);
  const nextProfile = {
    id: existingIndex >= 0 ? profiles[existingIndex].id : randomUUID(),
    userId,
    ...input,
    createdAt: existingIndex >= 0 ? profiles[existingIndex].createdAt : nowIso(),
    updatedAt: nowIso()
  };

  if (existingIndex >= 0) {
    profiles[existingIndex] = nextProfile;
  } else {
    profiles.push(nextProfile);
  }

  return cloneProfile(nextProfile);
}
