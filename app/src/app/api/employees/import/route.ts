import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

interface CsvRow {
  employeeCode: string;
  name: string;
  role: string;
}

function parseCsvContent(text: string): { rows: CsvRow[]; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    errors.push("CSVファイルが空です");
    return { rows: [], errors };
  }

  // ヘッダー行を確認（BOM除去）
  const headerLine = lines[0].replace(/^\uFEFF/, "").trim();
  const headers = headerLine.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));

  const codeIdx = headers.findIndex(
    (h) => h === "社員番号" || h.toLowerCase() === "employeecode" || h === "code"
  );
  const nameIdx = headers.findIndex(
    (h) => h === "氏名" || h === "名前" || h.toLowerCase() === "name"
  );
  const roleIdx = headers.findIndex(
    (h) => h === "権限" || h === "ロール" || h.toLowerCase() === "role"
  );

  if (codeIdx === -1 || nameIdx === -1) {
    errors.push(
      "ヘッダーに「社員番号」と「氏名」列が必要です。検出されたヘッダー: " +
        headers.join(", ")
    );
    return { rows: [], errors };
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const code = (cols[codeIdx] || "").trim();
    const name = (cols[nameIdx] || "").trim();
    let role = roleIdx !== -1 ? (cols[roleIdx] || "").trim() : "user";

    if (!code || !name) {
      errors.push(`${i + 1}行目: 社員番号または氏名が空です`);
      continue;
    }

    if (code.length > 8) {
      errors.push(`${i + 1}行目: 社員番号が8桁を超えています（${code}）`);
      continue;
    }

    if (name.length > 100) {
      errors.push(`${i + 1}行目: 氏名が100文字を超えています`);
      continue;
    }

    // 権限の正規化
    if (role === "管理者" || role === "admin") {
      role = "admin";
    } else {
      role = "user";
    }

    rows.push({ employeeCode: code, name, role });
  }

  return { rows, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export async function POST(request: NextRequest) {
  try {
    requireAdmin(request);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!file.name.endsWith(".csv")) {
      return NextResponse.json({ error: "CSVファイルを選択してください" }, { status: 400 });
    }

    const text = await file.text();
    const { rows, errors } = parseCsvContent(text);

    if (rows.length === 0 && errors.length > 0) {
      return NextResponse.json({ error: "CSVの解析に失敗しました", details: errors }, { status: 400 });
    }

    // 重複チェック（CSV内）
    const codeSet = new Set<string>();
    for (const row of rows) {
      if (codeSet.has(row.employeeCode)) {
        errors.push(`社員番号「${row.employeeCode}」がCSV内で重複しています`);
      }
      codeSet.add(row.employeeCode);
    }

    if (errors.length > 0 && rows.length === 0) {
      return NextResponse.json({ error: "CSVの解析に失敗しました", details: errors }, { status: 400 });
    }

    // upsert: 既存の社員番号があれば更新、なければ作成
    const results = {
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [...errors],
    };

    for (const row of rows) {
      try {
        const existing = await prisma.employee.findUnique({
          where: { employeeCode: row.employeeCode },
        });

        if (existing) {
          await prisma.employee.update({
            where: { employeeCode: row.employeeCode },
            data: { name: row.name, role: row.role, isActive: true },
          });
          results.updated++;
        } else {
          await prisma.employee.create({
            data: { employeeCode: row.employeeCode, name: row.name, role: row.role },
          });
          results.created++;
        }
      } catch (err) {
        results.skipped++;
        results.errors.push(
          `社員番号「${row.employeeCode}」の処理でエラー: ${err instanceof Error ? err.message : "不明なエラー"}`
        );
      }
    }

    return NextResponse.json({
      message: `処理完了: 新規${results.created}件、更新${results.updated}件${results.skipped > 0 ? `、スキップ${results.skipped}件` : ""}`,
      created: results.created,
      updated: results.updated,
      skipped: results.skipped,
      errors: results.errors,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("CSV import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
