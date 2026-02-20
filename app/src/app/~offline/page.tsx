"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg)] p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">📡</div>
        <h1 className="text-2xl font-bold text-[var(--color-text)] mb-4">
          オフラインです
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-8">
          インターネット接続が確認できません。
          <br />
          接続を確認して、もう一度お試しください。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-[var(--color-primary)] text-white rounded-lg font-medium hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          再読み込み
        </button>
      </div>
    </div>
  );
}
