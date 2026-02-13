"use client";

import { useState, useEffect } from "react";
import { useAuthFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/toast";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DashboardData {
  stockSummary: {
    drinkId: number;
    name: string;
    stock: number;
    imageUrl: string | null;
  }[];
  todayConsumption: {
    drinkId: number;
    name: string;
    totalQuantity: number;
  }[];
  todayTotal: number;
  recentAlerts: {
    id: number;
    createdAt: string;
    diffs: { drinkName: string; diff: number }[];
  }[];
  weeklyTrend: { date: string; totalQuantity: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { authFetch } = useAuthFetch();
  const { showToast } = useToast();

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await authFetch("/api/dashboard");
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          showToast("ダッシュボードの取得に失敗しました", "error");
        }
      } catch {
        showToast("ダッシュボードの取得に失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-text-secondary)]">読み込み中...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-[var(--color-danger)]">
          データの取得に失敗しました
        </div>
      </div>
    );
  }

  const totalStock = data.stockSummary.reduce((sum, d) => sum + d.stock, 0);
  const maxStock = Math.max(...data.stockSummary.map((d) => d.stock), 1);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-[var(--color-text)] mb-6">
        ダッシュボード
      </h1>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            本日の消費
          </p>
          <p className="text-4xl font-bold text-[var(--color-primary)]">
            {data.todayTotal}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">本</p>
        </div>
        <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
          <p className="text-sm text-[var(--color-text-secondary)] mb-1">
            在庫合計
          </p>
          <p className="text-4xl font-bold text-[var(--color-success)]">
            {totalStock}
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">本</p>
        </div>
      </div>

      {/* Stock bar chart (CSS bars) */}
      <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6 mb-8">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
          ドリンク別在庫
        </h2>
        <div className="flex flex-col gap-3">
          {data.stockSummary.map((drink) => (
            <div key={drink.drinkId} className="flex items-center gap-3">
              <span className="w-24 text-sm text-[var(--color-text)] truncate text-right">
                {drink.name}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    drink.stock <= 3
                      ? "bg-[var(--color-warning)]"
                      : "bg-[var(--color-primary)]"
                  }`}
                  style={{
                    width: `${(drink.stock / maxStock) * 100}%`,
                    minWidth: drink.stock > 0 ? "8px" : "0",
                  }}
                />
              </div>
              <span className="w-10 text-sm font-semibold text-right tabular-nums">
                {drink.stock}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly trend chart */}
      <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6 mb-8">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
          週間消費トレンド
        </h2>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value: string) => {
                  const d = new Date(value);
                  return `${d.getMonth() + 1}/${d.getDate()}`;
                }}
              />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip
                labelFormatter={(value) => {
                  const d = new Date(String(value));
                  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                }}
                formatter={(value) => [`${value}本`, "消費数"]}
              />
              <Bar
                dataKey="totalQuantity"
                fill="var(--color-primary)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's consumption by drink */}
      {data.todayConsumption.length > 0 && (
        <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6 mb-8">
          <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
            本日の消費内訳
          </h2>
          <div className="flex flex-wrap gap-3">
            {data.todayConsumption.map((item) => (
              <div
                key={item.drinkId}
                className="bg-blue-50 rounded-lg px-4 py-2 flex items-center gap-2"
              >
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-lg font-bold text-[var(--color-primary)]">
                  {item.totalQuantity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent alerts */}
      <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
        <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
          最近の棚卸しアラート
        </h2>
        {data.recentAlerts.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            アラートはありません
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="border border-[var(--color-border)] rounded-lg p-4"
              >
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                  {new Date(alert.createdAt).toLocaleString("ja-JP")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {alert.diffs.map((d, i) => (
                    <span
                      key={i}
                      className={`text-sm px-2 py-1 rounded ${
                        d.diff < 0
                          ? "bg-red-50 text-[var(--color-danger)]"
                          : d.diff > 0
                            ? "bg-yellow-50 text-[var(--color-warning)]"
                            : "bg-green-50 text-[var(--color-success)]"
                      }`}
                    >
                      {d.drinkName}: {d.diff > 0 ? "+" : ""}
                      {d.diff}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
