import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkLockout,
  recordFailedAttempt,
  resetAttempts,
  signToken,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { employeeCode } = parsed.data;
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    const lockout = checkLockout(ip);
    if (lockout.locked) {
      return NextResponse.json(
        {
          error: "Too many failed attempts. Please try again later.",
          remainingMs: lockout.remainingMs,
        },
        { status: 429 }
      );
    }

    const employee = await prisma.employee.findFirst({
      where: { employeeCode, isActive: true },
    });

    if (!employee) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: "Invalid employee code" },
        { status: 401 }
      );
    }

    resetAttempts(ip);

    const token = signToken({
      id: employee.id,
      employeeCode: employee.employeeCode,
      name: employee.name,
      role: employee.role,
    });

    return NextResponse.json({
      token,
      employee: {
        id: employee.id,
        employeeCode: employee.employeeCode,
        name: employee.name,
        role: employee.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
