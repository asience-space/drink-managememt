# 設計書：ドリンク在庫管理アプリケーション

- **バージョン**: 1.2
- **作成日**: 2026年2月13日
- **対応要件定義書**: v1.4

-----

## 目次

1. [ディレクトリ構成・アーキテクチャ](#1-ディレクトリ構成アーキテクチャ)
2. [データベース詳細設計](#2-データベース詳細設計)
3. [API設計](#3-api設計)
4. [画面設計](#4-画面設計)
5. [認証・認可設計](#5-認証認可設計)
6. [通知設計](#6-通知設計)
7. [エラーハンドリング方針](#7-エラーハンドリング方針)

-----

## 1. ディレクトリ構成・アーキテクチャ

### 1.1 全体アーキテクチャ

```
┌─────────────────────────────────────────────────────┐
│  ブラウザ（タブレット / スマートフォン）                    │
│  Next.js App Router (React Server Components + CSR)  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────┐
│  Next.js サーバー                                      │
│  ┌─────────────────┐  ┌──────────────────────────┐  │
│  │ App Router       │  │ API Routes (/api/*)      │  │
│  │ (SSR/CSR)        │  │ (REST API)               │  │
│  └─────────────────┘  └────────────┬─────────────┘  │
│                                     │                │
│  ┌──────────────────────────────────▼─────────────┐  │
│  │ サービス層 (lib/services/*)                       │  │
│  │ ビジネスロジック・バリデーション                       │  │
│  └──────────────────────────────────┬─────────────┘  │
│                                     │                │
│  ┌──────────────────────────────────▼─────────────┐  │
│  │ Prisma ORM                                      │  │
│  └──────────────────────────────────┬─────────────┘  │
└─────────────────────────────────────┼────────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │  SQLite                      │
                       │  (prisma/dev.db)             │
                       └─────────────────────────────┘
```

### 1.2 ディレクトリ構成

```
drink-management/
├── prisma/
│   ├── schema.prisma          # DBスキーマ定義
│   ├── seed.ts                # シードデータ
│   └── migrations/            # マイグレーションファイル
├── public/
│   ├── uploads/               # ドリンク画像アップロード先
│   │   └── drinks/
│   └── icons/                 # PWAアイコン等
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # ルートレイアウト
│   │   ├── page.tsx           # リダイレクト → /login
│   │   ├── login/
│   │   │   └── page.tsx       # S-01: ログイン画面
│   │   ├── drinks/
│   │   │   └── page.tsx       # S-02: ドリンク取り出し画面
│   │   ├── complete/
│   │   │   └── page.tsx       # S-03: 記録完了画面
│   │   ├── admin/
│   │   │   ├── layout.tsx     # 管理者レイアウト（サイドバー付き）
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx   # S-06: ダッシュボード画面
│   │   │   ├── stock-in/
│   │   │   │   └── page.tsx   # S-04: 入庫登録画面
│   │   │   ├── inventory/
│   │   │   │   └── page.tsx   # S-05: 棚卸し画面
│   │   │   ├── history/
│   │   │   │   └── page.tsx   # S-07: 履歴検索画面
│   │   │   ├── master/
│   │   │   │   ├── drinks/
│   │   │   │   │   └── page.tsx # S-08: ドリンクマスタ管理
│   │   │   │   └── employees/
│   │   │   │       └── page.tsx # S-08: 社員マスタ管理
│   │   │   └── settings/
│   │   │       └── page.tsx   # S-09: 設定画面
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/route.ts
│   │       │   └── me/route.ts
│   │       ├── drinks/
│   │       │   ├── route.ts           # GET(一覧), POST(新規)
│   │       │   └── [id]/route.ts      # GET, PUT, DELETE
│   │       ├── transactions/
│   │       │   ├── route.ts           # GET(一覧), POST(取り出し記録)
│   │       │   └── export/route.ts    # GET(CSV出力)
│   │       ├── stock-entries/
│   │       │   └── route.ts           # GET(一覧), POST(入庫登録)
│   │       ├── inventory-checks/
│   │       │   ├── route.ts           # GET(一覧), POST(棚卸し登録+在庫更新)
│   │       │   ├── sessions/route.ts  # GET(セッション別一覧)
│   │       │   ├── cleanup/route.ts   # DELETE(1年以上前のデータ削除)
│   │       │   └── export/route.ts    # GET(CSV出力)
│   │       ├── employees/
│   │       │   ├── route.ts           # GET(一覧), POST(新規)
│   │       │   ├── import/route.ts    # POST(CSV一括登録)
│   │       │   └── [id]/route.ts      # GET, PUT, DELETE
│   │       ├── dashboard/
│   │       │   └── route.ts           # GET(ダッシュボード集計)
│   │       ├── settings/
│   │       │   └── route.ts           # GET, PUT
│   │       └── upload/
│   │           └── route.ts           # POST(画像アップロード)
│   ├── components/
│   │   ├── ui/                # shadcn/ui コンポーネント
│   │   ├── drink-tile.tsx     # ドリンクタイルコンポーネント
│   │   ├── quantity-selector.tsx # 数量選択 (+/- ボタン)
│   │   ├── numpad.tsx         # テンキーコンポーネント
│   │   ├── sidebar.tsx        # 管理画面サイドバー
│   │   ├── stock-badge.tsx    # 在庫数バッジ
│   │   ├── diff-indicator.tsx # 差分表示コンポーネント
│   │   └── chart-card.tsx     # グラフカードコンポーネント
│   ├── lib/
│   │   ├── prisma.ts          # Prismaクライアント (シングルトン)
│   │   ├── auth.ts            # JWT生成・検証ユーティリティ
│   │   ├── notifications.ts   # Google Chat Webhook通知
│   │   ├── csv.ts             # CSV生成ユーティリティ
│   │   ├── constants.ts       # 定数定義
│   │   ├── validations.ts     # Zodバリデーションスキーマ
│   │   └── services/
│   │       ├── drink-service.ts       # ドリンクCRUD
│   │       ├── transaction-service.ts # 取り出し記録
│   │       ├── stock-service.ts       # 入庫・在庫計算
│   │       ├── inventory-service.ts   # 棚卸し・差分計算
│   │       ├── employee-service.ts    # 社員CRUD
│   │       ├── dashboard-service.ts   # ダッシュボード集計
│   │       └── settings-service.ts    # 設定管理
│   ├── hooks/
│   │   ├── use-auth.ts        # 認証状態管理（自動ログアウト・トークン期限チェック含む）
│   │   ├── use-fetch.ts       # 認証付きfetchフック
│   │   └── use-drinks.ts      # ドリンクデータ取得
│   └── types/
│       └── index.ts           # 共通型定義
├── .env.local                 # 環境変数（テンプレート: .env.example）
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

### 1.3 レイヤー構成の方針

| レイヤー | 役割 | 配置場所 |
|---------|------|---------|
| プレゼンテーション | 画面表示・ユーザー操作 | `src/app/`（ページ）, `src/components/` |
| API | HTTPリクエスト/レスポンス処理、入力バリデーション | `src/app/api/` |
| サービス | ビジネスロジック、データ加工、通知発火 | `src/lib/services/` |
| データアクセス | DB操作（Prisma経由） | サービス層から直接Prismaクライアントを呼び出し |

-----

## 2. データベース詳細設計

### 2.1 Prismaスキーマ

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Employee {
  id           Int              @id @default(autoincrement())
  employeeCode String           @unique @map("employee_code")
  name         String
  role         String           @default("user") // "admin" | "user"
  isActive     Boolean          @default(true) @map("is_active")
  createdAt    DateTime         @default(now()) @map("created_at")
  updatedAt    DateTime         @updatedAt @map("updated_at")

  transactions    Transaction[]
  stockEntries    StockEntry[]
  inventoryChecks InventoryCheck[]

  @@map("employees")
}

model Drink {
  id         Int      @id @default(autoincrement())
  name       String
  imageUrl   String?  @map("image_url")
  stock      Int      @default(0)
  unitWeight Decimal? @map("unit_weight") // 将来: 重量センサー用
  sortOrder  Int      @default(0) @map("sort_order")
  isActive   Boolean  @default(true) @map("is_active")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  transactions    Transaction[]
  stockEntries    StockEntry[]
  inventoryChecks InventoryCheck[]

  @@map("drinks")
}

model Transaction {
  id           Int      @id @default(autoincrement())
  employeeId   Int      @map("employee_id")
  drinkId      Int      @map("drink_id")
  quantity     Int
  type         String   @default("takeout") // "takeout" | "return"
  customerName String?  @map("customer_name")
  source       String   @default("manual") // "manual" | "sensor"（将来拡張用）
  createdAt    DateTime @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id])
  drink    Drink    @relation(fields: [drinkId], references: [id])

  @@index([createdAt])
  @@index([employeeId])
  @@index([drinkId])
  @@map("transactions")
}

model StockEntry {
  id         Int      @id @default(autoincrement())
  employeeId Int      @map("employee_id")
  drinkId    Int      @map("drink_id")
  quantity   Int
  createdAt  DateTime @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id])
  drink    Drink    @relation(fields: [drinkId], references: [id])

  @@index([createdAt])
  @@map("stock_entries")
}

model InventoryCheck {
  id          Int      @id @default(autoincrement())
  employeeId  Int      @map("employee_id")
  drinkId     Int      @map("drink_id")
  systemStock Int      @map("system_stock")
  actualStock Int      @map("actual_stock")
  diff        Int
  checkType   String   @default("manual") @map("check_type") // "manual" | "auto"（将来拡張用）
  createdAt   DateTime @default(now()) @map("created_at")

  employee Employee @relation(fields: [employeeId], references: [id])
  drink    Drink    @relation(fields: [drinkId], references: [id])

  @@index([createdAt])
  @@map("inventory_checks")
}

model Setting {
  key   String @id
  value String

  @@map("settings")
}
```

### 2.2 初期シードデータ

```typescript
// prisma/seed.ts
const seedData = {
  employees: [
    { employeeCode: "0001", name: "管理者", role: "admin" },
  ],
  drinks: [
    { name: "お茶（緑茶）", stock: 10, sortOrder: 1 },
    { name: "お茶（ほうじ茶）", stock: 10, sortOrder: 2 },
    { name: "コーヒー（ブラック）", stock: 10, sortOrder: 3 },
    { name: "コーヒー（微糖）", stock: 10, sortOrder: 4 },
    { name: "水", stock: 10, sortOrder: 5 },
    { name: "オレンジジュース", stock: 5, sortOrder: 6 },
  ],
  settings: [
    { key: "notification_webhook_url", value: "" },
    { key: "inventory_check_reminder", value: "09:00,18:00" },
    { key: "lockout_duration_minutes", value: "5" },
    { key: "lockout_max_attempts", value: "3" },
    { key: "session_timeout_minutes", value: "30" },
  ],
};
```

### 2.3 在庫計算ロジック

在庫数は `drinks.stock` カラムに保持し、以下のタイミングで更新する。

| イベント | 計算 |
|---------|------|
| 取り出し記録（Transaction type=takeout） | `stock -= quantity` |
| 返却記録（Transaction type=return） | `stock += quantity` |
| 入庫登録（StockEntry作成） | `stock += quantity` |
| 棚卸し確定（InventoryCheck作成） | `stock = actualStock`（棚卸し確定時に自動更新） |

取り出し時に在庫数が0未満になる記録は、APIバリデーションで拒否する。返却時は在庫チェックなし。棚卸し確定時は、棚卸し記録の作成と在庫更新をトランザクションで一括実行する。

-----

## 3. API設計

### 3.1 共通仕様

| 項目 | 仕様 |
|------|------|
| ベースパス | `/api` |
| 認証 | `Authorization: Bearer <JWT>` ヘッダー（ログインAPI以外） |
| リクエスト形式 | `application/json` |
| レスポンス形式 | `application/json`（CSV出力APIを除く） |
| エラーレスポンス | `{ "error": "エラーメッセージ" }` |
| バリデーション | Zodによるリクエストボディの検証 |

### 3.2 認証API

#### POST /api/auth/login

社員番号でログインし、JWTトークンを返す。

**リクエスト:**
```json
{
  "employeeCode": "0001"
}
```

**レスポンス（200）:**
```json
{
  "token": "eyJhbGciOi...",
  "employee": {
    "id": 1,
    "employeeCode": "0001",
    "name": "管理者",
    "role": "admin"
  }
}
```

**エラー（401）:** 社員番号が存在しない場合
```json
{ "error": "社員番号が見つかりません" }
```

**エラー（429）:** ロックアウト中の場合
```json
{ "error": "ログイン試行回数の上限を超えました。5分後に再試行してください" }
```

**ロックアウト仕様:**
- 連続3回の不正な社員番号入力でロックアウト発動
- ロックアウト時間: 5分間
- IPアドレスまたはセッション単位で管理
- ロックアウト回数・時間はsettingsテーブルで変更可能

#### GET /api/auth/me

現在のログインユーザー情報を返す。

**レスポンス（200）:**
```json
{
  "id": 1,
  "employeeCode": "0001",
  "name": "管理者",
  "role": "admin"
}
```

### 3.3 ドリンクAPI

#### GET /api/drinks

ドリンク一覧を取得する。

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| active | boolean | No | `true`: 有効のみ（デフォルト）, `false`: 全件 |

**レスポンス（200）:**
```json
{
  "drinks": [
    {
      "id": 1,
      "name": "お茶（緑茶）",
      "imageUrl": "/uploads/drinks/green-tea.jpg",
      "stock": 8,
      "sortOrder": 1,
      "isActive": true
    }
  ]
}
```

#### POST /api/drinks（管理者のみ）

ドリンクを新規登録する。

**リクエスト:**
```json
{
  "name": "紅茶",
  "sortOrder": 7,
  "stock": 10
}
```

**レスポンス（201）:** 作成されたドリンクオブジェクト

#### GET /api/drinks/[id]

指定IDのドリンク詳細を取得する。

#### PUT /api/drinks/[id]（管理者のみ）

ドリンク情報を更新する。

**リクエスト:**
```json
{
  "name": "紅茶（アールグレイ）",
  "sortOrder": 7,
  "isActive": true
}
```

#### DELETE /api/drinks/[id]（管理者のみ）

ドリンクを論理削除する（`isActive = false`）。

### 3.4 取り出し記録API

#### POST /api/transactions

ドリンク取り出しまたは返却を記録する。取り出し時は在庫を減算、返却時は在庫を加算する。

**リクエスト:**
```json
{
  "drinkId": 1,
  "quantity": 2,
  "type": "takeout",
  "customerName": "山田様"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| drinkId | number | Yes | ドリンクID |
| quantity | number | Yes | 数量（1以上） |
| type | string | No | "takeout"（デフォルト）または "return" |
| customerName | string | No | お客様名（任意） |

**レスポンス（201）:**
```json
{
  "id": 1,
  "employeeId": 1,
  "drinkId": 1,
  "quantity": 2,
  "type": "takeout",
  "customerName": "山田様",
  "source": "manual",
  "createdAt": "2026-02-13T10:30:00Z",
  "drink": {
    "id": 1,
    "name": "お茶（緑茶）",
    "stock": 6
  }
}
```

**エラー（400）:** 在庫不足の場合（取り出し時のみ）
```json
{ "error": "Insufficient stock", "currentStock": 1 }
```

#### GET /api/transactions

取り出し記録一覧を取得する。

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from | string (ISO8601) | No | 開始日時 |
| to | string (ISO8601) | No | 終了日時 |
| employeeId | number | No | 社員ID |
| drinkId | number | No | ドリンクID |
| type | string | No | "takeout" または "return" でフィルタ |
| page | number | No | ページ番号（デフォルト: 1） |
| limit | number | No | 1ページあたりの件数（デフォルト: 50） |

**レスポンス（200）:**
```json
{
  "transactions": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 128,
    "totalPages": 3
  }
}
```

#### GET /api/transactions/export

取り出し記録をCSV形式でダウンロードする。

**クエリパラメータ:** `GET /api/transactions`と同一のフィルタパラメータ

**レスポンス:** `text/csv` 形式のファイルダウンロード

### 3.5 入庫API

#### POST /api/stock-entries（管理者のみ）

ドリンクの入庫を記録する。在庫数を自動で加算する。

**リクエスト:**
```json
{
  "drinkId": 1,
  "quantity": 24
}
```

**レスポンス（201）:**
```json
{
  "id": 1,
  "employeeId": 1,
  "drinkId": 1,
  "quantity": 24,
  "createdAt": "2026-02-13T09:00:00Z",
  "drink": {
    "id": 1,
    "name": "お茶（緑茶）",
    "stock": 34
  }
}
```

#### GET /api/stock-entries（管理者のみ）

入庫履歴一覧を取得する。

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from | string (ISO8601) | No | 開始日時 |
| to | string (ISO8601) | No | 終了日時 |
| drinkId | number | No | ドリンクID |
| page | number | No | ページ番号（デフォルト: 1） |
| limit | number | No | 1ページあたりの件数（デフォルト: 50） |

### 3.6 棚卸しAPI

#### POST /api/inventory-checks

棚卸しを実施する。全ドリンク種類の実在庫を一括で登録し、在庫数を実在庫に自動更新する。差分がある場合はGoogle Chatに通知を送信する。

**リクエスト:**
```json
{
  "checks": [
    { "drinkId": 1, "actualStock": 8 },
    { "drinkId": 2, "actualStock": 5 },
    { "drinkId": 3, "actualStock": 10 }
  ]
}
```

**レスポンス（201）:**
```json
{
  "checks": [
    {
      "id": 1,
      "drinkId": 1,
      "drinkName": "お茶（緑茶）",
      "systemStock": 10,
      "actualStock": 8,
      "diff": -2
    },
    {
      "id": 2,
      "drinkId": 2,
      "drinkName": "お茶（ほうじ茶）",
      "systemStock": 5,
      "actualStock": 5,
      "diff": 0
    }
  ],
  "hasDiff": true,
  "notificationSent": true,
  "stockUpdated": true
}
```

**動作仕様:**
- 棚卸し記録の作成と在庫更新をトランザクションで一括実行
- `stockUpdated: true` は在庫数が実在庫に更新されたことを示す

#### GET /api/inventory-checks

棚卸し履歴を取得する（明細一覧）。

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from | string (ISO8601) | No | 開始日時 |
| to | string (ISO8601) | No | 終了日時 |
| page | number | No | ページ番号（デフォルト: 1） |
| limit | number | No | 1ページあたりの件数（デフォルト: 50） |

#### GET /api/inventory-checks/sessions

棚卸しセッション一覧を取得する（同じ日時の棚卸しをグループ化して表示）。

**クエリパラメータ:**
| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| from | string (ISO8601) | No | 開始日時 |
| to | string (ISO8601) | No | 終了日時 |
| page | number | No | ページ番号（デフォルト: 1） |
| limit | number | No | 1ページあたりの件数（デフォルト: 50） |

**レスポンス（200）:**
```json
{
  "data": [
    {
      "createdAt": "2026-02-13T09:00:00Z",
      "employee": { "name": "管理者", "employeeCode": "0001" },
      "hasDiff": true,
      "totalDiff": 3,
      "drinkCount": 6,
      "checks": [
        { "id": 1, "drinkName": "お茶（緑茶）", "systemStock": 10, "actualStock": 8, "diff": -2 }
      ]
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 5, "totalPages": 1 }
}
```

#### DELETE /api/inventory-checks/cleanup（管理者のみ）

1年以上前の棚卸し記録を削除する。

**レスポンス（200）:**
```json
{
  "deleted": 120,
  "message": "120件の棚卸し記録を削除しました（1年以上前のデータ）",
  "cutoffDate": "2025-02-13T00:00:00Z"
}
```

#### GET /api/inventory-checks/export

棚卸し履歴をCSV形式でダウンロードする。

### 3.7 社員API

#### GET /api/employees（管理者のみ）

社員一覧を取得する。

#### POST /api/employees（管理者のみ）

社員を新規登録する。

**リクエスト:**
```json
{
  "employeeCode": "0042",
  "name": "佐藤太郎",
  "role": "user"
}
```

#### POST /api/employees/import（管理者のみ）

CSVファイルで社員を一括登録する。既存の社員番号がある場合は氏名・権限を上書き更新する。

**リクエスト:** `multipart/form-data`
| フィールド | 型 | 説明 |
|-----------|-----|------|
| file | File | CSVファイル（UTF-8/BOM付きUTF-8対応） |

**CSVフォーマット:**
```csv
社員番号,氏名,権限
0001,山田太郎,一般
0002,鈴木花子,管理者
```

**レスポンス（200）:**
```json
{
  "message": "インポートが完了しました",
  "created": 3,
  "updated": 1,
  "skipped": 0,
  "errors": []
}
```

**仕様:**
- ヘッダー行は「社員番号/employeecode/code」「氏名/名前/name」「権限/ロール/role」に柔軟対応
- 権限は「管理者/admin」→admin、それ以外→user
- 既存の社員番号は更新＋再有効化（upsert）
- バリデーションエラーはスキップしてエラー詳細を返す

#### PUT /api/employees/[id]（管理者のみ）

社員情報を更新する。

#### DELETE /api/employees/[id]（管理者のみ）

社員を論理削除する（`isActive = false`）。

### 3.8 ダッシュボードAPI

#### GET /api/dashboard

ダッシュボード表示に必要な集計データを一括取得する。

**レスポンス（200）:**
```json
{
  "stockSummary": [
    { "drinkId": 1, "name": "お茶（緑茶）", "stock": 8, "imageUrl": "..." }
  ],
  "todayConsumption": [
    { "drinkId": 1, "name": "お茶（緑茶）", "totalQuantity": 4 }
  ],
  "todayTotal": 12,
  "recentAlerts": [
    {
      "id": 1,
      "createdAt": "2026-02-13T09:00:00Z",
      "diffs": [
        { "drinkName": "お茶（緑茶）", "diff": -2 }
      ]
    }
  ],
  "weeklyTrend": [
    { "date": "2026-02-07", "totalQuantity": 15 },
    { "date": "2026-02-08", "totalQuantity": 12 }
  ]
}
```

### 3.9 設定API

#### GET /api/settings（管理者のみ）

全設定を取得する。

**レスポンス（200）:**
```json
{
  "settings": {
    "notification_webhook_url": "https://chat.googleapis.com/v1/spaces/...",
    "inventory_check_reminder": "09:00,18:00",
    "lockout_duration_minutes": "5",
    "lockout_max_attempts": "3",
    "session_timeout_minutes": "30"
  }
}
```

#### PUT /api/settings（管理者のみ）

設定を更新する。

**リクエスト:**
```json
{
  "notification_webhook_url": "https://chat.googleapis.com/v1/spaces/...",
  "inventory_check_reminder": "09:00,18:00"
}
```

### 3.10 画像アップロードAPI

#### POST /api/upload（管理者のみ）

ドリンク画像をアップロードする。

**リクエスト:** `multipart/form-data`
| フィールド | 型 | 説明 |
|-----------|-----|------|
| file | File | 画像ファイル（JPEG/PNG、最大2MB） |

**レスポンス（200）:**
```json
{
  "url": "/uploads/drinks/1739450400000-green-tea.jpg"
}
```

### 3.11 API権限マトリクス

| API | user | admin |
|-----|------|-------|
| POST /api/auth/login | - | - |
| GET /api/auth/me | o | o |
| GET /api/drinks | o | o |
| POST /api/drinks | x | o |
| PUT /api/drinks/[id] | x | o |
| DELETE /api/drinks/[id] | x | o |
| POST /api/transactions | o | o |
| GET /api/transactions | o | o |
| GET /api/transactions/export | o | o |
| POST /api/stock-entries | x | o |
| GET /api/stock-entries | x | o |
| POST /api/inventory-checks | o | o |
| GET /api/inventory-checks | o | o |
| GET /api/inventory-checks/export | o | o |
| GET /api/employees | x | o |
| POST /api/employees | x | o |
| POST /api/employees/import | x | o |
| PUT /api/employees/[id] | x | o |
| DELETE /api/employees/[id] | x | o |
| GET /api/inventory-checks/sessions | o | o |
| DELETE /api/inventory-checks/cleanup | x | o |
| GET /api/dashboard | o | o |
| GET /api/settings | x | o |
| PUT /api/settings | x | o |
| POST /api/upload | x | o |

`o`: アクセス可能 / `x`: アクセス不可 / `-`: 認証不要

-----

## 4. 画面設計

### 4.1 S-01: ログイン画面

```
┌─────────────────────────────────────┐
│                                     │
│         🥤 ドリンク在庫管理          │
│                                     │
│     ┌───────────────────────┐       │
│     │    社員番号を入力       │       │
│     │    [ 0  0  0  1 ]     │       │
│     └───────────────────────┘       │
│                                     │
│     ┌─────┬─────┬─────┐            │
│     │  1  │  2  │  3  │            │
│     ├─────┼─────┼─────┤            │
│     │  4  │  5  │  6  │            │
│     ├─────┼─────┼─────┤            │
│     │  7  │  8  │  9  │            │
│     ├─────┼─────┼─────┤            │
│     │  ←  │  0  │ ログイン │         │
│     └─────┴─────┴─────┘            │
│                                     │
└─────────────────────────────────────┘
```

**コンポーネント構成:**
- `Numpad` - テンキー入力コンポーネント
- 4桁の社員番号表示エリア
- ログインボタン（テンキー内に配置）

**動作仕様:**
- テンキーで社員番号を入力
- 「←」で1文字削除
- 「ログイン」ボタンで認証API呼び出し
- 成功時: JWTをlocalStorageに保存し、取り出し画面（S-02）へ遷移
- 失敗時: エラーメッセージを画面上部にトースト表示
- ロックアウト時: 残り時間をカウントダウン表示

### 4.2 S-02: ドリンク取り出し・返却画面（メイン画面）

```
┌─────────────────────────────────────┐
│ ようこそ 管理者さん    [管理] [ログアウト] │
├─────────────────────────────────────┤
│  [  取り出し  ] [  返却  ]  モード切替 │
│  ※返却モード時はオレンジ色テーマに変更  │
│                                     │
│ ドリンクを選択してください             │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │  緑茶  │ │ ほうじ │ │ ブラック │  │
│  │ 在庫:8 │ │ 在庫:5 │ │ 在庫:10│  │
│  └────────┘ └────────┘ └────────┘  │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │  微糖  │ │   水   │ │ オレンジ│  │
│  │ 在庫:10│ │ 在庫:12│ │ 在庫:5 │  │
│  └────────┘ └────────┘ └────────┘  │
├─────────────────────────────────────┤
│  選択中: [返却] お茶（緑茶） × 2     │
│                                     │
│  [1][2][3][4][5][6][7][8][9]        │
│                                     │
│  お客様名: [          ] (任意)       │
│  ※返却モード時はお客様名非表示        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │       確定する / 返却する      │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

**コンポーネント構成:**
- ヘッダー: ユーザー名、管理画面リンク（admin時）、ログアウトボタン
- モード切替ボタン: 「取り出し」（青）/「返却」（オレンジ）の2ボタン
- 返却モードバナー: 「返却モード: ドリンクを冷蔵庫に戻します」
- ドリンク選択エリア: 3列コンパクトグリッド（名称＋在庫数のみ、画像なし）
- テンキー: 1〜9を横1行に配置。取り出し時は在庫数を超えるボタンを無効化、返却時は制限なし
- お客様名テキスト入力（取り出し時のみ表示）
- 確定ボタン（取り出し時「確定する」/返却時「返却する」）

**動作仕様:**
- ページ表示時にGET /api/drinksでドリンク一覧を取得
- ドリンクタップで選択（選択中はハイライト表示、再タップで選択解除）
- 取り出しモード: 在庫0のドリンクはグレーアウトし選択不可。テンキーは在庫数を超えるボタンを無効化
- 返却モード: 在庫0でも選択可。テンキーの在庫制限なし。画面全体がオレンジ色テーマに変化
- モード切替時は選択状態をリセット
- 確定ボタン押下でPOST /api/transactions（typeパラメータ付き）を呼び出し
- 成功時: 記録完了画面（S-03）へ遷移（返却時はオレンジテーマ）
- 確定ボタンは二重送信防止のため、API呼び出し中はdisabled
- 3分間操作がない場合は自動ログアウト

### 4.3 S-03: 記録完了画面

```
┌─────────────────────────────────────┐
│                                     │
│                                     │
│            ✅ 記録完了               │
│                                     │
│    お茶（緑茶） × 2                  │
│    お客様: 山田様                    │
│                                     │
│    3秒後にメイン画面に戻ります...     │
│    [● ● ○]                         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      すぐに戻る              │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**動作仕様:**
- 記録内容（ドリンク名、数量、お客様名、種別）を表示
- 取り出し時: 緑色チェックマーク、「記録完了」タイトル
- 返却時: オレンジ色テーマ、↩アイコン、「返却完了」タイトル、種別「返却」を表示
- 3秒カウントダウン後に自動でS-02へ遷移
- 「すぐに戻る」ボタンで即座にS-02へ遷移

### 4.4 S-04: 入庫登録画面（管理者のみ）

```
┌─────────────────────────────────────┐
│ ← 管理メニュー        入庫登録       │
├─────────────────────────────────────┤
│                                     │
│  ドリンク選択:                       │
│  ┌─────────────────────────────┐   │
│  │ お茶（緑茶）            ▼   │   │
│  └─────────────────────────────┘   │
│                                     │
│  入庫数量:  [ - ]  24  [ + ]        │
│                                     │
│  現在在庫: 8 → 入庫後: 32           │
│                                     │
│  ┌─────────────────────────────┐   │
│  │          入庫登録             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─── 最近の入庫履歴 ───              │
│  2/13 09:00  お茶（緑茶）  +24  管理者│
│  2/12 09:00  コーヒー     +12  管理者│
│                                     │
└─────────────────────────────────────┘
```

### 4.5 S-05: 棚卸し画面

```
┌─────────────────────────────────────┐
│ ← 管理メニュー         棚卸し        │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────┬──────┬──────┬─────┐ │
│  │ ドリンク    │ 理論 │ 実数 │ 差分 │ │
│  ├───────────┼──────┼──────┼─────┤ │
│  │ 緑茶      │  10  │ [ 8] │  -2 │ │
│  │ ほうじ茶   │   5  │ [ 5] │   0 │ │
│  │ ブラック   │  10  │ [10] │   0 │ │
│  │ 微糖      │  10  │ [ 9] │  -1 │ │
│  │ 水        │  12  │ [12] │   0 │ │
│  │ オレンジ   │   5  │ [ 5] │   0 │ │
│  └───────────┴──────┴──────┴─────┘ │
│                                     │
│  差分あり: 2件（⚠ 緑茶 -2, 微糖 -1） │
│                                     │
│  ┌─────────────────────────────┐   │
│  │         棚卸し確定            │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

**動作仕様:**
- ページ表示時にGET /api/drinksで理論在庫を取得
- 各行の実数入力は直接数値入力
- 差分は自動計算してリアルタイム表示（マイナス差分は赤色で強調）
- 「棚卸し確定」でPOST /api/inventory-checksを呼び出し
- 確定時に在庫数を実在庫に自動更新（トランザクション実行）
- 確定後に結果サマリーテーブルを表示（各ドリンクの理論在庫・実在庫・差分）
- 「新しい棚卸しを開始」で入力フォームにリセット、「棚卸し履歴を確認」で履歴画面に遷移
- 差分がある場合、Google Chat Webhookで管理者に自動通知

### 4.6 S-06: ダッシュボード画面

```
┌─────────────────────────────────────┐
│ ← 管理メニュー     ダッシュボード     │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────┐ ┌─────────────┐   │
│  │ 本日の消費    │ │ 在庫合計     │   │
│  │    12本      │ │    60本     │   │
│  └─────────────┘ └─────────────┘   │
│                                     │
│  ─── 在庫状況（ドリンク別） ───       │
│  ┌─────────────────────────────┐   │
│  │  [■■■■■■■■░░] 緑茶    8/10  │   │
│  │  [■■■■■░░░░░] ほうじ茶 5/10  │   │
│  │  [■■■■■■■■■■] ブラック 10/10 │   │
│  │  ...                         │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─── 週間消費トレンド ───            │
│  ┌─────────────────────────────┐   │
│  │  📊 棒グラフ（日別消費数）    │   │
│  └─────────────────────────────┘   │
│                                     │
│  ─── 最近の差分アラート ───          │
│  ⚠ 2/13 09:00 緑茶 -2, 微糖 -1    │
│                                     │
└─────────────────────────────────────┘
```

**コンポーネント構成:**
- サマリカード（本日消費数、在庫合計）
- 在庫バーチャート（ドリンク種類別）
- 週間消費トレンドチャート（日別棒グラフ）
- 差分アラート一覧

**動作仕様:**
- ページ表示時にGET /api/dashboardで集計データを一括取得
- グラフ描画にはRechartsライブラリを使用

### 4.7 S-07: 履歴検索画面

```
┌─────────────────────────────────────┐
│ ← 管理メニュー       履歴検索        │
├─────────────────────────────────────┤
│                                     │
│  [取り出し履歴] [棚卸し履歴]  タブ切替 │
│                                     │
│  [セッション別] [明細一覧]  表示切替   │
│  ※棚卸しタブのみ表示                  │
│  棚卸しデータは1年間保持されます       │
│                                     │
│  期間: [2026/02/01] 〜 [2026/02/13] │
│  ドリンク: [全種類   ▼]             │
│  [検索] [CSV出力]                   │
│                                     │
│ ◆セッション別表示の場合:             │
│  ┌──────────────────────────────┐  │
│  │ 2/13 09:00 管理者(0001)       │  │
│  │ [差分あり（3本）] 6種類    ▼  │  │
│  │ ┌────────┬────┬────┬────┐  │  │
│  │ │ドリンク │理論│実数│差分│  │  │
│  │ │緑茶    │ 10│  8│ -2│  │  │
│  │ │ほうじ茶│  5│  5│  0│  │  │
│  │ └────────┴────┴────┴────┘  │  │
│  └──────────────────────────────┘  │
│                                     │
│  << 1 2 3 >>        全5件          │
│                                     │
└─────────────────────────────────────┘
```

### 4.8 S-08: マスタ管理画面

**ドリンクマスタ / 社員マスタ** の2つのサブ画面。それぞれテーブル形式で一覧表示し、追加・編集・削除（論理削除）が可能。

**社員マスタのCSV一括登録機能:**
- CSVファイルによる一括登録パネル（「CSV一括登録」ボタンで表示）
- ファイル選択、インポート実行、テンプレートダウンロード
- CSVフォーマット: 社員番号（必須）、氏名（必須）、権限（任意、省略時は一般）
- 既存の社員番号は氏名・権限を上書き更新（upsert）
- インポート結果: 新規作成件数、更新件数、スキップ件数、エラー詳細を表示

### 4.9 S-09: 設定画面

| 設定項目 | 入力形式 | 説明 |
|---------|---------|------|
| Google Chat Webhook URL | テキスト入力 | 差分アラート通知先 |
| 棚卸しリマインダー時刻 | 時刻入力（複数） | 棚卸し実施の推奨時刻 |
| ロックアウト回数 | 数値入力 | ログイン失敗許容回数 |
| ロックアウト時間（分） | 数値入力 | ロックアウト継続時間 |
| セッションタイムアウト（分） | 数値入力 | 自動ログアウトまでの時間 |

### 4.10 管理画面サイドバー

管理者ログイン時に表示されるサイドナビゲーション。

```
┌───────────────┐
│ 📊 ダッシュボード│
│ 📦 入庫登録     │
│ 📋 棚卸し       │
│ 🔍 履歴検索     │
│ 🥤 ドリンク管理  │
│ 👥 社員管理      │
│ ⚙️ 設定         │
├───────────────┤
│ ← 取り出し画面   │
│    ログアウト     │
└───────────────┘
```

タブレットでは横幅を確保するため、アイコン＋テキストの折りたたみ可能なサイドバーとする。

-----

## 5. 認証・認可設計

### 5.1 認証フロー

```
1. ユーザーが社員番号を入力
2. POST /api/auth/login に送信
3. サーバーがemployeesテーブルで社員番号を検索
4. 存在すれば JWT を生成して返却
5. クライアントが localStorage に JWT を保存
6. 以降のAPIリクエストに Authorization ヘッダーで JWT を付与
```

### 5.2 JWTペイロード

```json
{
  "sub": 1,
  "employeeCode": "0001",
  "name": "管理者",
  "role": "admin",
  "iat": 1739450400,
  "exp": 1739452200
}
```

- 有効期限: 30分（settingsで変更可能）
- 署名アルゴリズム: HS256
- 秘密鍵: 環境変数 `JWT_SECRET` で管理
- 自動ログアウト: 3分間操作がない場合、フロントエンドで自動ログアウト（mousedown, touchstart, keydown, scrollイベントを監視）

### 5.3 認可ミドルウェア

APIルートで使用する認可チェック関数を `src/lib/auth.ts` に実装する。

```typescript
// 認証チェック（ログイン済みであること）
export async function requireAuth(request: Request): Promise<Employee>

// 管理者チェック（admin ロールであること）
export async function requireAdmin(request: Request): Promise<Employee>
```

### 5.4 ロックアウト機構

- ロックアウト情報はインメモリ（Map）で管理する（SQLiteへの書き込み負荷を避けるため）
- サーバー再起動でリセットされるが、セキュリティ上の大きなリスクにはならない（社内利用のため）
- IPアドレス単位で管理（タブレット固定設置のため、IPベースで十分）

```typescript
// ロックアウト管理の構造
const lockoutMap = new Map<string, {
  attempts: number;
  lockedUntil: Date | null;
}>();
```

-----

## 6. 通知設計

### 6.1 Google Chat Webhook

差分アラート通知にGoogle Chat Webhookを使用する。

**通知トリガー:**
- 棚卸し実施時に理論在庫と実在庫の差分が1つ以上ある場合

**通知メッセージ形式:**
```json
{
  "text": "⚠️ *棚卸し差分アラート*\n実施者: 管理者（0001）\n実施日時: 2026/02/13 09:00\n\n差分あり:\n• お茶（緑茶）: 理論 10 → 実数 8（*-2*）\n• コーヒー（微糖）: 理論 10 → 実数 9（*-1*）\n\n差分合計: *-3本*"
}
```

**実装:**
```typescript
// src/lib/notifications.ts
export async function sendInventoryAlert(
  checks: InventoryCheckResult[],
  performer: Employee
): Promise<void> {
  const webhookUrl = await getSettingValue("notification_webhook_url");
  if (!webhookUrl) return; // URL未設定時はスキップ

  const diffsOnly = checks.filter(c => c.diff !== 0);
  if (diffsOnly.length === 0) return;

  const message = formatAlertMessage(diffsOnly, performer);

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: message }),
  });
}
```

-----

## 7. エラーハンドリング方針

### 7.1 APIエラーレスポンス

| HTTPステータス | 用途 | 例 |
|--------------|------|-----|
| 400 | バリデーションエラー、業務エラー | 在庫不足、必須項目未入力 |
| 401 | 認証エラー | JWT無効・期限切れ、社員番号不正 |
| 403 | 認可エラー | 一般ユーザーが管理者APIにアクセス |
| 404 | リソース未検出 | 指定IDのドリンクが存在しない |
| 429 | レート制限 | ロックアウト中のログイン試行 |
| 500 | サーバーエラー | DB接続エラー等の予期しないエラー |

### 7.2 フロントエンドでのエラー表示

- バリデーションエラー: フォーム入力欄の直下に赤文字で表示
- 業務エラー（在庫不足等）: 画面上部にトースト通知（5秒間表示）
- 認証エラー: ログイン画面にリダイレクト
- サーバーエラー: 「システムエラーが発生しました」のトースト通知
