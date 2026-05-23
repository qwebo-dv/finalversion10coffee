export function normalizeRussianPhone(value: string): string {
  const digits = value.replace(/\D/g, "")
  const localDigits = (digits.startsWith("7") || digits.startsWith("8") ? digits.slice(1) : digits).slice(0, 10)

  return localDigits ? `+7${localDigits}` : ""
}

export function formatRussianPhone(value: string): string {
  const normalized = normalizeRussianPhone(value)
  const localDigits = normalized.replace(/\D/g, "").slice(1)

  if (!localDigits) return ""

  let result = "+7"
  if (localDigits.length > 0) result += ` (${localDigits.slice(0, 3)}`
  if (localDigits.length >= 3) result += ") "
  if (localDigits.length > 3) result += localDigits.slice(3, 6)
  if (localDigits.length > 6) result += `-${localDigits.slice(6, 8)}`
  if (localDigits.length > 8) result += `-${localDigits.slice(8, 10)}`

  return result
}

export function isValidRussianPhone(value: string): boolean {
  return normalizeRussianPhone(value).replace(/\D/g, "").length === 11
}
