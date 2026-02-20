import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/auth";

// 一般ユーザーにも公開可能な設定キー
const PUBLIC_SETTINGS = ["default_drink_id"];

export async function GET(request: NextRequest) {
  try {
    // 認証チェック（ログイン済みであること）
    const employee = await requireAuth(request);

    const settings = await prisma.setting.findMany();

    const settingsObject: Record<string, string> = {};
    for (const s of settings) {
      // 管理者の場合はすべての設定を返す
      // 一般ユーザーの場合は公開設定のみ返す
      if (employee.role === "admin" || PUBLIC_SETTINGS.includes(s.key)) {
        settingsObject[s.key] = s.value;
      }
    }

    return NextResponse.json(settingsObject);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Get settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    requireAdmin(request);

    const body = await request.json();

    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json(
        { error: "Body must be a key-value object" },
        { status: 400 }
      );
    }

    const entries = Object.entries(body as Record<string, string>);

    for (const [key, value] of entries) {
      if (typeof key !== "string" || typeof value !== "string") {
        return NextResponse.json(
          { error: "All keys and values must be strings" },
          { status: 400 }
        );
      }
    }

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        })
      )
    );

    // Return updated settings
    const settings = await prisma.setting.findMany();
    const settingsObject: Record<string, string> = {};
    for (const s of settings) {
      settingsObject[s.key] = s.value;
    }

    return NextResponse.json(settingsObject);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Update settings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
