"use client"

import { useState, useCallback } from "react"
import { formatRussianPhone, normalizeRussianPhone } from "@/lib/utils/phone"

interface PhoneInputProps {
  name?: string
  required?: boolean
  className?: string
  placeholder?: string
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
}

export default function PhoneInput({
  name = "phone",
  required = false,
  className,
  placeholder = "+7 (___) ___-__-__",
  value: controlledValue,
  defaultValue,
  onChange,
}: PhoneInputProps) {
  const isControlled = controlledValue !== undefined
  const [focused, setFocused] = useState(false)
  const [uncontrolledDisplay, setUncontrolledDisplay] = useState(
    defaultValue ? formatRussianPhone(defaultValue) : ""
  )
  const display = isControlled
    ? controlledValue
      ? formatRussianPhone(controlledValue)
      : focused
        ? "+7 ("
        : ""
    : uncontrolledDisplay

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRussianPhone(e.target.value)
    if (!isControlled) setUncontrolledDisplay(formatted)
    onChange?.(normalizeRussianPhone(formatted))
  }, [isControlled, onChange])

  const handleFocus = useCallback(() => {
    setFocused(true)
    if (!isControlled && !uncontrolledDisplay) setUncontrolledDisplay("+7 (")
  }, [isControlled, uncontrolledDisplay])

  const handleBlur = useCallback(() => {
    setFocused(false)
    if (!isControlled && (uncontrolledDisplay === "+7 (" || uncontrolledDisplay === "+7")) {
      setUncontrolledDisplay("")
    }
  }, [isControlled, uncontrolledDisplay])

  return (
    <>
      <input
        type="tel"
        value={display}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        required={required}
        autoComplete="tel"
        maxLength={18}
      />
      <input type="hidden" name={name} value={display ? normalizeRussianPhone(display) : ""} />
    </>
  )
}
