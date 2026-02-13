"use client";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max: number;
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max,
}: QuantitySelectorProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-12 h-12 rounded-xl bg-gray-100 border-2 border-[var(--color-border)] text-xl font-bold text-[var(--color-text)] hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none flex items-center justify-center"
      >
        -
      </button>

      <span className="w-14 text-center text-2xl font-bold text-[var(--color-text)] tabular-nums">
        {value}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-12 h-12 rounded-xl bg-gray-100 border-2 border-[var(--color-border)] text-xl font-bold text-[var(--color-text)] hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer select-none flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}
