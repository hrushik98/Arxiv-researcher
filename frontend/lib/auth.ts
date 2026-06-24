/**
 * Current-user helper, backed by Clerk.
 *
 * Returns the same `{ sub, email }` shape the app already relied on, so route
 * handlers and pages keep working unchanged:
 *   - `sub`   → Clerk user id (e.g. "user_2ab…"); used as the DB `user_id`.
 *   - `email` → the user's primary email address.
 */
import { auth, currentUser } from "@clerk/nextjs/server";

export type SessionUser = {
  sub: string;
  email: string;
};

/** Returns the signed-in user, or null when unauthenticated. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const email =
    user?.primaryEmailAddress?.emailAddress ??
    user?.emailAddresses[0]?.emailAddress ??
    "";

  return { sub: userId, email };
}
