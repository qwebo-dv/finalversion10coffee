"use client"

import { useState } from "react"
import { Star } from "lucide-react"

const STAR_SIZE: Record<string, { className: string; px: number }> = {
  sm: { className: "h-3.5 w-3.5", px: 14 },
  md: { className: "h-[18px] w-[18px]", px: 18 },
  lg: { className: "h-5 w-5", px: 20 },
}

function countNoun(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return "оценка"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "оценки"
  return "оценок"
}

interface StarRatingProps {
  value?: number | null
  count?: number | null
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  interactive?: boolean
  onRate?: (value: number) => void
  className?: string
}

export function StarRating({ value, count, size = "md", showValue = true, interactive = false, onRate, className }: StarRatingProps) {
  const [hover, setHover] = useState(0)
  const display = interactive && hover > 0 ? hover : value ?? 0
  const { className: starClass, px } = STAR_SIZE[size]
  const percent = Math.max(0, Math.min(100, (display / 5) * 100))

  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <span className="relative inline-flex" onMouseLeave={() => setHover(0)}>
        <span className="flex gap-[2px]">
          {[0, 1, 2, 3, 4].map((index) => (
            <Star key={`base-${index}`} className={`${starClass} text-[#e7dfd6]`} fill="currentColor" strokeWidth={0} aria-hidden />
          ))}
        </span>
        <span className="absolute left-0 top-0 overflow-hidden" style={{ width: `${percent}%` }}>
          <span className="flex gap-[2px]">
            {[0, 1, 2, 3, 4].map((index) => (
              <Star key={`fill-${index}`} className={`${starClass} shrink-0 text-[#f2a515]`} fill="currentColor" strokeWidth={0} aria-hidden />
            ))}
          </span>
        </span>
        {interactive && (
          <span className="absolute inset-0 flex gap-[2px]">
            {[0, 1, 2, 3, 4].map((index) => (
              <button
                key={`btn-${index}`}
                type="button"
                aria-label={`Поставить ${index + 1} звезд(ы)`}
                onClick={() => onRate?.(index + 1)}
                onMouseEnter={() => setHover(index + 1)}
                className="block cursor-pointer bg-transparent"
                style={{ width: px, height: px }}
              />
            ))}
          </span>
        )}
      </span>
      {showValue && typeof value === "number" && value > 0 && (
        <span className="text-sm font-black text-[#1d1d1b]">{value.toFixed(1)}</span>
      )}
      {typeof count === "number" && count > 0 && (
        <span className="text-sm text-[#91867d]">· {count} {countNoun(count)}</span>
      )}
    </span>
  )
}
