"use client";

import { useState, useEffect, useCallback } from "react";

interface Employee {
  id: number;
  employeeCode: string;
  name: string;
  role: string;
  isActive: boolean;
}

interface EmployeeForm {
  employeeCode: string;
  name: string;
  role: string;
}

const emptyForm: EmployeeForm = { employeeCode: "", name: "", role: "user" };

export default function EmployeesManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
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

  const loadEmployees = useCallback(async () => {
    const res = await authFetch("/api/employees?active=false");
    setEmployees(await res.json());
  }, [authFetch]);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); };

  const openEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({ employeeCode: emp.employeeCode, name: emp.name, role: emp.role });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.employeeCode.trim() || !form.name.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      const url = editId ? `/api/employees/${editId}` : "/api/employees";
      const method = editId ? "PUT" : "POST";
      const res = await authFetch(url, { method, body: JSON.stringify(form) });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "保存に失敗しました");
      }
      setMessage({ type: "success", text: editId ? "更新しました" : "追加しました" });
      setShowForm(false);
      await loadEmployees();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラー" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`「${name}」を無効にしますか？`)) return;
    try {
      const res = await authFetch(`/api/employees/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("削除に失敗しました");
      setMessage({ type: "success", text: "無効にしました" });
      await loadEmployees();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラー" });
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">社員管理</h1>
        <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">新規追加</button>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-bold mb-4">{editId ? "社員編集" : "社員追加"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">社員番号</label>
              <input type="text" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                disabled={!!editId} maxLength={10}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">氏名</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">権限</label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="user">一般</option>
                <option value="admin">管理者</option>
              </select>
            </div>
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
              <th className="text-left p-3 border-b font-medium text-gray-600">社員番号</th>
              <th className="text-left p-3 border-b font-medium text-gray-600">氏名</th>
              <th className="text-center p-3 border-b font-medium text-gray-600">権限</th>
              <th className="text-center p-3 border-b font-medium text-gray-600">ステータス</th>
              <th className="text-center p-3 border-b font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className={emp.isActive ? "" : "opacity-50"}>
                <td className="p-3 border-b font-mono">{emp.employeeCode}</td>
                <td className="p-3 border-b font-medium">{emp.name}</td>
                <td className="p-3 border-b text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                    {emp.role === "admin" ? "管理者" : "一般"}
                  </span>
                </td>
                <td className="p-3 border-b text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${emp.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {emp.isActive ? "有効" : "無効"}
                  </span>
                </td>
                <td className="p-3 border-b text-center">
                  <button onClick={() => openEdit(emp)} className="text-blue-600 hover:underline mr-3">編集</button>
                  {emp.isActive && <button onClick={() => handleDelete(emp.id, emp.name)} className="text-red-600 hover:underline">削除</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
