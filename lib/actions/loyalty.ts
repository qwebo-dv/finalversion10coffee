"use server"

import { getPayload } from "payload"
import configPromise from "@payload-config"
import { createClient } from "@/lib/supabase/server"
import { getLoyaltySettings, getLoyaltySnapshot } from "@/lib/loyalty"

type Relation = string | number | { id?: string | number; orderId?: string | null } | null

export type MyLoyaltyData = {
  authenticated: boolean
  enabled: boolean
  balance: number
  reserved: number
  available: number
  expiresAt: string | null
  expiryDays: number
  maxRedemptionPercent: number
  tiers: { minSubtotal: number; percent: number }[]
  operations: {
    id: string
    type: string
    status: string
    amount: number
    expiresAt: string | null
    createdAt: string | null
    note: string | null
    orderNumber: string | null
  }[]
}

export type PublicLoyaltyData = {
  enabled: boolean
  expiryDays: number
  maxRedemptionPercent: number
  tiers: { minSubtotal: number; percent: number }[]
}

export async function getPublicLoyalty(): Promise<PublicLoyaltyData> {
  const payload = await getPayload({ config: configPromise })
  const settings = await getLoyaltySettings(payload)
  return {
    enabled: settings.enabled,
    expiryDays: settings.expiryDays,
    maxRedemptionPercent: settings.maxRedemptionPercent,
    tiers: settings.tiers,
  }
}

function orderNumber(value: Relation): string | null {
  if (!value || typeof value !== "object") return null
  return value.orderId || null
}

export async function getMyLoyalty(): Promise<MyLoyaltyData> {
  const auth = await createClient("individual")
  const { data: { user } } = await auth.auth.getUser()
  const payload = await getPayload({ config: configPromise })
  const settings = await getLoyaltySettings(payload)
  const empty: MyLoyaltyData = {
    authenticated: false,
    enabled: settings.enabled,
    balance: 0,
    reserved: 0,
    available: 0,
    expiresAt: null,
    expiryDays: settings.expiryDays,
    maxRedemptionPercent: settings.maxRedemptionPercent,
    tiers: settings.tiers,
    operations: [],
  }
  if (!user) return empty

  const clients = await payload.find({
    collection: "clients",
    where: { supabaseId: { equals: user.id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const client = clients.docs[0] as { id?: string | number } | undefined
  if (!client?.id) return { ...empty, authenticated: true }

  const operationsPromise = (async () => {
    const docs: unknown[] = []
    let page = 1
    while (true) {
      const result = await payload.find({
        collection: "loyalty-operations" as never,
        where: { client: { equals: client.id } },
        limit: 200,
        page,
        sort: "-createdAt",
        depth: 1,
        overrideAccess: true,
      })
      docs.push(...result.docs)
      if (!result.hasNextPage) break
      page = result.nextPage || page + 1
    }
    return docs
  })()

  const [snapshot, operationDocs] = await Promise.all([
    getLoyaltySnapshot(payload, client.id),
    operationsPromise,
  ])

  return {
    authenticated: true,
    ...snapshot,
    expiryDays: settings.expiryDays,
    tiers: settings.tiers,
    operations: (operationDocs as Array<{
      id: string | number
      type?: string | null
      status?: string | null
      amount?: number | null
      expiresAt?: string | null
      createdAt?: string | null
      note?: string | null
      order?: Relation
    }>).map((operation) => ({
      id: String(operation.id),
      type: operation.type || "",
      status: operation.status || "",
      amount: Number(operation.amount) || 0,
      expiresAt: operation.expiresAt || null,
      createdAt: operation.createdAt || null,
      note: operation.note || null,
      orderNumber: orderNumber(operation.order || null),
    })),
  }
}
