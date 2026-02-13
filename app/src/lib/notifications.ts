import { prisma } from "./prisma";

export async function sendInventoryAlert(
  checks: { drinkName: string; systemStock: number; actualStock: number; diff: number }[],
  performerName: string,
  performerCode: string
): Promise<boolean> {
  const setting = await prisma.setting.findUnique({ where: { key: "notification_webhook_url" } });
  if (!setting?.value) return false;

  const diffsOnly = checks.filter((c) => c.diff !== 0);
  if (diffsOnly.length === 0) return false;

  const totalDiff = diffsOnly.reduce((sum, c) => sum + c.diff, 0);
  const lines = diffsOnly.map(
    (c) => `• ${c.drinkName}: 理論 ${c.systemStock} → 実数 ${c.actualStock}（*${c.diff > 0 ? "+" : ""}${c.diff}*）`
  );

  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const text = `⚠️ *棚卸し差分アラート*\n実施者: ${performerName}（${performerCode}）\n実施日時: ${now}\n\n差分あり:\n${lines.join("\n")}\n\n差分合計: *${totalDiff > 0 ? "+" : ""}${totalDiff}本*`;

  try {
    await fetch(setting.value, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch {
    console.error("Failed to send notification");
    return false;
  }
}

export async function checkLowStockAndNotify(
  drinkId: number,
  newStock: number
): Promise<boolean> {
  // Get threshold setting
  const thresholdSetting = await prisma.setting.findUnique({
    where: { key: "low_stock_threshold" },
  });
  const threshold = thresholdSetting ? parseInt(thresholdSetting.value, 10) : 0;
  if (threshold <= 0 || newStock > threshold) return false;

  // Get webhook URL
  const webhookSetting = await prisma.setting.findUnique({
    where: { key: "notification_webhook_url" },
  });
  if (!webhookSetting?.value) return false;

  // Get drink name
  const drink = await prisma.drink.findUnique({
    where: { id: drinkId },
    select: { name: true },
  });
  if (!drink) return false;

  const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });
  const urgency = newStock === 0 ? "🚨" : "⚠️";
  const stockText = newStock === 0 ? "*在庫切れ*" : `残り *${newStock}本*（閾値: ${threshold}本）`;
  const text = `${urgency} *在庫低下アラート*\n日時: ${now}\n\nドリンク: *${drink.name}*\n${stockText}\n\n補充をお願いします。`;

  try {
    await fetch(webhookSetting.value, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    return true;
  } catch {
    console.error("Failed to send low stock notification");
    return false;
  }
}
