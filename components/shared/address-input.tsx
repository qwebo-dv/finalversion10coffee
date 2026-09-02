"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Suggestion {
  value: string
  label?: string
  unrestricted: string
  house?: string
  houseFiasId?: string
  fiasLevel?: string
}

interface AddressInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  city?: string
  region?: string
  name?: string
  required?: boolean
  autoComplete?: string
  requireHouse?: boolean
  onCompleteChange?: (complete: boolean) => void
}

function normalizeAddress(value: string): string {
  return value.toLocaleLowerCase("ru-RU").replace(/[^а-яёa-z0-9]/g, "")
}

function suggestionMatchesAddress(address: string, suggestion: Suggestion): boolean {
  if (!suggestion.house?.trim()) return false
  const normalizedAddress = normalizeAddress(address)
  if (normalizedAddress.length < 4) return false
  return [suggestion.value, suggestion.label || "", suggestion.unrestricted]
    .map(normalizeAddress)
    .filter(Boolean)
    .some((candidate) => (
      candidate === normalizedAddress
      || candidate.endsWith(normalizedAddress)
      || normalizedAddress.endsWith(candidate)
    ))
}

export default function AddressInput({
  value = "",
  onChange,
  placeholder,
  className,
  city,
  region,
  name,
  required,
  autoComplete = "street-address",
  requireHouse = false,
  onCompleteChange,
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [complete, setComplete] = useState(false)
  const confirmedValueRef = useRef("")
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputFocusedRef = useRef(false)

  const fetchSuggestions = useCallback(async (query: string) => {
    const normalized = query.trim()
    if (normalized.length < 2) {
      setSuggestions([])
      setShowDropdown(false)
      setError(false)
      return
    }
    const requestId = ++requestRef.current
    setLoading(true)
    setError(false)
    try {
      const res = await fetch("/api/dadata/address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalized, city, region }),
      })
      if (!res.ok) throw new Error("Address suggestions request failed")
      const data = await res.json() as { suggestions?: Suggestion[] }
      if (requestId !== requestRef.current) return
      const nextSuggestions = Array.isArray(data.suggestions) ? data.suggestions : []
      setSuggestions(nextSuggestions)
      setShowDropdown(inputFocusedRef.current && nextSuggestions.length > 0)
      if (requireHouse) {
        const addressComplete = nextSuggestions.some((suggestion) => suggestionMatchesAddress(normalized, suggestion))
        confirmedValueRef.current = addressComplete ? query : ""
        setComplete(addressComplete)
        onCompleteChange?.(addressComplete)
      }
    } catch {
      if (requestId === requestRef.current) {
        setSuggestions([])
        setShowDropdown(inputFocusedRef.current)
        setError(true)
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [city, onCompleteChange, region, requireHouse])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange?.(val)
    if (requireHouse) {
      setComplete(false)
      onCompleteChange?.(false)
    }

  }, [onChange, onCompleteChange, requireHouse])

  const handleSelect = useCallback((suggestion: Suggestion) => {
    const hasHouse = Boolean(suggestion.house?.trim())
    confirmedValueRef.current = hasHouse ? suggestion.value : ""
    onChange?.(suggestion.value)
    setComplete(hasHouse)
    onCompleteChange?.(hasHouse)
    setSuggestions([])
    setShowDropdown(false)
    setError(false)
  }, [onChange, onCompleteChange])

  useEffect(() => {
    if (!requireHouse || !complete || value === confirmedValueRef.current) return
    confirmedValueRef.current = ""
    setComplete(false)
    onCompleteChange?.(false)
  }, [complete, onCompleteChange, requireHouse, value])

  useEffect(() => {
    if (value === confirmedValueRef.current) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => fetchSuggestions(value), 300)
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchSuggestions, value])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        inputFocusedRef.current = false
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      requestRef.current += 1
    }
  }, [])

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        name={name}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={handleChange}
        onFocus={() => {
          inputFocusedRef.current = true
          if (suggestions.length > 0 || error) setShowDropdown(true)
        }}
        placeholder={placeholder}
        className={cn("pr-16", requireHouse && value.trim() && !complete && "border-red-300", className)}
        aria-autocomplete="list"
        aria-expanded={showDropdown && suggestions.length > 0}
        aria-invalid={requireHouse && Boolean(value.trim()) && !complete}
      />
      {loading && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-neutral-400">Ищем…</span>
      )}
      {showDropdown && suggestions.length > 0 && (
        <div role="listbox" className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(s)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-neutral-50 transition-colors border-b border-neutral-50 last:border-0"
            >
              {s.label || s.value}
            </button>
          ))}
        </div>
      )}
      {showDropdown && error && (
        <p className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 shadow-lg">
          {requireHouse
            ? "Не удалось проверить адрес. Повторите попытку позже."
            : "Подсказки временно недоступны — адрес можно ввести вручную."}
        </p>
      )}
      {requireHouse && value.trim() && !complete && !loading && !error && (
        <p className="mt-1.5 text-xs leading-5 text-red-700">
          Выберите адрес из подсказок с улицей и номером дома.
        </p>
      )}
    </div>
  )
}
