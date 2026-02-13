"use client";

import { useState, useEffect, useCallback } from "react";

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

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setEmployee(null);
    window.location.href = "/login";
  }, []);

  const isAdmin = employee?.role === "admin";

  return { token, employee, login, logout, isAdmin, isLoading };
}
