import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireAdmin } from "@/lib/auth";
import { drinkSchema } from "@/lib/validations";

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const { searchParams } = new URL(request.url);
    const active = searchParams.get("active");

    const where = active === "false" ? {} : { isActive: true };

    const drinks = await prisma.drink.findMany({
      where,
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json(drinks);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Get drinks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);

    const body = await request.json();
    const parsed = drinkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const drink = await prisma.drink.create({
      data: parsed.data,
    });

    return NextResponse.json(drink, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Create drink error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
