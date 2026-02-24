"use client";

interface Drink {
  id: number;
  name: string;
  imageUrl?: string | null;
  stock: number;
}

interface DrinkTileProps {
  drink: Drink;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

const placeholderColors = [
  "bg-blue-100 text-blue-700",
  "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
  "bg-teal-100 text-teal-700",
  "bg-red-100 text-red-700",
  "bg-yellow-100 text-yellow-700",
];

export function DrinkTile({ drink, selected, onClick, disabled }: DrinkTileProps) {
  const isOutOfStock = drink.stock <= 0;
  const isDisabled = disabled || isOutOfStock;
  const colorClass = placeholderColors[drink.id % placeholderColors.length];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className={`relative flex flex-col items-center rounded-xl border-2 p-3 transition-all min-w-[120px] min-h-[140px] cursor-pointer select-none ${
        selected
          ? "border-[var(--color-primary)] bg-blue-50 shadow-md"
          : "border-[var(--color-border)] bg-[var(--color-card)]"
      } ${
        isDisabled
          ? "opacity-60 cursor-not-allowed"
          : "hover:shadow-md active:scale-[0.98]"
      }`}
    >
      {/* Image or placeholder */}
      <div
        className={`w-full aspect-square min-h-[5rem] rounded-lg flex items-center justify-center overflow-hidden mb-2 ${
          drink.imageUrl ? "" : colorClass
        }`}
      >
        {drink.imageUrl ? (
          <img
            src={drink.imageUrl}
            alt={drink.name}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <span className="text-3xl font-bold">{drink.name.charAt(0)}</span>
        )}
      </div>

      {/* Name */}
      <span className="text-sm font-semibold text-center leading-tight line-clamp-2">
        {drink.name}
      </span>

      {/* Stock badge */}
      <span
        className={`mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${
          isOutOfStock
            ? "bg-red-100 text-red-700"
            : drink.stock <= 3
              ? "bg-yellow-100 text-yellow-700"
              : "bg-green-100 text-green-700"
        }`}
      >
        {isOutOfStock ? "在庫なし" : `在庫: ${drink.stock}`}
      </span>

      {/* Out of stock overlay */}
      {isOutOfStock && (
        <div className="absolute inset-0 rounded-xl bg-gray-200/50 flex items-center justify-center">
          <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            在庫なし
          </span>
        </div>
      )}
    </button>
  );
}
