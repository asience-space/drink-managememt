import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    // Stock summary: all active drinks
    const stockSummary = await prisma.drink.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        stock: true,
        imageUrl: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    // Today's consumption: group by drinkId
    const todayTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        drink: { select: { name: true } },
      },
    });

    const consumptionMap = new Map<
      number,
      { drinkId: number; name: string; totalQuantity: number; returnQuantity: number }
    >();
    for (const t of todayTransactions) {
      const isTakeout = t.type !== "return";
      const existing = consumptionMap.get(t.drinkId);
      if (existing) {
        if (isTakeout) {
          existing.totalQuantity += t.quantity;
        } else {
          existing.returnQuantity += t.quantity;
        }
      } else {
        consumptionMap.set(t.drinkId, {
          drinkId: t.drinkId,
          name: t.drink.name,
          totalQuantity: isTakeout ? t.quantity : 0,
          returnQuantity: isTakeout ? 0 : t.quantity,
        });
      }
    }
    const todayConsumption = Array.from(consumptionMap.values());

    // Today's total (net: takeout - return)
    const todayTotal = todayTransactions.reduce(
      (sum, t) => sum + (t.type === "return" ? -t.quantity : t.quantity),
      0
    );
    const todayReturnTotal = todayTransactions
      .filter((t) => t.type === "return")
      .reduce((sum, t) => sum + t.quantity, 0);

    // Recent alerts: inventory checks from last 7 days where diff != 0
    const recentCheckRecords = await prisma.inventoryCheck.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
        diff: { not: 0 },
      },
      include: {
        drink: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // Group by createdAt rounded to minute
    const alertGroupMap = new Map<
      string,
      { id: number; createdAt: string; diffs: { drinkName: string; diff: number }[] }
    >();
    for (const check of recentCheckRecords) {
      const roundedDate = new Date(check.createdAt);
      roundedDate.setSeconds(0, 0);
      const key = roundedDate.toISOString();

      const existing = alertGroupMap.get(key);
      if (existing) {
        existing.diffs.push({ drinkName: check.drink.name, diff: check.diff });
      } else {
        alertGroupMap.set(key, {
          id: check.id,
          createdAt: key,
          diffs: [{ drinkName: check.drink.name, diff: check.diff }],
        });
      }
    }
    const recentAlerts = Array.from(alertGroupMap.values());

    // Weekly trend: transactions grouped by date for last 7 days
    const weekTransactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        quantity: true,
        type: true,
        createdAt: true,
      },
    });

    const trendMap = new Map<string, number>();
    // Initialize all 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      trendMap.set(dateKey, 0);
    }
    // Also include today
    trendMap.set(now.toISOString().slice(0, 10), 0);

    for (const t of weekTransactions) {
      const dateKey = new Date(t.createdAt).toISOString().slice(0, 10);
      const delta = t.type === "return" ? -t.quantity : t.quantity;
      trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + delta);
    }

    const weeklyTrend = Array.from(trendMap.entries())
      .map(([date, totalQuantity]) => ({ date, totalQuantity }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      stockSummary,
      todayConsumption,
      todayTotal,
      todayReturnTotal,
      recentAlerts,
      weeklyTrend,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
