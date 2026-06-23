import { describe, expect, test } from "bun:test";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE,
} from "@/lib/session";

describe("session tokens", () => {
  test("round-trips a valid session payload", async () => {
    const token = await createSessionToken({ sub: "user-123", email: "a@b.com" });
    const payload = await verifySessionToken(token);
    expect(payload).toEqual({ sub: "user-123", email: "a@b.com" });
  });

  test("returns null for a missing token", async () => {
    expect(await verifySessionToken(undefined)).toBeNull();
  });

  test("returns null for a tampered token", async () => {
    const token = await createSessionToken({ sub: "u", email: "a@b.com" });
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "b" : "a");
    expect(await verifySessionToken(tampered)).toBeNull();
  });

  test("cookie name is stable", () => {
    expect(SESSION_COOKIE).toBe("session");
  });
});
