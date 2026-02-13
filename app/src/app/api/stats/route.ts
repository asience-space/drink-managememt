import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const { searchParams } = new URL(request.url);
    const days = Math.min(
      Math.max(1, parseInt(searchParams.get("days") || "30", 10)),
      90
    );

    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    // Fetch all transactions in the period
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        drink: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // 1. Per-employee consumption ranking (net: takeout - return)
    const employeeMap = new Map<
      number,
      { id: number; name: string; employeeCode: string; totalQuantity: number }
    >();
    for (const t of transactions) {
      const delta = t.type === "return" ? -t.quantity : t.quantity;
      const existing = employeeMap.get(t.employee.id);
      if (existing) {
        existing.totalQuantity += delta;
      } else {
        employeeMap.set(t.employee.id, {
          id: t.employee.id,
          name: t.employee.name,
          employeeCode: t.employee.employeeCode,
          totalQuantity: delta,
        });
      }
    }
    const employeeRanking = Array.from(employeeMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 20);

    // 2. Per-drink consumption breakdown
    const drinkMap = new Map<
      number,
      { id: number; name: string; totalQuantity: number }
    >();
    for (const t of transactions) {
      const delta = t.type === "return" ? -t.quantity : t.quantity;
      const existing = drinkMap.get(t.drink.id);
      if (existing) {
        existing.totalQuantity += delta;
      } else {
        drinkMap.set(t.drink.id, {
          id: t.drink.id,
          name: t.drink.name,
          totalQuantity: delta,
        });
      }
    }
    const drinkBreakdown = Array.from(drinkMap.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity);

    // 3. Daily trend (by date)
    const dailyMap = new Map<string, number>();
    for (let i = 0; i <= days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyMap.set(dateKey, 0);
    }
    for (const t of transactions) {
      const dateKey = new Date(t.createdAt).toISOString().slice(0, 10);
      const delta = t.type === "return" ? -t.quantity : t.quantity;
      dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + delta);
    }
    const dailyTrend = Array.from(dailyMap.entries())
      .map(([date, quantity]) => ({ date, quantity }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 4. Stock depletion pace (average daily consumption per drink)
    const drinkDailyMap = new Map<number, { name: string; dailyTotals: Map<string, number> }>();
    for (const t of transactions) {
      const dateKey = new Date(t.createdAt).toISOString().slice(0, 10);
      const delta = t.type === "return" ? -t.quantity : t.quantity;
      if (!drinkDailyMap.has(t.drink.id)) {
        drinkDailyMap.set(t.drink.id, { name: t.drink.name, dailyTotals: new Map() });
      }
      const entry = drinkDailyMap.get(t.drink.id)!;
      entry.dailyTotals.set(dateKey, (entry.dailyTotals.get(dateKey) || 0) + delta);
    }

    // Get current stock for each drink
    const activeDrinks = await prisma.drink.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stock: true },
      orderBy: { sortOrder: "asc" },
    });

    const stockDepletion = activeDrinks.map((drink) => {
      const drinkData = drinkDailyMap.get(drink.id);
      let avgDaily = 0;
      if (drinkData) {
        const totalConsumption = Array.from(drinkData.dailyTotals.values()).reduce(
          (sum, v) => sum + v,
          0
        );
        avgDaily = totalConsumption / days;
      }
      const daysUntilEmpty = avgDaily > 0 ? Math.ceil(drink.stock / avgDaily) : null;
      return {
        id: drink.id,
        name: drink.name,
        currentStock: drink.stock,
        avgDailyConsumption: Math.round(avgDaily * 10) / 10,
        daysUntilEmpty,
      };
    });

    // 5. Per-drink daily trend (top 5 drinks)
    const topDrinkIds = drinkBreakdown.slice(0, 5).map((d) => d.id);
    const drinkDailyTrend: Record<string, { date: string; quantity: number }[]> = {};
    for (const drinkId of topDrinkIds) {
      const drinkData = drinkDailyMap.get(drinkId);
      const drinkName = drinkBreakdown.find((d) => d.id === drinkId)?.name || "";
      if (drinkData) {
        const trend = Array.from(dailyMap.keys())
          .sort()
          .map((date) => ({
            date,
            quantity: drinkData.dailyTotals.get(date) || 0,
          }));
        drinkDailyTrend[drinkName] = trend;
      }
    }

    return NextResponse.json({
      period: { days, from: startDate.toISOString(), to: now.toISOString() },
      employeeRanking,
      drinkBreakdown,
      dailyTrend,
      stockDepletion,
      drinkDailyTrend,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
