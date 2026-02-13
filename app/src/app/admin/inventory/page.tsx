"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Drink {
  id: number;
  name: string;
  stock: number;
}

interface CheckRow {
  drinkId: number;
  drinkName: string;
  systemStock: number;
  actualStock: string;
}

interface SubmitResult {
  hasDiff: boolean;
  notificationSent: boolean;
  stockUpdated: boolean;
  checks: {
    drinkId: number;
    systemStock: number;
    actualStock: number;
    diff: number;
    drink: { name: string };
  }[];
}

export default function InventoryPage() {
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    return res;
  }, []);

  const loadDrinks = useCallback(async () => {
    const res = await authFetch("/api/drinks");
    const drinks: Drink[] = await res.json();
    setRows(drinks.map((d) => ({
      drinkId: d.id,
      drinkName: d.name,
      systemStock: d.stock,
      actualStock: "",
    })));
  }, [authFetch]);

  useEffect(() => {
    loadDrinks();
  }, [loadDrinks]);

  const updateActualStock = (drinkId: number, value: string) => {
    setRows((prev) =>
      prev.map((r) => r.drinkId === drinkId ? { ...r, actualStock: value } : r)
    );
  };

  const getDiff = (row: CheckRow) => {
    if (row.actualStock === "") return null;
    return Number(row.actualStock) - row.systemStock;
  };

  const diffCount = rows.filter((r) => {
    const d = getDiff(r);
    return d !== null && d !== 0;
  }).length;

  const allFilled = rows.every((r) => r.actualStock !== "");

  const handleSubmit = async () => {
    if (!allFilled || isSubmitting) return;
    setIsSubmitting(true);
    setResult(null);
    try {
      const checks = rows.map((r) => ({
        drinkId: r.drinkId,
        actualStock: Number(r.actualStock),
      }));
      const res = await authFetch("/api/inventory-checks", {
        method: "POST",
        body: JSON.stringify({ checks }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "棚卸し登録に失敗しました");
      }
      const data = await res.json();
      setResult(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    setResult(null);
    await loadDrinks();
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">棚卸し</h1>
        <Link
          href="/admin/history?tab=inventory"
          className="text-sm text-blue-600 hover:underline"
        >
          棚卸し履歴を見る
        </Link>
      </div>

      {result && (
        <div className={`mb-4 p-4 rounded-lg ${result.hasDiff ? "bg-yellow-50 border border-yellow-200 text-yellow-800" : "bg-green-50 border border-green-200 text-green-700"}`}>
          <p className="font-bold text-lg mb-2">
            {result.hasDiff ? "差分がありました" : "差分なし - すべて一致"}
          </p>
          {result.stockUpdated && (
            <p className="text-sm mb-1 font-medium">
              在庫数を実在庫に更新しました
            </p>
          )}
          {result.notificationSent && (
            <p className="text-sm mb-1">Google Chatに通知を送信しました</p>
          )}

          {/* 結果サマリーテーブル */}
          {result.checks && result.checks.length > 0 && (
            <div className="mt-3 bg-white/60 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">ドリンク</th>
                    <th className="text-center p-2 font-medium">理論在庫</th>
                    <th className="text-center p-2 font-medium">実在庫</th>
                    <th className="text-center p-2 font-medium">差分</th>
                  </tr>
                </thead>
                <tbody>
                  {result.checks.map((c) => (
                    <tr key={c.drinkId} className="border-b last:border-b-0">
                      <td className="p-2">{c.drink.name}</td>
                      <td className="p-2 text-center">{c.systemStock}</td>
                      <td className="p-2 text-center font-bold">{c.actualStock}</td>
                      <td className={`p-2 text-center font-bold ${
                        c.diff === 0 ? "text-green-600" : c.diff < 0 ? "text-red-600" : "text-yellow-600"
                      }`}>
                        {c.diff === 0 ? "0" : c.diff > 0 ? `+${c.diff}` : c.diff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={handleReset}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700"
            >
              新しい棚卸しを開始
            </button>
            <Link
              href="/admin/history?tab=inventory"
              className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-bold hover:bg-gray-200"
            >
              棚卸し履歴を確認
            </Link>
          </div>
        </div>
      )}

      {!result && (
        <>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left p-3 border-b font-medium text-gray-600">ドリンク名</th>
                  <th className="text-center p-3 border-b font-medium text-gray-600 w-28">理論在庫</th>
                  <th className="text-center p-3 border-b font-medium text-gray-600 w-36">実在庫</th>
                  <th className="text-center p-3 border-b font-medium text-gray-600 w-24">差分</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const diff = getDiff(row);
                  return (
                    <tr key={row.drinkId}>
                      <td className="p-3 border-b font-medium">{row.drinkName}</td>
                      <td className="p-3 border-b text-center text-lg">{row.systemStock}</td>
                      <td className="p-3 border-b text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.actualStock}
                          onChange={(e) => updateActualStock(row.drinkId, e.target.value)}
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-center text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="--"
                        />
                      </td>
                      <td className={`p-3 border-b text-center text-lg font-bold ${
                        diff === null ? "text-gray-300" : diff === 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-yellow-600"
                      }`}>
                        {diff === null ? "--" : diff > 0 ? `+${diff}` : diff}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {diffCount > 0 ? (
                <span className="text-yellow-600 font-bold">差分あり: {diffCount}件</span>
              ) : allFilled ? (
                <span className="text-green-600 font-bold">差分なし</span>
              ) : (
                <span>すべての実在庫を入力してください</span>
              )}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!allFilled || isSubmitting}
              className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? "登録中..." : "棚卸し確定"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
