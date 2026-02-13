"use client";

import { useState, useEffect, useCallback, useRef } from "react";

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

interface ImportResult {
  message: string;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const emptyForm: EmployeeForm = { employeeCode: "", name: "", role: "user" };

export default function EmployeesManagementPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const authFetch = useCallback(async (url: string, options?: RequestInit) => {
    const token = localStorage.getItem("token");
    const res = await fetch(url, {
      ...options,
      headers: {
        ...(options?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
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

  const openAdd = () => { setEditId(null); setForm(emptyForm); setShowForm(true); setShowImport(false); };

  const openEdit = (emp: Employee) => {
    setEditId(emp.id);
    setForm({ employeeCode: emp.employeeCode, name: emp.name, role: emp.role });
    setShowForm(true);
    setShowImport(false);
  };

  const openImport = () => {
    setShowImport(true);
    setShowForm(false);
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
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

  const handleCsvImport = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await authFetch("/api/employees/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setImportResult({
          message: data.error || "インポートに失敗しました",
          created: 0,
          updated: 0,
          skipped: 0,
          errors: data.details || [],
        });
        return;
      }

      setImportResult(data);
      await loadEmployees();
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "エラー" });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const bom = "\uFEFF";
    const csv = bom + "社員番号,氏名,権限\n00000001,山田太郎,一般\n00000002,鈴木花子,管理者\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "社員一括登録テンプレート.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">社員管理</h1>
        <div className="flex gap-2">
          <button onClick={openImport} className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700">
            CSV一括登録
          </button>
          <button onClick={openAdd} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            新規追加
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
          {message.text}
        </div>
      )}

      {/* CSV一括登録パネル */}
      {showImport && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-green-200">
          <h2 className="text-lg font-bold mb-4">CSV一括登録</h2>

          <div className="bg-gray-50 rounded-lg p-4 mb-4 text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-2">CSVフォーマット</p>
            <p className="mb-1">ヘッダー行（1行目）に以下の列名を含めてください:</p>
            <ul className="list-disc list-inside ml-2 mb-2 space-y-0.5">
              <li><span className="font-mono bg-white px-1 rounded">社員番号</span> （必須・8桁）</li>
              <li><span className="font-mono bg-white px-1 rounded">氏名</span> （必須・最大100文字）</li>
              <li><span className="font-mono bg-white px-1 rounded">権限</span> （任意・「管理者」or「一般」。省略時は一般）</li>
            </ul>
            <p className="text-xs text-gray-500">既存の社員番号がある場合は氏名・権限を上書き更新します</p>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 file:cursor-pointer"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCsvImport}
              disabled={importing}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {importing ? "インポート中..." : "インポート実行"}
            </button>
            <button
              onClick={downloadTemplate}
              className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg hover:bg-gray-200"
            >
              テンプレートDL
            </button>
            <button
              onClick={() => { setShowImport(false); setImportResult(null); }}
              className="bg-gray-100 text-gray-600 px-5 py-2 rounded-lg hover:bg-gray-200"
            >
              閉じる
            </button>
          </div>

          {/* インポート結果 */}
          {importResult && (
            <div className={`mt-4 p-4 rounded-lg ${importResult.created > 0 || importResult.updated > 0 ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
              <p className="font-bold mb-2">{importResult.message}</p>
              {(importResult.created > 0 || importResult.updated > 0) && (
                <div className="flex gap-4 text-sm mb-2">
                  <span className="text-green-700">新規作成: {importResult.created}件</span>
                  <span className="text-blue-700">更新: {importResult.updated}件</span>
                  {importResult.skipped > 0 && (
                    <span className="text-red-700">スキップ: {importResult.skipped}件</span>
                  )}
                </div>
              )}
              {importResult.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-sm font-medium text-red-700 mb-1">エラー詳細:</p>
                  <ul className="text-xs text-red-600 space-y-0.5 max-h-32 overflow-y-auto">
                    {importResult.errors.map((err, i) => (
                      <li key={i}>・{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 個別追加/編集フォーム */}
      {showForm && (
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 border-2 border-blue-200">
          <h2 className="text-lg font-bold mb-4">{editId ? "社員編集" : "社員追加"}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">社員番号</label>
              <input type="text" value={form.employeeCode} onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
                disabled={!!editId} maxLength={8}
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

      {/* 社員一覧テーブル */}
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
            {employees.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-gray-400">社員が登録されていません</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
