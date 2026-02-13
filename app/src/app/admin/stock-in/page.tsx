"use client";

import { useState, useEffect, useCallback } from "react";

interface Drink {
  id: number;
  name: string;
  stock: number;
}

interface StockEntry {
  id: number;
  createdAt: string;
  quantity: number;
  drink: { name: string };
  employee: { name: string };
}

export default function StockInPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [selectedDrinkId, setSelectedDrinkId] = useState<number | "">("");
  const [quantity, setQuantity] = useState(1);
  const [recentEntries, setRecentEntries] = useState<StockEntry[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const loadData = useCallback(async () => {
    const [drinksRes, entriesRes] = await Promise.all([
      authFetch("/api/drinks"),
      authFetch("/api/stock-entries?limit=10"),
    ]);
    setDrinks(await drinksRes.json());
    const entriesData = await entriesRes.json();
    setRecentEntries(entriesData.data || []);
  }, [authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const selectedDrink = drinks.find((d) => d.id === selectedDrinkId);

  const handleSubmit = async () => {
    if (!selectedDrinkId || isSubmitting) return;
    setIsSubmitting(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/stock-entries", {
        method: "POST",
        body: JSON.stringify({ drinkId: selectedDrinkId, quantity }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "入庫登録に失敗しました");
      }
      setMessage({ type: "success", text: "入庫登録が完了しました" });
      setQuantity(1);
      setSelectedDrinkId("");
      await loadData();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラーが発生しました" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">入庫登録</h1>

      {message && (
        <div className={`mb-4 p-4 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ドリンク選択</label>
            <select
              value={selectedDrinkId}
              onChange={(e) => setSelectedDrinkId(e.target.value ? Number(e.target.value) : "")}
              className="border border-gray-300 rounded-lg px-3 py-3 w-full text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- 選択してください --</option>
              {drinks.map((d) => (
                <option key={d.id} value={d.id}>{d.name}（現在庫: {d.stock}）</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">数量</label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-14 h-14 rounded-lg bg-gray-100 text-2xl font-bold hover:bg-gray-200 disabled:opacity-40 cursor-pointer"
              >−</button>
              <input
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (!isNaN(v) && v >= 1 && v <= 999) {
                    setQuantity(v);
                  } else if (e.target.value === "") {
                    setQuantity(1);
                  }
                }}
                onFocus={(e) => e.target.select()}
                className="text-3xl font-bold w-24 text-center border-2 border-gray-200 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(999, q + 1))}
                disabled={quantity >= 999}
                className="w-14 h-14 rounded-lg bg-gray-100 text-2xl font-bold hover:bg-gray-200 disabled:opacity-40 cursor-pointer"
              >+</button>
            </div>
          </div>

          {selectedDrink && (
            <div className="bg-blue-50 rounded-lg p-4 text-lg">
              現在在庫: <strong>{selectedDrink.stock}</strong> → 入庫後: <strong>{selectedDrink.stock + quantity}</strong>
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!selectedDrinkId || isSubmitting}
            className="w-full bg-blue-600 text-white py-4 rounded-lg text-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? "登録中..." : "入庫登録"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm">
        <h2 className="text-lg font-bold p-4 border-b">最近の入庫履歴</h2>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border-b font-medium text-gray-600">日時</th>
              <th className="text-left p-3 border-b font-medium text-gray-600">ドリンク名</th>
              <th className="text-left p-3 border-b font-medium text-gray-600">数量</th>
              <th className="text-left p-3 border-b font-medium text-gray-600">登録者</th>
            </tr>
          </thead>
          <tbody>
            {recentEntries.map((entry) => (
              <tr key={entry.id}>
                <td className="p-3 border-b">{new Date(entry.createdAt).toLocaleString("ja-JP")}</td>
                <td className="p-3 border-b">{entry.drink.name}</td>
                <td className="p-3 border-b font-bold">+{entry.quantity}</td>
                <td className="p-3 border-b">{entry.employee.name}</td>
              </tr>
            ))}
            {recentEntries.length === 0 && (
              <tr><td colSpan={4} className="p-6 text-center text-gray-400">履歴がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
