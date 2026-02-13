"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Numpad } from "@/components/numpad";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/toast";

export default function LoginPage() {
  const [employeeCode, setEmployeeCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const { login, token, isLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!isLoading && token) {
      router.replace("/drinks");
    }
  }, [token, isLoading, router]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutSeconds]);

  const handleSubmit = async () => {
    if (!employeeCode || isSubmitting || lockoutSeconds > 0) return;

    setIsSubmitting(true);
    try {
      await login(employeeCode);
      router.push("/drinks");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "ログインに失敗しました";

      // Check for lockout response
      if (message.includes("Too many")) {
        // Try to parse remaining time from error
        try {
          const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ employeeCode }),
          });
          if (res.status === 429) {
            const data = await res.json();
            if (data.remainingMs) {
              setLockoutSeconds(Math.ceil(data.remainingMs / 1000));
            }
          }
        } catch {
          setLockoutSeconds(300);
        }
      }

      showToast(message, "error");
      setEmployeeCode("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-8">
        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[var(--color-text)]">
            ドリンク在庫管理
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-2">
            社員コードを入力してください
          </p>
        </div>

        {/* Lockout warning */}
        {lockoutSeconds > 0 && (
          <div className="w-full bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
            <p className="text-[var(--color-danger)] font-semibold text-sm">
              ログイン試行回数を超えました
            </p>
            <p className="text-2xl font-bold text-[var(--color-danger)] mt-1">
              {Math.floor(lockoutSeconds / 60)}:
              {String(lockoutSeconds % 60).padStart(2, "0")}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              しばらくお待ちください
            </p>
          </div>
        )}

        {/* Numpad */}
        <div className={lockoutSeconds > 0 ? "opacity-40 pointer-events-none" : ""}>
          <Numpad
            value={employeeCode}
            onChange={setEmployeeCode}
            maxLength={4}
            onSubmit={handleSubmit}
            submitLabel={isSubmitting ? "..." : "ログイン"}
          />
        </div>
      </div>
    </div>
  );
}
