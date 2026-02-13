"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function CompleteContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(3);

  const drinkName = searchParams.get("drink") || "";
  const quantity = searchParams.get("quantity") || "1";
  const customerName = searchParams.get("customer") || "";

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.replace("/drinks");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  const progressWidth = ((3 - countdown) / 3) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md flex flex-col items-center gap-6 text-center">
        {/* Check mark */}
        <div className="w-24 h-24 rounded-full bg-green-100 flex items-center justify-center">
          <span className="text-5xl text-[var(--color-success)]">
            &#10003;
          </span>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          記録完了
        </h1>

        {/* Details */}
        <div className="w-full bg-[var(--color-card)] rounded-xl border-2 border-[var(--color-border)] p-6">
          <div className="flex flex-col gap-3">
            <div className="flex justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">
                ドリンク
              </span>
              <span className="font-semibold">{drinkName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">
                数量
              </span>
              <span className="font-semibold">{quantity}</span>
            </div>
            {customerName && (
              <div className="flex justify-between">
                <span className="text-sm text-[var(--color-text-secondary)]">
                  お客様名
                </span>
                <span className="font-semibold">{customerName}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--color-primary)] rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${progressWidth}%` }}
            />
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-2">
            {countdown}秒後に自動的に戻ります
          </p>
        </div>

        {/* Quick return button */}
        <button
          type="button"
          onClick={() => router.replace("/drinks")}
          className="px-6 py-3 rounded-xl bg-gray-100 border-2 border-[var(--color-border)] text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-200 transition-colors cursor-pointer"
        >
          すぐに戻る
        </button>
      </div>
    </div>
  );
}

export default function CompletePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-[var(--color-text-secondary)]">
            読み込み中...
          </div>
        </div>
      }
    >
      <CompleteContent />
    </Suspense>
  );
}
