"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface Employee {
  sub: number;
  employeeCode: string;
  name: string;
  role: string;
}

function decodeJwtPayload(token: string): Employee & { exp: number } {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("")
  );
  return JSON.parse(jsonPayload);
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJwtPayload(token);
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

const AUTO_LOGOUT_MS = 3 * 60 * 1000; // 3分間操作がなければ自動ログアウト

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const lastActivityRef = useRef<number>(Date.now());
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setEmployee(null);
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    window.location.href = "/login";
  }, []);

  // 自動ログアウトタイマーをリセット
  const resetAutoLogoutTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    const currentToken = localStorage.getItem("token");
    if (currentToken) {
      logoutTimerRef.current = setTimeout(() => {
        logout();
      }, AUTO_LOGOUT_MS);
    }
  }, [logout]);

  // ユーザー操作を検知して自動ログアウトタイマーをリセット
  useEffect(() => {
    if (!token) return;

    const events = ["mousedown", "touchstart", "keydown", "scroll"] as const;

    const handleActivity = () => {
      resetAutoLogoutTimer();
    };

    events.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // 初期タイマー開始
    resetAutoLogoutTimer();

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    };
  }, [token, resetAutoLogoutTimer]);

  // トークンの期限切れを定期チェック
  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (isTokenExpired(token)) {
        logout();
      }
    }, 30 * 1000); // 30秒ごとにチェック

    return () => clearInterval(interval);
  }, [token, logout]);

  useEffect(() => {
    const stored = localStorage.getItem("token");
    if (stored) {
      if (isTokenExpired(stored)) {
        localStorage.removeItem("token");
        setToken(null);
        setEmployee(null);
      } else {
        setToken(stored);
        try {
          const payload = decodeJwtPayload(stored);
          setEmployee({
            sub: payload.sub,
            employeeCode: payload.employeeCode,
            name: payload.name,
            role: payload.role,
          });
        } catch {
          localStorage.removeItem("token");
        }
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (employeeCode: string): Promise<Employee> => {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(
          data.error || "ログインに失敗しました",
        );
      }

      const data = await res.json();
      localStorage.setItem("token", data.token);
      setToken(data.token);

      const payload = decodeJwtPayload(data.token);
      const emp: Employee = {
        sub: payload.sub,
        employeeCode: payload.employeeCode,
        name: payload.name,
        role: payload.role,
      };
      setEmployee(emp);
      return emp;
    },
    []
  );

  const isAdmin = employee?.role === "admin";

  return { token, employee, login, logout, isAdmin, isLoading };
}
