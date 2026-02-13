"use client";

import { useState, useEffect, useCallback } from "react";

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

export default function InventoryPage() {
  const [rows, setRows] = useState<CheckRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ hasDiff: boolean; notificationSent: boolean } | null>(null);

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

  useEffect(() => {
    authFetch("/api/drinks").then(async (res) => {
      const drinks: Drink[] = await res.json();
      setRows(drinks.map((d) => ({
        drinkId: d.id,
        drinkName: d.name,
        systemStock: d.stock,
        actualStock: "",
      })));
    });
  }, [authFetch]);

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
      setResult({ hasDiff: data.hasDiff, notificationSent: data.notificationSent });
    } catch (err) {
      alert(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">棚卸し</h1>

      {result && (
        <div className={`mb-4 p-4 rounded-lg ${result.hasDiff ? "bg-yellow-50 border border-yellow-200 text-yellow-800" : "bg-green-50 border border-green-200 text-green-700"}`}>
          <p className="font-bold">{result.hasDiff ? "差分がありました" : "差分なし - すべて一致"}</p>
          {result.notificationSent && <p className="text-sm mt-1">Google Chatに通知を送信しました</p>}
        </div>
      )}

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
    </div>
  );
}
