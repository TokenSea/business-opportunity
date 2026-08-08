import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "bo_session";
const SESSION_TTL = 60 * 60 * 24 * 7;

export type SessionUser = {
  id: string;
  username: string;
  role: "ADMIN" | "USER";
};

function authSecret() {
  const configured = process.env.AUTH_SECRET;
  if (configured) return new TextEncoder().encode(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET 未配置");
  }
  return new TextEncoder().encode("development-only-auth-secret-change-me");
}

function sessionCookieSecure() {
  const configured = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (configured === "true") return true;
  if (configured === "false") return false;
  if (configured) {
    throw new Error("AUTH_COOKIE_SECURE 必须配置为 true 或 false");
  }
  return process.env.NODE_ENV === "production";
}

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ username: user.username, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(authSecret());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: SESSION_TTL,
  });
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 0,
  });
}

export async function getSessionPayload(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret());
    if (!payload.sub || typeof payload.username !== "string") return null;
    if (payload.role !== "ADMIN" && payload.role !== "USER") return null;
    return { id: payload.sub, username: payload.username, role: payload.role };
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSessionPayload();
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, username: true, role: true, enabled: true },
  });
  if (!user?.enabled) return null;
  return { id: user.id, username: user.username, role: user.role };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
