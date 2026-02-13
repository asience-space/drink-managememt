import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { transactionSchema } from "@/lib/validations";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    const payload = requireAuth(request);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const employeeId = searchParams.get("employeeId");
    const drinkId = searchParams.get("drinkId");
    const type = searchParams.get("type");
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

    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }

    if (drinkId) {
      where.drinkId = parseInt(drinkId, 10);
    }

    if (type && (type === "takeout" || type === "return")) {
      where.type = type;
    }

    const [data, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          employee: { select: { name: true, employeeCode: true } },
          drink: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.transaction.count({ where }),
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
    console.error("Get transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = requireAuth(request);

    const body = await request.json();
    const parsed = transactionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { drinkId, quantity, type, customerName } = parsed.data;
    const isReturn = type === "return";

    const drink = await prisma.drink.findUnique({
      where: { id: drinkId },
    });

    if (!drink) {
      return NextResponse.json({ error: "Drink not found" }, { status: 404 });
    }

    // 取り出し時のみ在庫チェック
    if (!isReturn && drink.stock < quantity) {
      return NextResponse.json(
        { error: "Insufficient stock", currentStock: drink.stock },
        { status: 400 }
      );
    }

    const [transaction, updatedDrink] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          employeeId: payload.sub,
          drinkId,
          quantity,
          type,
          customerName,
        },
        include: {
          employee: { select: { name: true, employeeCode: true } },
          drink: { select: { name: true } },
        },
      }),
      prisma.drink.update({
        where: { id: drinkId },
        data: {
          stock: isReturn
            ? { increment: quantity }
            : { decrement: quantity },
        },
      }),
    ]);

    return NextResponse.json(
      { ...transaction, drink: { ...transaction.drink, stock: updatedDrink.stock } },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
