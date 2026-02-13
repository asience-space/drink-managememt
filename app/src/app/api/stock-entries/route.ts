import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { stockEntrySchema } from "@/lib/validations";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const drinkId = searchParams.get("drinkId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(
      1,
      parseInt(searchParams.get("limit") || String(DEFAULT_PAGE_SIZE), 10)
    );

    const where: Record<string, unknown> = {};

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    if (drinkId) {
      where.drinkId = parseInt(drinkId, 10);
    }

    const [data, total] = await Promise.all([
      prisma.stockEntry.findMany({
        where,
        include: {
          employee: { select: { name: true, employeeCode: true } },
          drink: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockEntry.count({ where }),
    ]);

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Get stock entries error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = requireAdmin(request);

    const body = await request.json();
    const parsed = stockEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { drinkId, quantity } = parsed.data;

    const [stockEntry, updatedDrink] = await prisma.$transaction([
      prisma.stockEntry.create({
        data: {
          employeeId: payload.sub,
          drinkId,
          quantity,
        },
        include: {
          employee: { select: { name: true, employeeCode: true } },
          drink: { select: { name: true } },
        },
      }),
      prisma.drink.update({
        where: { id: drinkId },
        data: { stock: { increment: quantity } },
      }),
    ]);

    return NextResponse.json(
      { ...stockEntry, drink: { ...stockEntry.drink, stock: updatedDrink.stock } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Create stock entry error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
