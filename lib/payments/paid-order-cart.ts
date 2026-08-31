import type { Payload } from "payload"
import { getPool } from "@/lib/db"

interface PaidOrderCartLine {
  cartItemId?: string | null
  quantity?: number | null
}

interface PaidOrderCartSnapshot {
  id: string | number
  client?: { id?: string | number } | string | number | null
  cartOwnerId?: string | null
  cartClearedAt?: string | null
  items?: PaidOrderCartLine[] | null
}

function relationshipId(value: PaidOrderCartSnapshot["client"]) {
  if (value === null || value === undefined) return null
  if (typeof value === "object") return value.id === null || value.id === undefined ? null : String(value.id)
  return String(value)
}

async function resolveCartOwner(payload: Payload, order: PaidOrderCartSnapshot) {
  const storedOwner = order.cartOwnerId?.trim()
  if (storedOwner) return storedOwner

  const clientId = relationshipId(order.client)
  if (!clientId) return null
  try {
    const client = await payload.findByID({
      collection: "clients",
      id: clientId,
      depth: 0,
      overrideAccess: true,
    })
    return client.supabaseId?.trim() || null
  } catch {
    return null
  }
}

export async function clearPaidOrderCart(
  payload: Payload,
  order: PaidOrderCartSnapshot,
  options: { allowLegacyFullClear: boolean },
) {
  if (order.cartClearedAt) return { cleared: false, skipped: true as const }

  const ownerId = await resolveCartOwner(payload, order)
  if (!ownerId) return { cleared: false, skipped: true as const }

  const orderedQuantities = new Map<number, number>()
  for (const item of order.items || []) {
    const id = Number(item.cartItemId)
    if (!Number.isInteger(id) || id <= 0) continue
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 0))
    orderedQuantities.set(id, (orderedQuantities.get(id) || 0) + quantity)
  }
  const orderedLines = Array.from(orderedQuantities, ([id, quantity]) => ({ id, quantity }))

  if (orderedLines.length === 0 && !options.allowLegacyFullClear) {
    return { cleared: false, skipped: true as const }
  }

  const connection = await getPool().connect()
  try {
    await connection.query("begin")
    await connection.query("select pg_advisory_xact_lock(hashtext($1))", [`paid-order-cart:${order.id}`])
    const state = await connection.query<{ cart_cleared_at: Date | null }>(
      "select cart_cleared_at from public.orders where id = $1 for update",
      [order.id],
    )
    if (!state.rows[0] || state.rows[0].cart_cleared_at) {
      await connection.query("commit")
      return { cleared: false, skipped: true as const }
    }

    if (orderedLines.length > 0) {
      for (const line of orderedLines) {
        const reduced = await connection.query(
          `update public.cart_items
              set quantity = quantity - $3,
                  updated_at = now()
            where id = $2
              and client_id = $1
              and quantity > $3
          returning id`,
          [ownerId, line.id, line.quantity],
        )
        if (reduced.rowCount === 0) {
          await connection.query(
            `delete from public.cart_items
              where id = $2
                and client_id = $1
                and quantity <= $3`,
            [ownerId, line.id, line.quantity],
          )
        }
      }
    } else {
      // Orders created before cart snapshots existed can only be cleared as a
      // whole. This path is allowed solely on their first pending -> paid
      // transition, never when an old paid success URL is opened again.
      await connection.query("delete from public.cart_items where client_id = $1", [ownerId])
    }

    await connection.query(
      "update public.orders set cart_cleared_at = now(), updated_at = now() where id = $1",
      [order.id],
    )
    await connection.query("commit")
    return { cleared: true as const, skipped: false as const }
  } catch (error) {
    await connection.query("rollback").catch(() => undefined)
    return {
      cleared: false as const,
      skipped: false as const,
      error: error instanceof Error ? error.message : "Неизвестная ошибка очистки корзины",
    }
  } finally {
    connection.release()
  }
}
