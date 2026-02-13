/**
 * 在庫整合性テスト
 *
 * テスト対象:
 * - 取り出し（takeout）で在庫が正しく減少するか
 * - 返却（return）で在庫が正しく増加するか
 * - 入庫（stock-entry）で在庫が正しく増加するか
 * - 棚卸し（inventory-check）で在庫が実在庫に更新されるか
 * - 在庫不足時に取り出しが拒否されるか
 * - 返却は在庫0でも受け付けられるか
 * - 取り出し→返却→入庫→棚卸しの複合操作で整合性が保たれるか
 * - バリデーション（不正な type、0以下の数量など）
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// テスト用ヘルパー: ドリンクの在庫を取得
async function getStock(drinkId: number): Promise<number> {
  const drink = await prisma.drink.findUniqueOrThrow({ where: { id: drinkId } });
  return drink.stock;
}

// テスト用ヘルパー: 取り出し/返却トランザクション（APIロジックの再現）
async function executeTransaction(
  employeeId: number,
  drinkId: number,
  quantity: number,
  type: "takeout" | "return" = "takeout",
  customerName?: string
) {
  const isReturn = type === "return";

  // 在庫チェックとDB更新をアトミックに実行（TOCTOU対策済み）
  const result = await prisma.$transaction(async (tx) => {
    const drink = await tx.drink.findUniqueOrThrow({ where: { id: drinkId } });

    if (!isReturn && drink.stock < quantity) {
      throw new Error(`Insufficient stock: current=${drink.stock}, requested=${quantity}`);
    }

    const transaction = await tx.transaction.create({
      data: { employeeId, drinkId, quantity, type, customerName },
    });

    const updatedDrink = await tx.drink.update({
      where: { id: drinkId },
      data: {
        stock: isReturn ? { increment: quantity } : { decrement: quantity },
      },
    });

    return { transaction, updatedDrink };
  });

  return { transaction: result.transaction, updatedStock: result.updatedDrink.stock };
}

// テスト用ヘルパー: 入庫（APIロジックの再現）
async function executeStockEntry(
  employeeId: number,
  drinkId: number,
  quantity: number
) {
  const [stockEntry, updatedDrink] = await prisma.$transaction([
    prisma.stockEntry.create({
      data: { employeeId, drinkId, quantity },
    }),
    prisma.drink.update({
      where: { id: drinkId },
      data: { stock: { increment: quantity } },
    }),
  ]);

  return { stockEntry, updatedStock: updatedDrink.stock };
}

// テスト用ヘルパー: 棚卸し（APIロジックの再現）
async function executeInventoryCheck(
  employeeId: number,
  checks: { drinkId: number; actualStock: number }[]
) {
  const drinkIds = checks.map((c) => c.drinkId);
  const drinks = await prisma.drink.findMany({ where: { id: { in: drinkIds } } });
  const drinkMap = new Map(drinks.map((d) => [d.id, d]));

  const createdChecks = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const c of checks) {
      const drink = drinkMap.get(c.drinkId);
      const systemStock = drink?.stock ?? 0;
      const diff = c.actualStock - systemStock;

      const check = await tx.inventoryCheck.create({
        data: {
          employeeId,
          drinkId: c.drinkId,
          systemStock,
          actualStock: c.actualStock,
          diff,
        },
      });
      created.push(check);
    }

    for (const c of checks) {
      await tx.drink.update({
        where: { id: c.drinkId },
        data: { stock: c.actualStock },
      });
    }

    return created;
  });

  return createdChecks;
}

// テストデータ
let testEmployeeId: number;
let testDrinkId: number;
let testDrink2Id: number;

describe("在庫整合性テスト", () => {
  beforeAll(async () => {
    // テスト用社員を作成
    const emp = await prisma.employee.create({
      data: {
        employeeCode: `TEST${Date.now()}`,
        name: "テスト社員",
        role: "admin",
      },
    });
    testEmployeeId = emp.id;
  });

  afterAll(async () => {
    // テストデータのクリーンアップ
    await prisma.transaction.deleteMany({ where: { employeeId: testEmployeeId } });
    await prisma.stockEntry.deleteMany({ where: { employeeId: testEmployeeId } });
    await prisma.inventoryCheck.deleteMany({ where: { employeeId: testEmployeeId } });
    if (testDrinkId) await prisma.drink.delete({ where: { id: testDrinkId } }).catch(() => {});
    if (testDrink2Id) await prisma.drink.delete({ where: { id: testDrink2Id } }).catch(() => {});
    await prisma.employee.delete({ where: { id: testEmployeeId } }).catch(() => {});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // テスト用ドリンクを毎回リセット（既存があれば削除して再作成）
    if (testDrinkId) {
      await prisma.transaction.deleteMany({ where: { drinkId: testDrinkId } });
      await prisma.stockEntry.deleteMany({ where: { drinkId: testDrinkId } });
      await prisma.inventoryCheck.deleteMany({ where: { drinkId: testDrinkId } });
      await prisma.drink.delete({ where: { id: testDrinkId } }).catch(() => {});
    }
    if (testDrink2Id) {
      await prisma.transaction.deleteMany({ where: { drinkId: testDrink2Id } });
      await prisma.stockEntry.deleteMany({ where: { drinkId: testDrink2Id } });
      await prisma.inventoryCheck.deleteMany({ where: { drinkId: testDrink2Id } });
      await prisma.drink.delete({ where: { id: testDrink2Id } }).catch(() => {});
    }

    const drink = await prisma.drink.create({
      data: { name: `テスト緑茶_${Date.now()}`, stock: 10, sortOrder: 999 },
    });
    testDrinkId = drink.id;

    const drink2 = await prisma.drink.create({
      data: { name: `テストコーヒー_${Date.now()}`, stock: 5, sortOrder: 998 },
    });
    testDrink2Id = drink2.id;
  });

  // ========================================
  // 1. 取り出し（takeout）のテスト
  // ========================================
  describe("取り出し（takeout）", () => {
    it("取り出しで在庫が正しく減少する", async () => {
      const before = await getStock(testDrinkId);
      expect(before).toBe(10);

      const result = await executeTransaction(testEmployeeId, testDrinkId, 3, "takeout");
      expect(result.updatedStock).toBe(7);

      const after = await getStock(testDrinkId);
      expect(after).toBe(7);
    });

    it("在庫をちょうど0にする取り出しが成功する", async () => {
      const result = await executeTransaction(testEmployeeId, testDrinkId, 10, "takeout");
      expect(result.updatedStock).toBe(0);

      const after = await getStock(testDrinkId);
      expect(after).toBe(0);
    });

    it("在庫不足時に取り出しが拒否される", async () => {
      await expect(
        executeTransaction(testEmployeeId, testDrinkId, 11, "takeout")
      ).rejects.toThrow("Insufficient stock");

      // 在庫は変わっていないこと
      const after = await getStock(testDrinkId);
      expect(after).toBe(10);
    });

    it("在庫0から取り出しが拒否される", async () => {
      // まず0にする
      await executeTransaction(testEmployeeId, testDrinkId, 10, "takeout");
      expect(await getStock(testDrinkId)).toBe(0);

      await expect(
        executeTransaction(testEmployeeId, testDrinkId, 1, "takeout")
      ).rejects.toThrow("Insufficient stock");

      expect(await getStock(testDrinkId)).toBe(0);
    });

    it("数量1の取り出しが正しく動作する", async () => {
      const result = await executeTransaction(testEmployeeId, testDrinkId, 1, "takeout");
      expect(result.updatedStock).toBe(9);
    });

    it("トランザクション記録にtype=takeoutが保存される", async () => {
      const result = await executeTransaction(testEmployeeId, testDrinkId, 2, "takeout", "山田様");
      const record = await prisma.transaction.findUniqueOrThrow({
        where: { id: result.transaction.id },
      });

      expect(record.type).toBe("takeout");
      expect(record.quantity).toBe(2);
      expect(record.customerName).toBe("山田様");
      expect(record.drinkId).toBe(testDrinkId);
    });
  });

  // ========================================
  // 2. 返却（return）のテスト
  // ========================================
  describe("返却（return）", () => {
    it("返却で在庫が正しく増加する", async () => {
      const result = await executeTransaction(testEmployeeId, testDrinkId, 3, "return");
      expect(result.updatedStock).toBe(13);

      const after = await getStock(testDrinkId);
      expect(after).toBe(13);
    });

    it("在庫0からの返却が成功する", async () => {
      // まず0にする
      await executeTransaction(testEmployeeId, testDrinkId, 10, "takeout");
      expect(await getStock(testDrinkId)).toBe(0);

      // 返却
      const result = await executeTransaction(testEmployeeId, testDrinkId, 2, "return");
      expect(result.updatedStock).toBe(2);
    });

    it("返却は在庫上限チェックがない", async () => {
      // 大量返却
      const result = await executeTransaction(testEmployeeId, testDrinkId, 100, "return");
      expect(result.updatedStock).toBe(110);
    });

    it("トランザクション記録にtype=returnが保存される", async () => {
      const result = await executeTransaction(testEmployeeId, testDrinkId, 1, "return");
      const record = await prisma.transaction.findUniqueOrThrow({
        where: { id: result.transaction.id },
      });

      expect(record.type).toBe("return");
      expect(record.quantity).toBe(1);
    });
  });

  // ========================================
  // 3. 入庫（stock entry）のテスト
  // ========================================
  describe("入庫（stock entry）", () => {
    it("入庫で在庫が正しく増加する", async () => {
      const result = await executeStockEntry(testEmployeeId, testDrinkId, 24);
      expect(result.updatedStock).toBe(34);

      const after = await getStock(testDrinkId);
      expect(after).toBe(34);
    });

    it("入庫記録が正しく保存される", async () => {
      const result = await executeStockEntry(testEmployeeId, testDrinkId, 12);
      const entry = await prisma.stockEntry.findUniqueOrThrow({
        where: { id: result.stockEntry.id },
      });

      expect(entry.quantity).toBe(12);
      expect(entry.drinkId).toBe(testDrinkId);
    });

    it("大量入庫が正しく動作する", async () => {
      const result = await executeStockEntry(testEmployeeId, testDrinkId, 500);
      expect(result.updatedStock).toBe(510);
    });
  });

  // ========================================
  // 4. 棚卸し（inventory check）のテスト
  // ========================================
  describe("棚卸し（inventory check）", () => {
    it("棚卸しで在庫が実在庫に更新される（差分あり）", async () => {
      const checks = await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 8 },
      ]);

      expect(checks[0].systemStock).toBe(10);
      expect(checks[0].actualStock).toBe(8);
      expect(checks[0].diff).toBe(-2);

      const after = await getStock(testDrinkId);
      expect(after).toBe(8);
    });

    it("棚卸しで差分なしの場合も在庫が正しい", async () => {
      const checks = await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 10 },
      ]);

      expect(checks[0].diff).toBe(0);
      expect(await getStock(testDrinkId)).toBe(10);
    });

    it("棚卸しで在庫を0にできる", async () => {
      await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 0 },
      ]);

      expect(await getStock(testDrinkId)).toBe(0);
    });

    it("棚卸しで在庫を増やすこともできる", async () => {
      const checks = await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 15 },
      ]);

      expect(checks[0].diff).toBe(5);
      expect(await getStock(testDrinkId)).toBe(15);
    });

    it("複数ドリンクの一括棚卸しが正しく動作する", async () => {
      const checks = await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 7 },
        { drinkId: testDrink2Id, actualStock: 3 },
      ]);

      expect(checks).toHaveLength(2);
      expect(await getStock(testDrinkId)).toBe(7);
      expect(await getStock(testDrink2Id)).toBe(3);

      // diff の検証
      expect(checks[0].diff).toBe(7 - 10); // -3
      expect(checks[1].diff).toBe(3 - 5);  // -2
    });
  });

  // ========================================
  // 5. 複合操作の整合性テスト
  // ========================================
  describe("複合操作の整合性", () => {
    it("取り出し→返却で在庫が元に戻る", async () => {
      expect(await getStock(testDrinkId)).toBe(10);

      await executeTransaction(testEmployeeId, testDrinkId, 3, "takeout");
      expect(await getStock(testDrinkId)).toBe(7);

      await executeTransaction(testEmployeeId, testDrinkId, 3, "return");
      expect(await getStock(testDrinkId)).toBe(10);
    });

    it("入庫→取り出し→返却→棚卸しの一連操作", async () => {
      // 初期: 10
      expect(await getStock(testDrinkId)).toBe(10);

      // 入庫 +24 → 34
      await executeStockEntry(testEmployeeId, testDrinkId, 24);
      expect(await getStock(testDrinkId)).toBe(34);

      // 取り出し -5 → 29
      await executeTransaction(testEmployeeId, testDrinkId, 5, "takeout");
      expect(await getStock(testDrinkId)).toBe(29);

      // 返却 +2 → 31
      await executeTransaction(testEmployeeId, testDrinkId, 2, "return");
      expect(await getStock(testDrinkId)).toBe(31);

      // 棚卸し（実在庫30） → 30
      const checks = await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 30 },
      ]);
      expect(checks[0].systemStock).toBe(31);
      expect(checks[0].diff).toBe(-1);
      expect(await getStock(testDrinkId)).toBe(30);
    });

    it("連続取り出しで在庫が正しく減少する", async () => {
      // 10から 1ずつ10回取り出し
      for (let i = 0; i < 10; i++) {
        await executeTransaction(testEmployeeId, testDrinkId, 1, "takeout");
      }
      expect(await getStock(testDrinkId)).toBe(0);

      // 11回目は拒否
      await expect(
        executeTransaction(testEmployeeId, testDrinkId, 1, "takeout")
      ).rejects.toThrow("Insufficient stock");
    });

    it("取り出しと返却の混合操作で整合性が保たれる", async () => {
      // 10 → -3 = 7
      await executeTransaction(testEmployeeId, testDrinkId, 3, "takeout");
      // 7 → +1 = 8
      await executeTransaction(testEmployeeId, testDrinkId, 1, "return");
      // 8 → -5 = 3
      await executeTransaction(testEmployeeId, testDrinkId, 5, "takeout");
      // 3 → +4 = 7
      await executeTransaction(testEmployeeId, testDrinkId, 4, "return");
      // 7 → -2 = 5
      await executeTransaction(testEmployeeId, testDrinkId, 2, "takeout");

      // 最終在庫: 10 - 3 + 1 - 5 + 4 - 2 = 5
      expect(await getStock(testDrinkId)).toBe(5);
    });

    it("複数ドリンクの同時操作で各ドリンクの在庫が独立に保たれる", async () => {
      // drink1: 10, drink2: 5
      await executeTransaction(testEmployeeId, testDrinkId, 3, "takeout");   // drink1: 7
      await executeTransaction(testEmployeeId, testDrink2Id, 2, "takeout");  // drink2: 3
      await executeTransaction(testEmployeeId, testDrinkId, 1, "return");    // drink1: 8
      await executeStockEntry(testEmployeeId, testDrink2Id, 10);             // drink2: 13

      expect(await getStock(testDrinkId)).toBe(8);
      expect(await getStock(testDrink2Id)).toBe(13);
    });

    it("棚卸し後に取り出し・返却が正しく動作する", async () => {
      // 棚卸し: 10 → 20
      await executeInventoryCheck(testEmployeeId, [
        { drinkId: testDrinkId, actualStock: 20 },
      ]);
      expect(await getStock(testDrinkId)).toBe(20);

      // 取り出し: 20 → 15
      await executeTransaction(testEmployeeId, testDrinkId, 5, "takeout");
      expect(await getStock(testDrinkId)).toBe(15);

      // 返却: 15 → 18
      await executeTransaction(testEmployeeId, testDrinkId, 3, "return");
      expect(await getStock(testDrinkId)).toBe(18);
    });
  });

  // ========================================
  // 6. バリデーションテスト
  // ========================================
  describe("Zodバリデーション", () => {
    it("transactionSchema: 正常なtakeoutリクエスト", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: 3,
        type: "takeout",
        customerName: "田中様",
      });
      expect(result.success).toBe(true);
    });

    it("transactionSchema: 正常なreturnリクエスト", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: 2,
        type: "return",
      });
      expect(result.success).toBe(true);
    });

    it("transactionSchema: type省略時はtakeoutがデフォルト", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: 1,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe("takeout");
      }
    });

    it("transactionSchema: 不正なtypeは拒否される", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: 1,
        type: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("transactionSchema: 数量0は拒否される", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("transactionSchema: 負の数量は拒否される", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: -5,
      });
      expect(result.success).toBe(false);
    });

    it("transactionSchema: 小数の数量は拒否される", async () => {
      const { transactionSchema } = await import("@/lib/validations");
      const result = transactionSchema.safeParse({
        drinkId: 1,
        quantity: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it("stockEntrySchema: 正常なリクエスト", async () => {
      const { stockEntrySchema } = await import("@/lib/validations");
      const result = stockEntrySchema.safeParse({
        drinkId: 1,
        quantity: 24,
      });
      expect(result.success).toBe(true);
    });

    it("stockEntrySchema: 数量0は拒否される", async () => {
      const { stockEntrySchema } = await import("@/lib/validations");
      const result = stockEntrySchema.safeParse({
        drinkId: 1,
        quantity: 0,
      });
      expect(result.success).toBe(false);
    });

    it("inventoryCheckSchema: 正常なリクエスト", async () => {
      const { inventoryCheckSchema } = await import("@/lib/validations");
      const result = inventoryCheckSchema.safeParse({
        checks: [
          { drinkId: 1, actualStock: 8 },
          { drinkId: 2, actualStock: 0 },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("inventoryCheckSchema: 負の実在庫は拒否される", async () => {
      const { inventoryCheckSchema } = await import("@/lib/validations");
      const result = inventoryCheckSchema.safeParse({
        checks: [{ drinkId: 1, actualStock: -1 }],
      });
      expect(result.success).toBe(false);
    });
  });

  // ========================================
  // 7. トランザクション記録の整合性テスト
  // ========================================
  describe("記録の整合性", () => {
    it("取り出し記録と在庫変動が一致する", async () => {
      const initialStock = await getStock(testDrinkId);

      // 複数の操作を実行
      await executeTransaction(testEmployeeId, testDrinkId, 3, "takeout");
      await executeTransaction(testEmployeeId, testDrinkId, 2, "return");
      await executeTransaction(testEmployeeId, testDrinkId, 1, "takeout");

      // トランザクション記録を集計
      const transactions = await prisma.transaction.findMany({
        where: { drinkId: testDrinkId, employeeId: testEmployeeId },
      });

      const netChange = transactions.reduce((sum, t) => {
        return sum + (t.type === "return" ? t.quantity : -t.quantity);
      }, 0);

      const finalStock = await getStock(testDrinkId);
      expect(finalStock).toBe(initialStock + netChange);
    });

    it("入庫記録と在庫変動が一致する", async () => {
      const initialStock = await getStock(testDrinkId);

      await executeStockEntry(testEmployeeId, testDrinkId, 10);
      await executeStockEntry(testEmployeeId, testDrinkId, 5);

      const entries = await prisma.stockEntry.findMany({
        where: { drinkId: testDrinkId, employeeId: testEmployeeId },
      });

      const totalStockIn = entries.reduce((sum, e) => sum + e.quantity, 0);
      const finalStock = await getStock(testDrinkId);
      expect(finalStock).toBe(initialStock + totalStockIn);
    });

    it("全操作の合計と最終在庫が一致する", async () => {
      const initialStock = await getStock(testDrinkId);

      // 様々な操作
      await executeStockEntry(testEmployeeId, testDrinkId, 20);  // +20
      await executeTransaction(testEmployeeId, testDrinkId, 8, "takeout");  // -8
      await executeTransaction(testEmployeeId, testDrinkId, 3, "return");   // +3
      await executeTransaction(testEmployeeId, testDrinkId, 5, "takeout");  // -5

      // 期待値: 10 + 20 - 8 + 3 - 5 = 20
      const expected = initialStock + 20 - 8 + 3 - 5;
      expect(await getStock(testDrinkId)).toBe(expected);
      expect(expected).toBe(20);
    });
  });
});
