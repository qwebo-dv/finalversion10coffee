"use client"

import type { TextFieldClientProps } from "payload"
import { FieldLabel, useField } from "@payloadcms/ui"

const PRESET_COLORS = [
  { name: "Оранжевый", value: "#e6610d" },
  { name: "Фиолетовый", value: "#7c3aed" },
  { name: "Зелёный", value: "#16a34a" },
  { name: "Красный", value: "#dc2626" },
  { name: "Синий", value: "#2563eb" },
  { name: "Жёлтый", value: "#ca8a04" },
  { name: "Розовый", value: "#db2777" },
  { name: "Серый", value: "#6b7280" },
]

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!match) return null
  return { r: parseInt(match[1], 16), g: parseInt(match[2], 16), b: parseInt(match[3], 16) }
}

function getContrastColor(hex: string): string {
  const rgb = hexToRgb(hex)
  if (!rgb) return "#ffffff"
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export default function ColorPickerField({ field, path }: TextFieldClientProps) {
  const { value, setValue } = useField<string>({ path })

  return (
    <div className="space-y-3">
      <FieldLabel
        htmlFor={`field-${path}`}
        label={field.label}
        localized={field.localized}
        path={path}
        required={field.required}
      />
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            onClick={() => setValue(preset.value)}
            className="relative w-9 h-9 rounded-lg border-2 transition-all duration-150 hover:scale-110 flex items-center justify-center text-xs font-bold"
            style={{
              backgroundColor: preset.value,
              color: getContrastColor(preset.value),
              borderColor: value === preset.value ? "#1d1d1f" : "transparent",
              boxShadow: value === preset.value ? "0 0 0 2px rgba(0,0,0,0.15)" : "none",
            }}
            title={preset.name}
          >
            {value === preset.value && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg border border-neutral-200 shrink-0"
          style={{ backgroundColor: value || "#e6610d" }}
        />
        <input
          type="color"
          value={value || "#e6610d"}
          onChange={(e) => setValue(e.target.value)}
          className="w-9 h-9 rounded-lg cursor-pointer border-0 p-0"
          title="Выбрать свой цвет"
        />
        <input
          id={`field-${path}`}
          type="text"
          value={value || ""}
          onChange={(e) => {
            const v = e.target.value.trim()
            if (/^#[0-9a-fA-F]{6}$/.test(v) || v === "") setValue(v)
          }}
          placeholder="#e6610d"
          className="flex-1 border border-neutral-200 rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#5b328a]/30"
        />
      </div>
    </div>
  )
}
