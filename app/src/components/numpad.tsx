"use client";

interface NumpadProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  onSubmit: () => void;
  submitLabel?: string;
}

export function Numpad({
  value,
  onChange,
  maxLength = 4,
  onSubmit,
  submitLabel = "ログイン",
}: NumpadProps) {
  const handleDigit = (digit: string) => {
    if (value.length < maxLength) {
      onChange(value + digit);
    }
  };

  const handleBackspace = () => {
    onChange(value.slice(0, -1));
  };

  const dots = Array.from({ length: maxLength }, (_, i) => (
    <div
      key={i}
      className={`w-4 h-4 rounded-full mx-1.5 transition-colors ${
        i < value.length
          ? "bg-[var(--color-primary)]"
          : "bg-[var(--color-border)]"
      }`}
    />
  ));

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Display area */}
      <div className="flex items-center justify-center h-16 min-w-[200px] rounded-xl bg-white border-2 border-[var(--color-border)] px-6">
        {value.length > 0 ? (
          <span className="text-3xl font-bold tracking-[0.5em] text-[var(--color-text)]">
            {value}
          </span>
        ) : (
          <div className="flex items-center">{dots}</div>
        )}
      </div>

      {/* Numpad grid */}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => handleDigit(digit)}
            className="w-[72px] h-[72px] rounded-xl bg-white border-2 border-[var(--color-border)] text-2xl font-bold text-[var(--color-text)] hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer select-none"
          >
            {digit}
          </button>
        ))}

        {/* Backspace */}
        <button
          type="button"
          onClick={handleBackspace}
          className="w-[72px] h-[72px] rounded-xl bg-gray-100 border-2 border-[var(--color-border)] text-2xl font-bold text-[var(--color-text-secondary)] hover:bg-gray-200 active:bg-gray-300 transition-colors cursor-pointer select-none"
        >
          &larr;
        </button>

        {/* 0 */}
        <button
          type="button"
          onClick={() => handleDigit("0")}
          className="w-[72px] h-[72px] rounded-xl bg-white border-2 border-[var(--color-border)] text-2xl font-bold text-[var(--color-text)] hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer select-none"
        >
          0
        </button>

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={value.length === 0}
          className="w-[72px] h-[72px] rounded-xl bg-[var(--color-primary)] text-white text-sm font-bold hover:bg-[var(--color-primary-hover)] active:bg-blue-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer select-none"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
