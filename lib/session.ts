import { createHmac, timingSafeEqual } from "node:crypto";

export type AppSession = {
  sub: string;
  username: string;
  role: "passenger";
  exp: number;
};

const SESSION_LIFETIME_SECONDS = 60 * 60 * 12;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters");
  return secret;
}

export function issueSessionToken(input: Omit<AppSession, "exp">): string {
  const payload: AppSession = { ...input, exp: Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SECONDS };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  return encoded + "." + signature;
}

export function verifySessionToken(token: string | undefined): AppSession | null {
  if (!token || token.length > 2048) return null;
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra !== undefined) return null;
  try {
    const expected = createHmac("sha256", getSessionSecret()).update(encoded).digest();
    const supplied = Buffer.from(suppliedSignature, "base64url");
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as AppSession;
    if (typeof payload.sub !== "string" || typeof payload.username !== "string" || payload.role !== "passenger" || typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_LIFETIME_SECONDS,
};
