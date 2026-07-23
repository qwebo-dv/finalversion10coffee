export type MoyskladAuthMode = "bearer" | "basic"

export interface MoyskladConfig {
  enabled: boolean
  baseUrl: string
  authMode: MoyskladAuthMode
  token?: string
  login?: string
  password?: string
  organizationId?: string
  storeId?: string
  deliveryServiceId?: string
  defaultOrderStateId?: string
  salesChannelId?: string
  salesChannelName: string
  projectId?: string
  contractId?: string
  syncOrdersOnCreate: boolean
  createInvoiceOnOrder: boolean
  createCounterparties: boolean
  createSalesChannel: boolean
  vatEnabled: boolean
  vatIncluded: boolean
  defaultVat: number
}

const DEFAULT_BASE_URL = "https://api.moysklad.ru/api/remap/1.2"

function readBoolean(value: string | undefined, defaultValue = false) {
  if (value === undefined || value === "") return defaultValue
  return ["1", "true", "yes", "on"].includes(value.toLowerCase())
}

function readNumber(value: string | undefined, defaultValue = 0) {
  if (!value) return defaultValue
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

export function getMoyskladConfig(): MoyskladConfig {
  const token = process.env.MOYSKLAD_TOKEN
  const login = process.env.MOYSKLAD_LOGIN
  const password = process.env.MOYSKLAD_PASSWORD
  const authMode: MoyskladAuthMode = token ? "bearer" : "basic"

  return {
    enabled: readBoolean(process.env.MOYSKLAD_ENABLED, false),
    baseUrl: process.env.MOYSKLAD_BASE_URL || DEFAULT_BASE_URL,
    authMode,
    token,
    login,
    password,
    organizationId: process.env.MOYSKLAD_ORGANIZATION_ID,
    storeId: process.env.MOYSKLAD_STORE_ID,
    deliveryServiceId: process.env.MOYSKLAD_DELIVERY_SERVICE_ID,
    defaultOrderStateId: process.env.MOYSKLAD_ORDER_STATE_NEW_ID,
    salesChannelId: process.env.MOYSKLAD_SALES_CHANNEL_ID,
    salesChannelName: process.env.MOYSKLAD_SALES_CHANNEL_NAME || "Сайт 10coffee",
    projectId: process.env.MOYSKLAD_PROJECT_ID,
    contractId: process.env.MOYSKLAD_CONTRACT_ID,
    syncOrdersOnCreate: readBoolean(process.env.MOYSKLAD_SYNC_ORDERS_ON_CREATE, true),
    createInvoiceOnOrder: readBoolean(process.env.MOYSKLAD_CREATE_INVOICE_ON_ORDER, true),
    createCounterparties: readBoolean(process.env.MOYSKLAD_CREATE_COUNTERPARTIES, true),
    createSalesChannel: readBoolean(process.env.MOYSKLAD_CREATE_SALES_CHANNEL, true),
    vatEnabled: readBoolean(process.env.MOYSKLAD_VAT_ENABLED, true),
    vatIncluded: readBoolean(process.env.MOYSKLAD_VAT_INCLUDED, true),
    defaultVat: readNumber(process.env.MOYSKLAD_DEFAULT_VAT, 0),
  }
}

export function isMoyskladEnabled() {
  return getMoyskladConfig().enabled
}

export function assertMoyskladReady(config = getMoyskladConfig()) {
  if (!config.enabled) {
    throw new Error("MOYSKLAD_ENABLED is not true")
  }
  if (config.authMode === "bearer" && !config.token) {
    throw new Error("MOYSKLAD_TOKEN is not configured")
  }
  if (config.authMode === "basic" && (!config.login || !config.password)) {
    throw new Error("MOYSKLAD_LOGIN and MOYSKLAD_PASSWORD are not configured")
  }
  if (!config.organizationId) {
    throw new Error("MOYSKLAD_ORGANIZATION_ID is not configured")
  }
}
