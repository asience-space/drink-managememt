"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const navItems: NavItem[] = [
  { label: "ダッシュボード", href: "/admin/dashboard", icon: "\u{1F4CA}" },
  { label: "入庫登録", href: "/admin/stock-in", icon: "\u{1F4E6}" },
  { label: "棚卸し", href: "/admin/inventory", icon: "\u{1F4CB}" },
  { label: "履歴検索", href: "/admin/history", icon: "\u{1F50D}" },
  { label: "ドリンク管理", href: "/admin/master/drinks", icon: "\u{1F379}" },
  { label: "社員管理", href: "/admin/master/employees", icon: "\u{1F465}" },
  { label: "設定", href: "/admin/settings", icon: "\u2699\uFE0F" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Mobile hamburger toggle */}
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="fixed top-4 left-4 z-50 w-12 h-12 rounded-xl bg-[var(--color-card)] border-2 border-[var(--color-border)] flex items-center justify-center text-xl shadow-md lg:hidden cursor-pointer"
      >
        {collapsed ? "\u2717" : "\u2630"}
      </button>

      {/* Overlay for mobile */}
      {collapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setCollapsed(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-full w-64 bg-[var(--color-card)] border-r-2 border-[var(--color-border)] flex flex-col transition-transform duration-200 ${
          collapsed ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0 lg:static lg:z-auto`}
      >
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold text-[var(--color-text)]">
            管理画面
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            ドリンク在庫管理
          </p>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setCollapsed(false)}
                className={`flex items-center gap-3 px-5 py-3 mx-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] hover:bg-gray-50 hover:text-[var(--color-text)]"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-[var(--color-border)] p-4 flex flex-col gap-2">
          <Link
            href="/drinks"
            onClick={() => setCollapsed(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-gray-50 hover:text-[var(--color-text)] transition-colors"
          >
            <span className="text-lg">{"\u{1F3E0}"}</span>
            <span>取り出し画面へ</span>
          </Link>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[var(--color-danger)] hover:bg-red-50 transition-colors cursor-pointer"
          >
            <span className="text-lg">{"\u{1F6AA}"}</span>
            <span>ログアウト</span>
          </button>
        </div>
      </aside>
    </>
  );
}
