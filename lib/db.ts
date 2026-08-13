import { Pool, type QueryResult, type QueryResultRow } from "pg"

declare global {
  var __coffeePgPool: Pool | undefined
}

function getConnectionString() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured")
  }
  return connectionString
}

function shouldUseSsl(connectionString: string) {
  if (process.env.DATABASE_SSL === "false") return false
  const { hostname } = new URL(connectionString)
  if (hostname === "localhost" || hostname === "127.0.0.1") return false
  if (hostname === "10coffee-postgres" || !hostname.includes(".")) return false
  return true
}

export function getPool() {
  if (!globalThis.__coffeePgPool) {
    const connectionString = getConnectionString()
    globalThis.__coffeePgPool = new Pool({
      connectionString,
      ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : false,
    })
  }

  return globalThis.__coffeePgPool
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values)
}

function isTransientReadError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String(error.code || "") : ""
  return code.startsWith("08") || ["40001", "40P01", "53300", "57P01", "57P02", "57P03", "ECONNRESET", "ETIMEDOUT", "EPIPE"].includes(code)
}

/** Retry only read-only SQL. Retrying mutations could duplicate a committed write. */
export async function dbReadQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = [],
  maxAttempts = 3,
): Promise<QueryResult<T>> {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await dbQuery<T>(text, values)
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts || !isTransientReadError(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, attempt * 100))
    }
  }
  throw lastError
}

export function quoteIdent(identifier: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`)
  }
  return `"${identifier}"`
}
