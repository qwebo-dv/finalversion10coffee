const editableFields = new Set(["full_name", "phone", "address", "avatar_url", "delivery_method"])

export function parseProfileMetadata(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return undefined
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Некорректные данные профиля")
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (!editableFields.has(key)) throw new Error("Изменение служебных полей запрещено")
    if (typeof entry !== "string" || entry.length > 2000) throw new Error("Некорректные данные профиля")
    result[key] = entry
  }
  return result
}
