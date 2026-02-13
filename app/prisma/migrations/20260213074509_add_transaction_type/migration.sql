-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_transactions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employee_id" INTEGER NOT NULL,
    "drink_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'takeout',
    "customer_name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "transactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_drink_id_fkey" FOREIGN KEY ("drink_id") REFERENCES "drinks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_transactions" ("created_at", "customer_name", "drink_id", "employee_id", "id", "quantity", "source") SELECT "created_at", "customer_name", "drink_id", "employee_id", "id", "quantity", "source" FROM "transactions";
DROP TABLE "transactions";
ALTER TABLE "new_transactions" RENAME TO "transactions";
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");
CREATE INDEX "transactions_employee_id_idx" ON "transactions"("employee_id");
CREATE INDEX "transactions_drink_id_idx" ON "transactions"("drink_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
