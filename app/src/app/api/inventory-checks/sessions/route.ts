import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";

/**
 * GET /api/inventory-checks/sessions
 * 棚卸しセッション一覧を取得する（同じ日時の棚卸しをグループ化）
 */
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

    // セッション（同じ createdAt + employeeId の組み合わせ）を取得
    const allChecks = await prisma.inventoryCheck.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeCode: true } },
        drink: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    // createdAtの秒単位でグループ化（同じ棚卸しセッション）
    const sessionMap = new Map<string, typeof allChecks>();
    for (const check of allChecks) {
      // 同じ秒に作成された同じ実施者の記録をグループ化
      const key = `${Math.floor(new Date(check.createdAt).getTime() / 1000)}_${check.employeeId}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, []);
      }
      sessionMap.get(key)!.push(check);
    }

    const sessions = Array.from(sessionMap.entries()).map(([, checks]) => {
      const hasDiff = checks.some((c) => c.diff !== 0);
      const totalDiff = checks.reduce((sum, c) => sum + Math.abs(c.diff), 0);
      return {
        createdAt: checks[0].createdAt,
        employee: checks[0].employee,
        hasDiff,
        totalDiff,
        drinkCount: checks.length,
        checks: checks.map((c) => ({
          id: c.id,
          drinkName: c.drink.name,
          systemStock: c.systemStock,
          actualStock: c.actualStock,
          diff: c.diff,
        })),
      };
    });

    const total = sessions.length;
    const paginatedSessions = sessions.slice((page - 1) * limit, page * limit);

    return NextResponse.json({
      data: paginatedSessions,
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
    console.error("Get inventory check sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
