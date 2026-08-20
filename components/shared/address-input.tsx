"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface Suggestion {
  value: string
  label?: string
  unrestricted: string
}

interface AddressInputProps {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  className?: string
  city?: string
  name?: string
  required?: boolean
  autoComplete?: string
}

export default function AddressInput({
  value = "",
  onChange,
  placeholder,
  className,
  city,
  name,
  required,
  autoComplete = "street-address",
}: AddressInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestRef = useRef(0)
  const wrapperRef = useRef<HTMLDivElement>(null)

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
        body: JSON.stringify({ query: normalized, city }),
      })
      if (!res.ok) throw new Error("Address suggestions request failed")
      const data = await res.json() as { suggestions?: Suggestion[] }
      if (requestId !== requestRef.current) return
      const nextSuggestions = Array.isArray(data.suggestions) ? data.suggestions : []
      setSuggestions(nextSuggestions)
      setShowDropdown(nextSuggestions.length > 0)
    } catch {
      if (requestId === requestRef.current) {
        setSuggestions([])
        setShowDropdown(true)
        setError(true)
      }
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }, [city])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    onChange?.(val)

    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => fetchSuggestions(val), 300)
  }, [onChange, fetchSuggestions])

  const handleSelect = useCallback((suggestion: Suggestion) => {
    onChange?.(suggestion.value)
    setSuggestions([])
    setShowDropdown(false)
    setError(false)
  }, [onChange])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
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
        onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
        placeholder={placeholder}
        className={cn("pr-16", className)}
        aria-autocomplete="list"
        aria-expanded={showDropdown && suggestions.length > 0}
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
          Подсказки временно недоступны — адрес можно ввести вручную.
        </p>
      )}
    </div>
  )
}
