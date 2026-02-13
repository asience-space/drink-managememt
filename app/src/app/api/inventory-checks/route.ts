import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { inventoryCheckSchema } from "@/lib/validations";
import { sendInventoryAlert } from "@/lib/notifications";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
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

    const [data, total] = await Promise.all([
      prisma.inventoryCheck.findMany({
        where,
        include: {
          employee: { select: { name: true, employeeCode: true } },
          drink: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.inventoryCheck.count({ where }),
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
    console.error("Get inventory checks error:", error);
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
    const parsed = inventoryCheckSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { checks } = parsed.data;

    // Get current stock for each drink
    const drinkIds = checks.map((c) => c.drinkId);
    const drinks = await prisma.drink.findMany({
      where: { id: { in: drinkIds } },
    });

    const drinkMap = new Map(drinks.map((d) => [d.id, d]));

    // Build inventory check records
    const checkRecords = checks.map((c) => {
      const drink = drinkMap.get(c.drinkId);
      const systemStock = drink?.stock ?? 0;
      const diff = c.actualStock - systemStock;

      return {
        employeeId: payload.sub,
        drinkId: c.drinkId,
        systemStock,
        actualStock: c.actualStock,
        diff,
      };
    });

    // Create all checks in a transaction
    const createdChecks = await prisma.$transaction(
      checkRecords.map((record) =>
        prisma.inventoryCheck.create({
          data: record,
          include: {
            drink: { select: { name: true } },
          },
        })
      )
    );

    const hasDiff = createdChecks.some((c) => c.diff !== 0);

    let notificationSent = false;
    if (hasDiff) {
      const alertData = createdChecks.map((c) => ({
        drinkName: c.drink.name,
        systemStock: c.systemStock,
        actualStock: c.actualStock,
        diff: c.diff,
      }));

      notificationSent = await sendInventoryAlert(
        alertData,
        payload.name,
        payload.employeeCode
      );
    }

    return NextResponse.json(
      {
        checks: createdChecks,
        hasDiff,
        notificationSent,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Create inventory check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
