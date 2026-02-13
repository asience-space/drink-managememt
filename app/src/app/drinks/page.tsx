"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DrinkTile } from "@/components/drink-tile";
import { QuantitySelector } from "@/components/quantity-selector";
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

export default function DrinksPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingDrinks, setLoadingDrinks] = useState(true);

  const { employee, token, isLoading, isAdmin, logout } = useAuth();
  const { authFetch } = useAuthFetch();
  const { showToast } = useToast();
  const router = useRouter();

  // Auth check
  useEffect(() => {
    if (!isLoading && !token) {
      router.replace("/login");
    }
  }, [token, isLoading, router]);

  // Fetch drinks
  useEffect(() => {
    if (!token) return;

    const fetchDrinks = async () => {
      try {
        const res = await authFetch("/api/drinks");
        if (res.ok) {
          const data = await res.json();
          setDrinks(data);
        }
      } catch {
        showToast("ドリンク一覧の取得に失敗しました", "error");
      } finally {
        setLoadingDrinks(false);
      }
    };
    fetchDrinks();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectDrink = (drink: Drink) => {
    if (drink.stock <= 0) return;
    if (selectedDrink?.id === drink.id) {
      setSelectedDrink(null);
      setQuantity(1);
    } else {
      setSelectedDrink(drink);
      setQuantity(1);
    }
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
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-[var(--color-card)] border-b-2 border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--color-text)]">
            ようこそ {employee?.name}さん
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => router.push("/admin/dashboard")}
              className="px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-200 transition-colors cursor-pointer"
            >
              管理画面
            </button>
          )}
          <button
            type="button"
            onClick={logout}
            className="px-4 py-2.5 rounded-lg bg-gray-100 text-sm font-medium text-[var(--color-danger)] hover:bg-red-50 transition-colors cursor-pointer"
          >
            ログアウト
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-6">
        {loadingDrinks ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-[var(--color-text-secondary)]">
              ドリンクを読み込み中...
            </div>
          </div>
        ) : (
          <>
            {/* Drink grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
              {drinks.map((drink) => (
                <DrinkTile
                  key={drink.id}
                  drink={drink}
                  selected={selectedDrink?.id === drink.id}
                  onClick={() => handleSelectDrink(drink)}
                  disabled={drink.stock <= 0}
                />
              ))}
            </div>

            {/* Selection area */}
            {selectedDrink && (
              <div className="fixed bottom-0 left-0 right-0 bg-[var(--color-card)] border-t-2 border-[var(--color-border)] p-6 shadow-[0_-4px_12px_rgba(0,0,0,0.1)]">
                <div className="max-w-2xl mx-auto flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-lg font-bold text-[var(--color-text)]">
                        {selectedDrink.name}
                      </span>
                      <span className="ml-3 text-sm text-[var(--color-text-secondary)]">
                        在庫: {selectedDrink.stock}
                      </span>
                    </div>
                    <QuantitySelector
                      value={quantity}
                      onChange={setQuantity}
                      min={1}
                      max={selectedDrink.stock}
                    />
                  </div>

                  {/* Customer name input */}
                  <input
                    type="text"
                    placeholder="お客様名（任意）"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border-2 border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
                  />

                  {/* Confirm button */}
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isSubmitting}
                    className="w-full h-14 rounded-xl bg-[var(--color-primary)] text-white text-lg font-bold hover:bg-[var(--color-primary-hover)] active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isSubmitting ? "処理中..." : "確定する"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
