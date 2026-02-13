"use client";

export function useAuthFetch() {
  const getHeaders = () => {
    const token = localStorage.getItem("token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const authFetch = async (url: string, options?: RequestInit) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...getHeaders(), ...options?.headers },
    });
    if (res.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    return res;
  };

  return { authFetch };
}
