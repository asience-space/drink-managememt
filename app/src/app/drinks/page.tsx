"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAuthFetch } from "@/hooks/use-fetch";
import { useToast } from "@/components/toast";

interface Drink {
  id: number;
  name: string;
  imageUrl: string | null;
  stock: number;
  sortOrder: number;
}

type Mode = "takeout" | "return";

export default function DrinksPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDrinks, setLoadingDrinks] = useState(true);
  const [mode, setMode] = useState<Mode>("takeout");

  const isReturn = mode === "return";

  const { employee, token, isLoading, isAdmin, logout } = useAuth();
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
    const fetchDrinksAndSettings = async () => {
      try {
        // ドリンク一覧を取得
        const drinksRes = await authFetch("/api/drinks");
        if (!drinksRes.ok) {
          throw new Error("ドリンク一覧の取得に失敗しました");
        }
        const drinksData: Drink[] = await drinksRes.json();
        setDrinks(drinksData);

        // 設定を取得してデフォルトドリンクを自動選択
        const settingsRes = await authFetch("/api/settings");
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          const defaultDrinkId = settingsData.default_drink_id;

          if (defaultDrinkId) {
            const defaultDrink = drinksData.find(
              (d) => d.id === parseInt(defaultDrinkId, 10)
            );
            // デフォルトドリンクが存在し、在庫がある場合のみ自動選択
            if (defaultDrink && defaultDrink.stock > 0) {
              setSelectedDrink(defaultDrink);
              setQuantity(1);
            }
          }
        }
      } catch (error) {
        showToast(
          error instanceof Error
            ? error.message
            : "ドリンク一覧の取得に失敗しました",
          "error"
        );
      } finally {
        setLoadingDrinks(false);
      }
    };
    fetchDrinksAndSettings();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setSelectedDrink(null);
    setQuantity(1);
    setCustomerName("");
  };

  const handleSelectDrink = (drink: Drink) => {
    // 取り出し時は在庫0なら選択不可、返却時は常に選択可
    if (!isReturn && drink.stock <= 0) return;
    if (selectedDrink?.id === drink.id) {
      setSelectedDrink(null);
      setQuantity(1);
    } else {
      setSelectedDrink(drink);
      setQuantity(1);
    }
  };

  const handleQuantityTap = (num: number) => {
    if (!selectedDrink) return;
    // 取り出し時のみ在庫チェック
    if (!isReturn && num > selectedDrink.stock) return;
    setQuantity(num);
  };

  const handleConfirm = async () => {
    if (!selectedDrink || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await authFetch("/api/transactions", {
        method: "POST",
        body: JSON.stringify({
          drinkId: selectedDrink.id,
          quantity,
          type: mode,
          customerName: customerName || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "記録に失敗しました");
      }

      const params = new URLSearchParams({
        drink: selectedDrink.name,
        quantity: String(quantity),
        type: mode,
      });
      if (customerName) {
        params.set("customer", customerName);
      }
      router.push(`/complete?${params.toString()}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "記録に失敗しました";
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col ${isReturn ? "bg-orange-50" : ""}`}>
      {/* Header */}
      <header className={`border-b-2 px-4 py-3 flex items-center justify-between ${
        isReturn
          ? "bg-orange-100 border-orange-200"
          : "bg-[var(--color-card)] border-[var(--color-border)]"
      }`}>
        <h1 className="text-lg font-bold text-[var(--color-text)]">
          ようこそ {employee?.name}さん
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/stats")}
            className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-200 transition-colors cursor-pointer"
          >
            統計
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push("/admin/dashboard")}
              className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-200 transition-colors cursor-pointer"
            >
              管理画面
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="px-3 py-2 rounded-lg bg-gray-100 text-sm font-medium text-[var(--color-danger)] hover:bg-red-50 transition-colors cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Mode toggle */}
      <div className="flex px-4 pt-3 gap-2">
        <button
          type="button"
          onClick={() => handleModeChange("takeout")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            !isReturn
              ? "bg-blue-600 text-white shadow-md"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          取り出し
        </button>
        <button
          type="button"
          onClick={() => handleModeChange("return")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
            isReturn
              ? "bg-orange-500 text-white shadow-md"
              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
          }`}
        >
          返却
        </button>
      </div>

      {/* Return mode banner */}
      {isReturn && (
        <div className="mx-4 mt-2 px-3 py-2 bg-orange-200 border border-orange-300 rounded-lg text-orange-800 text-xs font-bold text-center">
          返却モード: ドリンクを冷蔵庫に戻します
        </div>
      )}

      {/* Main: ドリンク選択（上） + 数量テンキー（下） */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {loadingDrinks ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-[var(--color-text-secondary)]">
              ドリンクを読み込み中...
            </div>
          </div>
        ) : (
          <>
            {/* ドリンク一覧（コンパクトリスト形式） */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                {isReturn ? "返却するドリンクを選択してください" : "ドリンクを選択してください"}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {drinks.map((drink) => {
                  const isSelected = selectedDrink?.id === drink.id;
                  const isOut = !isReturn && drink.stock <= 0;
                  return (
                    <button
                      key={drink.id}
                      type="button"
                      onClick={() => handleSelectDrink(drink)}
                      disabled={isOut}
                      className={`relative flex flex-col items-center justify-center rounded-xl border-2 p-3 min-h-[80px] transition-all cursor-pointer select-none ${
                        isSelected
                          ? isReturn
                            ? "border-orange-400 bg-orange-50 shadow-md"
                            : "border-[var(--color-primary)] bg-blue-50 shadow-md"
                          : "border-[var(--color-border)] bg-[var(--color-card)]"
                      } ${isOut ? "opacity-40 cursor-not-allowed" : "active:scale-[0.97]"}`}
                    >
                      <span className={`text-sm font-bold text-center leading-tight ${
                        isSelected
                          ? isReturn ? "text-orange-600" : "text-[var(--color-primary)]"
                          : "text-[var(--color-text)]"
                      }`}>
                        {drink.name}
                      </span>
                      <span className={`mt-1 text-xs font-medium ${
                        isOut ? "text-red-500" : drink.stock <= 3 ? "text-yellow-600" : "text-green-600"
                      }`}>
                        {isOut ? "在庫なし" : `在庫: ${drink.stock}`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 下部エリア: 数量テンキー + お客様名 + 確定 */}
            <div className={`border-t-2 px-4 pt-3 pb-4 ${
              isReturn
                ? "bg-orange-100 border-orange-200"
                : "bg-[var(--color-card)] border-[var(--color-border)]"
            }`}>
              {/* 選択中の表示 */}
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm">
                  {selectedDrink ? (
                    <span>
                      {isReturn && <span className="text-orange-600 font-bold mr-1">[返却]</span>}
                      <span className={`font-bold ${isReturn ? "text-orange-600" : "text-[var(--color-primary)]"}`}>{selectedDrink.name}</span>
                      <span className="text-[var(--color-text-secondary)] ml-2">&times; {quantity}</span>
                    </span>
                  ) : (
                    <span className="text-[var(--color-text-secondary)]">
                      {isReturn ? "返却するドリンクを選択" : "ドリンクを選択してください"}
                    </span>
                  )}
                </div>
              </div>

              {/* 数量テンキー: 1〜9を1行に */}
              <div className="grid grid-cols-9 gap-1.5 mb-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                  // 取り出し時のみ在庫チェック
                  const isOverStock = !isReturn && selectedDrink ? num > selectedDrink.stock : false;
                  const isActive = quantity === num && selectedDrink !== null;
                  return (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handleQuantityTap(num)}
                      disabled={!selectedDrink || isOverStock}
                      className={`h-14 rounded-xl text-xl font-bold transition-all cursor-pointer select-none ${
                        isActive
                          ? isReturn
                            ? "bg-orange-500 text-white shadow-md"
                            : "bg-[var(--color-primary)] text-white shadow-md"
                          : "bg-gray-100 text-[var(--color-text)] hover:bg-gray-200"
                      } ${(!selectedDrink || isOverStock) ? "opacity-30 cursor-not-allowed" : "active:scale-95"}`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* お客様名（取り出し時のみ表示） */}
              {!isReturn && (
                <input
                  type="text"
                  placeholder="お客様名（任意）"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors mb-3"
                />
              )}

              {/* 確定ボタン */}
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!selectedDrink || isSubmitting}
                className={`w-full h-14 rounded-xl text-white text-lg font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${
                  isReturn
                    ? "bg-orange-500 hover:bg-orange-600 active:bg-orange-700"
                    : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:bg-blue-800"
                }`}
              >
                {isSubmitting ? "処理中..." : isReturn ? "返却する" : "確定する"}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
