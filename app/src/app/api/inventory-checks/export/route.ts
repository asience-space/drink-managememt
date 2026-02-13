import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { generateCsv } from "@/lib/csv";

export async function GET(request: NextRequest) {
  try {
    requireAuth(request);

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const where: Record<string, unknown> = {};

    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to ? { lte: new Date(to) } : {}),
      };
    }

    const checks = await prisma.inventoryCheck.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeCode: true } },
        drink: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "日時",
      "実施者番号",
      "実施者名",
      "ドリンク名",
      "理論在庫",
      "実在庫",
      "差分",
    ];

    const rows = checks.map((c) => [
      new Date(c.createdAt).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
      c.employee.employeeCode,
      c.employee.name,
      c.drink.name,
      String(c.systemStock),
      String(c.actualStock),
      String(c.diff),
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory_checks_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Export inventory checks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
