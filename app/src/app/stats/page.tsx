"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
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
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface StatsData {
  period: { days: number; from: string; to: string };
  employeeRanking: {
    id: number;
    name: string;
    employeeCode: string;
    totalQuantity: number;
  }[];
  drinkBreakdown: {
    id: number;
    name: string;
    totalQuantity: number;
  }[];
  dailyTrend: { date: string; quantity: number }[];
  stockDepletion: {
    id: number;
    name: string;
    currentStock: number;
    avgDailyConsumption: number;
    daysUntilEmpty: number | null;
  }[];
  drinkDailyTrend: Record<string, { date: string; quantity: number }[]>;
}

const COLORS = [
  "#3b82f6",
  "#f97316",
  "#22c55e",
  "#ef4444",
  "#a855f7",
  "#eab308",
  "#06b6d4",
  "#ec4899",
  "#14b8a6",
  "#f59e0b",
];

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const { token, isLoading } = useAuth();
  const { authFetch } = useAuthFetch();
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [token, isLoading, router]);

  useEffect(() => {
    if (!token) return;
    const fetchStats = async () => {
      setLoading(true);
      try {
        const res = await authFetch(`/api/stats?days=${days}`);
        if (res.ok) {
          setData(await res.json());
        } else {
          showToast("統計データの取得に失敗しました", "error");
        }
      } catch {
        showToast("統計データの取得に失敗しました", "error");
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token, days]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[var(--color-card)] border-b-2 border-[var(--color-border)] px-4 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-[var(--color-text)]">
          消費統計
        </h1>
        <button
          type="button"
          onClick={() => router.push("/drinks")}
          className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-200 transition-colors cursor-pointer"
        >
          戻る
        </button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full">
        {/* Period selector */}
        <div className="flex gap-2 mb-6">
          {[7, 14, 30, 60].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                days === d
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {d}日間
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[var(--color-text-secondary)]">
              統計データを読み込み中...
            </div>
          </div>
        ) : data ? (
          <div className="flex flex-col gap-6">
            {/* Stock depletion forecast */}
            <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
              <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
                在庫消費ペース
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 font-medium text-gray-600">
                        ドリンク
                      </th>
                      <th className="text-center p-2 font-medium text-gray-600">
                        現在庫
                      </th>
                      <th className="text-center p-2 font-medium text-gray-600">
                        1日平均消費
                      </th>
                      <th className="text-center p-2 font-medium text-gray-600">
                        在庫切れまで
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.stockDepletion.map((item) => (
                      <tr key={item.id} className="border-b last:border-b-0">
                        <td className="p-2 font-medium">{item.name}</td>
                        <td className="p-2 text-center">
                          <span
                            className={`font-bold ${
                              item.currentStock <= 3
                                ? "text-red-500"
                                : item.currentStock <= 5
                                  ? "text-yellow-600"
                                  : "text-green-600"
                            }`}
                          >
                            {item.currentStock}
                          </span>
                        </td>
                        <td className="p-2 text-center">
                          {item.avgDailyConsumption > 0
                            ? `${item.avgDailyConsumption}本`
                            : "-"}
                        </td>
                        <td className="p-2 text-center">
                          {item.daysUntilEmpty !== null ? (
                            <span
                              className={`font-bold ${
                                item.daysUntilEmpty <= 2
                                  ? "text-red-500"
                                  : item.daysUntilEmpty <= 5
                                    ? "text-yellow-600"
                                    : "text-green-600"
                              }`}
                            >
                              約{item.daysUntilEmpty}日
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Daily consumption trend */}
            <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
              <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
                日別消費推移
              </h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.dailyTrend}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--color-border)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(value: string) => {
                        const d = new Date(value);
                        return `${d.getMonth() + 1}/${d.getDate()}`;
                      }}
                      interval={days <= 14 ? 0 : "preserveStartEnd"}
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
                      dataKey="quantity"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Drink breakdown pie + bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
                <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  ドリンク別消費割合
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={data.drinkBreakdown.filter(
                          (d) => d.totalQuantity > 0
                        )}
                        dataKey="totalQuantity"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={({ name, percent }) =>
                          `${name || ""} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {data.drinkBreakdown
                          .filter((d) => d.totalQuantity > 0)
                          .map((_, i) => (
                            <Cell
                              key={i}
                              fill={COLORS[i % COLORS.length]}
                            />
                          ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value}本`, "消費数"]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
                <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  ドリンク別消費数
                </h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.drinkBreakdown}
                      layout="vertical"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 12 }}
                        allowDecimals={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={80}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}本`, "消費数"]}
                      />
                      <Bar
                        dataKey="totalQuantity"
                        fill="var(--color-primary)"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top drinks daily trend */}
            {Object.keys(data.drinkDailyTrend).length > 0 && (
              <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
                <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
                  ドリンク別消費推移（上位5種）
                </h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--color-border)"
                      />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(value: string) => {
                          const d = new Date(value);
                          return `${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        type="category"
                        allowDuplicatedCategory={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                      <Tooltip
                        labelFormatter={(value) => {
                          const d = new Date(String(value));
                          return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
                        }}
                        formatter={(value, name) => [
                          `${value}本`,
                          String(name),
                        ]}
                      />
                      {Object.entries(data.drinkDailyTrend).map(
                        ([name, trend], i) => (
                          <Line
                            key={name}
                            data={trend}
                            type="monotone"
                            dataKey="quantity"
                            name={name}
                            stroke={COLORS[i % COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        )
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Employee ranking */}
            <div className="bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
              <h2 className="text-lg font-bold text-[var(--color-text)] mb-4">
                社員別消費ランキング
              </h2>
              {data.employeeRanking.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)]">
                  データがありません
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.employeeRanking.map((emp, i) => {
                    const maxQty = data.employeeRanking[0]?.totalQuantity || 1;
                    return (
                      <div key={emp.id} className="flex items-center gap-3">
                        <span className="w-6 text-sm font-bold text-gray-400 text-right">
                          {i + 1}
                        </span>
                        <span className="w-20 text-sm truncate">
                          {emp.name}
                        </span>
                        <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{
                              width: `${(emp.totalQuantity / maxQty) * 100}%`,
                              minWidth:
                                emp.totalQuantity > 0 ? "8px" : "0",
                            }}
                          />
                        </div>
                        <span className="w-12 text-sm font-bold text-right tabular-nums">
                          {emp.totalQuantity}本
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-[var(--color-danger)]">
              データの取得に失敗しました
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
