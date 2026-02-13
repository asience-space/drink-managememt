"use client";

import { useState, useEffect, useCallback } from "react";

interface Drink {
  id: number;
  name: string;
  stock: number;
  sortOrder: number;
  isActive: boolean;
}

interface DrinkForm {
  name: string;
  sortOrder: number;
  stock: number;
  isActive: boolean;
}

const emptyForm: DrinkForm = { name: "", sortOrder: 0, stock: 0, isActive: true };

export default function DrinksManagementPage() {
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<DrinkForm>(emptyForm);
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

  const loadDrinks = useCallback(async () => {
    const res = await authFetch("/api/drinks?active=false");
    setDrinks(await res.json());
  }, [authFetch]);

  useEffect(() => { loadDrinks(); }, [loadDrinks]);

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (drink: Drink) => {
    setEditId(drink.id);
    setForm({ name: drink.name, sortOrder: drink.sortOrder, stock: drink.stock, isActive: drink.isActive });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const url = editId ? `/api/drinks/${editId}` : "/api/drinks";
      const method = editId ? "PUT" : "POST";
      const body = editId
        ? { name: form.name, sortOrder: form.sortOrder, isActive: form.isActive }
        : { name: form.name, sortOrder: form.sortOrder, stock: form.stock };
      const res = await authFetch(url, { method, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }
      setMessage({ type: "success", text: editId ? "更新しました" : "追加しました" });
      setShowForm(false);
      await loadDrinks();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラー" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を無効にしますか？`)) return;
    try {
      const res = await authFetch(`/api/drinks/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setMessage({ type: "success", text: "無効にしました" });
      await loadDrinks();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラー" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ドリンク管理</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">新規追加</button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-bold mb-4">{editId ? "ドリンク編集" : "ドリンク追加"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">ドリンク名</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">並び順</label>
              <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            {!editId && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">初期在庫</label>
                <input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                  className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            {editId && (
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="w-5 h-5" />
                <label htmlFor="isActive" className="text-sm">有効</label>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleSave} disabled={saving} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? "保存中..." : "保存"}
            </button>
            <button onClick={() => setShowForm(false)} className="bg-gray-100 text-gray-600 px-6 py-2 rounded-lg hover:bg-gray-200">キャンセル</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left p-3 border-b font-medium text-gray-600">並び順</th>
              <th className="text-left p-3 border-b font-medium text-gray-600">ドリンク名</th>
              <th className="text-center p-3 border-b font-medium text-gray-600">在庫数</th>
              <th className="text-center p-3 border-b font-medium text-gray-600">ステータス</th>
              <th className="text-center p-3 border-b font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {drinks.map((d) => (
              <tr key={d.id} className={d.isActive ? "" : "opacity-50"}>
                <td className="p-3 border-b">{d.sortOrder}</td>
                <td className="p-3 border-b font-medium">{d.name}</td>
                <td className="p-3 border-b text-center">{d.stock}</td>
                <td className="p-3 border-b text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${d.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {d.isActive ? "有効" : "無効"}
                  </span>
                </td>
                <td className="p-3 border-b text-center">
                  <button onClick={() => openEdit(d)} className="text-blue-600 hover:underline mr-3">編集</button>
                  {d.isActive && <button onClick={() => handleDelete(d.id, d.name)} className="text-red-600 hover:underline">削除</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
