"use client";

import { useState, useEffect, useCallback } from "react";

interface SettingField {
  key: string;
  label: string;
  type: "text" | "number";
  placeholder?: string;
}

const fields: SettingField[] = [
  { key: "notification_webhook_url", label: "Google Chat Webhook URL", type: "text", placeholder: "https://chat.googleapis.com/v1/spaces/..." },
  { key: "inventory_check_reminder", label: "棚卸しリマインダー時刻", type: "text", placeholder: "09:00,18:00" },
  { key: "lockout_max_attempts", label: "ロックアウト最大試行回数", type: "number" },
  { key: "lockout_duration_minutes", label: "ロックアウト時間（分）", type: "number" },
  { key: "session_timeout_minutes", label: "セッションタイムアウト（分）", type: "number" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options?.headers,
      },
    });
    if (res.status === 401) { window.location.href = "/login"; throw new Error("Unauthorized"); }
    return res;
  }, []);

  useEffect(() => {
    authFetch("/api/settings").then(async (res) => {
      setSettings(await res.json());
    });
  }, [authFetch]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await authFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("保存に失敗しました");
      setMessage({ type: "success", text: "設定を保存しました" });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラー" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">設定</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="space-y-6">
          {fields.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type}
                value={settings[field.key] || ""}
                onChange={(e) => setSettings({ ...settings, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="border border-gray-300 rounded-lg px-3 py-3 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <div className="mt-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
