import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

/**
 * DELETE /api/inventory-checks/cleanup
 * 1年以上前の棚卸し記録を削除する
 */
export async function DELETE(request: NextRequest) {
  try {
    requireAdmin(request);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await prisma.inventoryCheck.deleteMany({
      where: {
        createdAt: {
          lt: oneYearAgo,
        },
      },
    });

    return NextResponse.json({
      deleted: result.count,
      message: `${result.count}件の棚卸し記録を削除しました（1年以上前のデータ）`,
      cutoffDate: oneYearAgo.toISOString(),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Cleanup inventory checks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
