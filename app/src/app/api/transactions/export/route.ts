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
    const employeeId = searchParams.get("employeeId");
    const drinkId = searchParams.get("drinkId");

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

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeCode: true } },
        drink: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const headers = [
      "日時",
      "種別",
      "社員番号",
      "社員名",
      "ドリンク名",
      "数量",
      "お客様名",
    ];

    const rows = transactions.map((t) => [
      new Date(t.createdAt).toLocaleString("ja-JP", {
        timeZone: "Asia/Tokyo",
      }),
      t.type === "return" ? "返却" : "取り出し",
      t.employee.employeeCode,
      t.employee.name,
      t.drink.name,
      String(t.quantity),
      t.customerName || "",
    ]);

    const csv = generateCsv(headers, rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Export transactions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
