"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuth } from "@/hooks/use-auth";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { token, isAdmin, isLoading } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!token) {
      router.replace("/login");
      return;
    }

    if (!isAdmin) {
      router.replace("/drinks");
      return;
    }

    setAuthorized(true);
  }, [token, isAdmin, isLoading, router]);

  if (isLoading || !authorized) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-[var(--color-text-secondary)]">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 lg:ml-0 p-6 overflow-auto">{children}</main>
    </div>
  );
}
