"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface Drink { id: number; name: string; }

interface TransactionRow {
  id: number;
  createdAt: string;
  quantity: number;
  customerName: string | null;
  employee: { name: string; employeeCode: string };
  drink: { name: string };
}

interface InventoryCheckRow {
  id: number;
  createdAt: string;
  systemStock: number;
  actualStock: number;
  diff: number;
  employee: { name: string; employeeCode: string };
  drink: { name: string };
}

interface InventorySession {
  createdAt: string;
  employee: { name: string; employeeCode: string };
  hasDiff: boolean;
  totalDiff: number;
  drinkCount: number;
  checks: {
    id: number;
    drinkName: string;
    systemStock: number;
    actualStock: number;
    diff: number;
  }[];
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type InventoryViewMode = "sessions" | "detail";

export default function HistoryPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "inventory" ? "inventory" : "transactions";

  const [tab, setTab] = useState<"transactions" | "inventory">(initialTab);
  const [inventoryView, setInventoryView] = useState<InventoryViewMode>("sessions");
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [drinkId, setDrinkId] = useState<string>("");
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [inventoryChecks, setInventoryChecks] = useState<InventoryCheckRow[]>([]);
  const [inventorySessions, setInventorySessions] = useState<InventorySession[]>([]);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 50, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(false);

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
    if (res.status === 401) { window.location.href = "/login"; throw new Error("Unauthorized"); }
    return res;
  }, []);

  useEffect(() => {
    authFetch("/api/drinks?active=false").then(async (res) => setDrinks(await res.json()));
  }, [authFetch]);

  const buildQuery = (page: number) => {
    const params = new URLSearchParams();
    if (fromDate) params.set("from", fromDate + "T00:00:00");
    if (toDate) params.set("to", toDate + "T23:59:59");
    if (drinkId) params.set("drinkId", drinkId);
    params.set("page", String(page));
    params.set("limit", "50");
    return params.toString();
  };

  const search = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const query = buildQuery(page);
      if (tab === "transactions") {
        const res = await authFetch(`/api/transactions?${query}`);
        const data = await res.json();
        setTransactions(data.data);
        setPagination(data.pagination);
      } else if (inventoryView === "sessions") {
        const res = await authFetch(`/api/inventory-checks/sessions?${query}`);
        const data = await res.json();
        setInventorySessions(data.data);
        setPagination(data.pagination);
      } else {
        const res = await authFetch(`/api/inventory-checks?${query}`);
        const data = await res.json();
        setInventoryChecks(data.data);
        setPagination(data.pagination);
      }
    } finally {
      setLoading(false);
    }
  }, [tab, inventoryView, fromDate, toDate, drinkId, authFetch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { search(1); }, [tab, inventoryView]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = async () => {
    const query = buildQuery(1);
    const endpoint = tab === "transactions" ? "/api/transactions/export" : "/api/inventory-checks/export";
    const res = await authFetch(`${endpoint}?${query}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSession = (index: number) => {
    setExpandedSession(expandedSession === index ? null : index);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">履歴検索</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        {[{ key: "transactions" as const, label: "取り出し履歴" }, { key: "inventory" as const, label: "棚卸し履歴" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-6 py-2 rounded-lg font-medium ${tab === t.key ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Inventory view mode toggle */}
      {tab === "inventory" && (
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setInventoryView("sessions")}
            className={`px-4 py-1.5 rounded text-sm font-medium ${inventoryView === "sessions" ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
          >
            セッション別
          </button>
          <button
            onClick={() => setInventoryView("detail")}
            className={`px-4 py-1.5 rounded text-sm font-medium ${inventoryView === "detail" ? "bg-blue-100 text-blue-700 border border-blue-300" : "bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100"}`}
          >
            明細一覧
          </button>
          <div className="flex-1" />
          <span className="text-xs text-gray-400 self-center">棚卸しデータは1年間保持されます</span>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">終了日</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {(tab === "transactions" || inventoryView === "detail") && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">ドリンク</label>
            <select value={drinkId} onChange={(e) => setDrinkId(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">すべて</option>
              {drinks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={() => search(1)} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">検索</button>
        <button onClick={exportCsv} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200">CSV出力</button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : tab === "transactions" ? (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 border-b font-medium text-gray-600">日時</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">社員番号</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">社員名</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">ドリンク名</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">数量</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">お客様名</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 border-b text-sm">{new Date(t.createdAt).toLocaleString("ja-JP")}</td>
                  <td className="p-3 border-b">{t.employee.employeeCode}</td>
                  <td className="p-3 border-b">{t.employee.name}</td>
                  <td className="p-3 border-b">{t.drink.name}</td>
                  <td className="p-3 border-b font-bold">{t.quantity}</td>
                  <td className="p-3 border-b text-gray-500">{t.customerName || "-"}</td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">データがありません</td></tr>
              )}
            </tbody>
          </table>
        ) : inventoryView === "sessions" ? (
          /* セッション別表示 */
          <div>
            {inventorySessions.length === 0 ? (
              <div className="p-6 text-center text-gray-400">データがありません</div>
            ) : (
              inventorySessions.map((session, idx) => (
                <div key={idx} className="border-b last:border-b-0">
                  <button
                    onClick={() => toggleSession(idx)}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm text-gray-500">
                        {new Date(session.createdAt).toLocaleString("ja-JP")}
                      </div>
                      <div className="text-sm font-medium">
                        {session.employee.name}（{session.employee.employeeCode}）
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        session.hasDiff
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      }`}>
                        {session.hasDiff ? `差分あり（${session.totalDiff}本）` : "差分なし"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <span className="text-xs">{session.drinkCount}種類</span>
                      <span className="text-lg">{expandedSession === idx ? "\u25B2" : "\u25BC"}</span>
                    </div>
                  </button>

                  {expandedSession === idx && (
                    <div className="bg-gray-50 px-4 pb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr>
                            <th className="text-left p-2 font-medium text-gray-500">ドリンク名</th>
                            <th className="text-center p-2 font-medium text-gray-500">理論在庫</th>
                            <th className="text-center p-2 font-medium text-gray-500">実在庫</th>
                            <th className="text-center p-2 font-medium text-gray-500">差分</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.checks.map((c) => (
                            <tr key={c.id} className="bg-white">
                              <td className="p-2 border-b">{c.drinkName}</td>
                              <td className="p-2 border-b text-center">{c.systemStock}</td>
                              <td className="p-2 border-b text-center font-bold">{c.actualStock}</td>
                              <td className={`p-2 border-b text-center font-bold ${
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
                </div>
              ))
            )}
          </div>
        ) : (
          /* 明細一覧表示 */
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 border-b font-medium text-gray-600">日時</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">実施者</th>
                <th className="text-left p-3 border-b font-medium text-gray-600">ドリンク名</th>
                <th className="text-center p-3 border-b font-medium text-gray-600">理論在庫</th>
                <th className="text-center p-3 border-b font-medium text-gray-600">実在庫</th>
                <th className="text-center p-3 border-b font-medium text-gray-600">差分</th>
              </tr>
            </thead>
            <tbody>
              {inventoryChecks.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 border-b text-sm">{new Date(c.createdAt).toLocaleString("ja-JP")}</td>
                  <td className="p-3 border-b">{c.employee.name}</td>
                  <td className="p-3 border-b">{c.drink.name}</td>
                  <td className="p-3 border-b text-center">{c.systemStock}</td>
                  <td className="p-3 border-b text-center">{c.actualStock}</td>
                  <td className={`p-3 border-b text-center font-bold ${c.diff === 0 ? "text-green-600" : c.diff < 0 ? "text-red-600" : "text-yellow-600"}`}>
                    {c.diff > 0 ? `+${c.diff}` : c.diff}
                  </td>
                </tr>
              ))}
              {inventoryChecks.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-gray-400">データがありません</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-4">
          <button
            onClick={() => search(pagination.page - 1)}
            disabled={pagination.page <= 1}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >前へ</button>
          <span className="text-sm text-gray-600">{pagination.page} / {pagination.totalPages} ページ（全{pagination.total}件）</span>
          <button
            onClick={() => search(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40"
          >次へ</button>
        </div>
      )}
    </div>
  );
}
