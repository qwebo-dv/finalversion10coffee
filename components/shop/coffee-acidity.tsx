interface CoffeeAcidityProps {
  value: number | null | undefined
  compact?: boolean
  tone?: "default" | "inverse"
  showLabel?: boolean
}

const ACIDITY_SCALE_MAX = 7

export function CoffeeAcidity({ value, compact = false, tone = "default", showLabel = true }: CoffeeAcidityProps) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null

  const acidity = Math.max(1, Math.min(ACIDITY_SCALE_MAX, Math.round(value)))

  return (
    <div
      className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}
      aria-label={`Интенсивность кислотности: ${acidity} из ${ACIDITY_SCALE_MAX}`}
    >
      {showLabel && <span className={`${compact ? "text-xs" : "text-sm"} font-semibold ${tone === "inverse" ? "text-white/65" : "text-[#766d66]"}`}>Кислотность</span>}
      <span className="flex items-center gap-1" aria-hidden="true">
        {Array.from({ length: ACIDITY_SCALE_MAX }, (_, index) => (
          <span
            key={index}
            className={`${compact ? "h-2 w-2" : "h-2.5 w-2.5"} rounded-full ${tone === "inverse" ? (index < acidity ? "bg-white" : "bg-white/20") : (index < acidity ? "bg-[#7540ad]" : "bg-[#7540ad]/15")}`}
          />
        ))}
      </span>
    </div>
  )
}
