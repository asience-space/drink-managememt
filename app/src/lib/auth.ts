import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";
import { AuthPayload } from "@/types";
import { LOCKOUT_MAX_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from "./constants";

const JWT_SECRET = process.env.JWT_SECRET!;

// --- JWT utilities ---

export function signToken(employee: {
  id: number;
  employeeCode: string;
  name: string;
  role: string;
}): string {
  return jwt.sign(
    {
      sub: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
    },
    JWT_SECRET,
    { expiresIn: "30m" }
  );
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as unknown as AuthPayload;
}

export function getEmployeeFromRequest(
  request: NextRequest
): AuthPayload | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

export function requireAuth(request: NextRequest): AuthPayload {
  const payload = getEmployeeFromRequest(request);
  if (!payload) {
    throw new Error("Unauthorized");
  }
  return payload as {
    sub: number;
    employeeCode: string;
    name: string;
    role: string;
  };
}

export function requireAdmin(request: NextRequest): AuthPayload {
  const payload = requireAuth(request);
  if (payload.role !== "admin") {
    throw new Error("Forbidden");
  }
  return payload;
}

// --- Lockout mechanism ---

interface LockoutEntry {
  attempts: number;
  lockedUntil: Date | null;
}

const lockoutMap = new Map<string, LockoutEntry>();

export function checkLockout(ip: string): {
  locked: boolean;
  remainingMs?: number;
} {
  const entry = lockoutMap.get(ip);
  if (!entry) return { locked: false };

  if (entry.lockedUntil) {
    const now = new Date();
    if (now < entry.lockedUntil) {
      return {
        locked: true,
        remainingMs: entry.lockedUntil.getTime() - now.getTime(),
      };
    }
    // Lockout expired — reset
    lockoutMap.delete(ip);
    return { locked: false };
  }

  return { locked: false };
}

export function recordFailedAttempt(ip: string): void {
  const entry = lockoutMap.get(ip) || { attempts: 0, lockedUntil: null };
  entry.attempts += 1;

  if (entry.attempts >= LOCKOUT_MAX_ATTEMPTS) {
    entry.lockedUntil = new Date(
      Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000
    );
  }

  lockoutMap.set(ip, entry);
}

export function resetAttempts(ip: string): void {
  lockoutMap.delete(ip);
}
