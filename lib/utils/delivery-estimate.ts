const deliveryDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Moscow",
})

export function formatDeliveryDateRange(from?: string, to?: string): string | null {
  if (!from || !to) return null

  const fromDate = new Date(from)
  const toDate = new Date(to)
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) return null

  const formattedFrom = deliveryDateFormatter.format(fromDate).replace(".", "")
  const formattedTo = deliveryDateFormatter.format(toDate).replace(".", "")
  return formattedFrom === formattedTo ? formattedFrom : `${formattedFrom} – ${formattedTo}`
}

export function formatDeliveryDays(minDays?: number, maxDays?: number): string | null {
  if (!Number.isFinite(minDays) || !Number.isFinite(maxDays)) return null
  if ((minDays || 0) <= 0 || (maxDays || 0) <= 0) return null
  return minDays === maxDays ? `${minDays} дн.` : `${minDays}–${maxDays} дн.`
}
