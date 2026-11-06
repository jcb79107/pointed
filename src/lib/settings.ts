import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userSettings } from "@/db/schema";
import type { UserSettings } from "@/lib/domain";
import {
  parseUserSettings,
  userSettingsSchema,
} from "@/lib/preferences";

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return parseUserSettings(row);
}

export async function saveUserSettings(
  userId: string,
  input: UserSettings,
): Promise<UserSettings> {
  const value = parseUserSettings(userSettingsSchema.parse(input));
  const persisted = {
    ...value,
    updatedAt: new Date(),
  };
  const [row] = await db
    .insert(userSettings)
    .values({ userId, ...persisted })
    .onConflictDoUpdate({ target: userSettings.userId, set: persisted })
    .returning();
  return parseUserSettings(row);
}
