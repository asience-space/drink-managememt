import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.employee.upsert({
    where: { employeeCode: "00000001" },
    update: {},
    create: { employeeCode: "00000001", name: "管理者", role: "admin" },
  });

  await prisma.employee.upsert({
    where: { employeeCode: "00000002" },
    update: {},
    create: { employeeCode: "00000002", name: "佐藤太郎", role: "user" },
  });

  const drinks = [
    { name: "お茶（緑茶）", stock: 10, sortOrder: 1 },
    { name: "お茶（ほうじ茶）", stock: 10, sortOrder: 2 },
    { name: "コーヒー（ブラック）", stock: 10, sortOrder: 3 },
    { name: "コーヒー（微糖）", stock: 10, sortOrder: 4 },
    { name: "水", stock: 10, sortOrder: 5 },
    { name: "オレンジジュース", stock: 5, sortOrder: 6 },
  ];

  for (const drink of drinks) {
    const existing = await prisma.drink.findFirst({
      where: { name: drink.name },
    });
    if (!existing) {
      await prisma.drink.create({ data: drink });
    }
  }

  const settings = [
    { key: "notification_webhook_url", value: "" },
    { key: "inventory_check_reminder", value: "09:00,18:00" },
    { key: "lockout_duration_minutes", value: "5" },
    { key: "lockout_max_attempts", value: "3" },
    { key: "session_timeout_minutes", value: "30" },
    { key: "low_stock_threshold", value: "3" },
    { key: "default_drink_id", value: "" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: {},
      create: setting,
    });
  }

  console.log("Seed data created successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
