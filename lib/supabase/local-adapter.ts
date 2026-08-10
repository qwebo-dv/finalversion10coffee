import { dbQuery, quoteIdent } from "@/lib/db"
import {
  createAuthUser,
  createSession,
  destroyCurrentSession,
  getCurrentUser,
  getUserById,
  listAuthUsers,
  updateAuthUser,
  verifyPassword,
} from "@/lib/auth/local"
import type { AppUser } from "@/lib/auth/types"
import type { CustomerSessionScope } from "@/lib/auth/constants"

// The compatibility layer intentionally mirrors Supabase's untyped query result.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type QueryResponse<TData = any> = {
  data: TData
  error: { message: string } | null
  count?: number | null
}

type Filter =
  | { type: "eq"; column: string; value: unknown }
  | { type: "is"; column: string; value: unknown }
  | { type: "gt"; column: string; value: unknown }
  | { type: "in"; column: string; value: unknown[] }

type Order = { column: string; ascending: boolean }

function tableName(table: string) {
  if (table.includes(".")) {
    return table.split(".").map(quoteIdent).join(".")
  }
  return `public.${quoteIdent(table)}`
}

function columnList(columns: string) {
  if (!columns || columns.trim() === "*") return "*"
  return columns
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean)
    .map((column) => quoteIdent(column))
    .join(", ")
}

function buildWhere(filters: Filter[], values: unknown[]) {
  if (!filters.length) return ""

  const clauses = filters.map((filter) => {
    const col = quoteIdent(filter.column)
    if (filter.type === "is") {
      if (filter.value === null) return `${col} is null`
      values.push(filter.value)
      return `${col} is $${values.length}`
    }
    if (filter.type === "gt") {
      values.push(filter.value)
      return `${col} > $${values.length}`
    }
    if (filter.type === "in") {
      values.push(filter.value)
      return `${col} = any($${values.length})`
    }
    values.push(filter.value)
    return `${col} = $${values.length}`
  })

  return ` where ${clauses.join(" and ")}`
}

function normalizeInsertRows(payload: unknown) {
  const rows = Array.isArray(payload) ? payload : [payload]
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
}

export class LocalQueryBuilder implements PromiseLike<QueryResponse> {
  private operation: "select" | "insert" | "update" | "delete" | "upsert" = "select"
  private selected = "*"
  private filters: Filter[] = []
  private orders: Order[] = []
  private limitCount: number | null = null
  private rangeFrom: number | null = null
  private rangeTo: number | null = null
  private singleMode = false
  private payload: unknown
  private countMode = false
  private onConflictColumn: string | null = null

  constructor(private readonly table: string) {}

  select(columns = "*", options?: { count?: string }) {
    this.selected = columns
    this.countMode = options?.count === "exact"
    return this
  }

  insert(payload: unknown) {
    this.operation = "insert"
    this.payload = payload
    return this
  }

  update(payload: unknown) {
    this.operation = "update"
    this.payload = payload
    return this
  }

  upsert(payload: unknown, options?: { onConflict?: string }) {
    this.operation = "upsert"
    this.payload = payload
    this.onConflictColumn = options?.onConflict || null
    return this
  }

  delete() {
    this.operation = "delete"
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ type: "eq", column, value })
    return this
  }

  is(column: string, value: unknown) {
    this.filters.push({ type: "is", column, value })
    return this
  }

  gt(column: string, value: unknown) {
    this.filters.push({ type: "gt", column, value })
    return this
  }

  in(column: string, value: unknown[]) {
    this.filters.push({ type: "in", column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending !== false })
    return this
  }

  limit(count: number) {
    this.limitCount = count
    return this
  }

  range(from: number, to: number) {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  single() {
    this.singleMode = true
    return this
  }

  maybeSingle<T = unknown>() {
    this.singleMode = true
    return this as unknown as PromiseLike<QueryResponse<T | null>>
  }

  returns<T = unknown>() {
    return this as unknown as PromiseLike<QueryResponse<T>>
  }

  then<TResult1 = QueryResponse, TResult2 = never>(
    onfulfilled?: ((value: QueryResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<QueryResponse> {
    try {
      if (this.operation === "select") return await this.executeSelect()
      if (this.operation === "insert") return await this.executeInsert(false)
      if (this.operation === "upsert") return await this.executeInsert(true)
      if (this.operation === "update") return await this.executeUpdate()
      return await this.executeDelete()
    } catch (error) {
      return {
        data: null,
        error: { message: error instanceof Error ? error.message : "Database error" },
        count: null,
      }
    }
  }

  private async executeSelect(): Promise<QueryResponse> {
    const values: unknown[] = []
    const where = buildWhere(this.filters, values)
    const order = this.orders.length
      ? ` order by ${this.orders
          .map((item) => `${quoteIdent(item.column)} ${item.ascending ? "asc" : "desc"}`)
          .join(", ")}`
      : ""
    const limit = this.limitCount !== null
      ? ` limit ${this.limitCount}`
      : this.rangeFrom !== null && this.rangeTo !== null
        ? ` limit ${this.rangeTo - this.rangeFrom + 1} offset ${this.rangeFrom}`
        : ""
    const selected = columnList(this.selected)
    const result = await dbQuery(`select ${selected} from ${tableName(this.table)}${where}${order}${limit}`, values)

    let count: number | null = null
    if (this.countMode) {
      const countValues: unknown[] = []
      const countWhere = buildWhere(this.filters, countValues)
      const countResult = await dbQuery<{ count: string }>(
        `select count(*)::text as count from ${tableName(this.table)}${countWhere}`,
        countValues
      )
      count = Number(countResult.rows[0]?.count || 0)
    }

    const data = this.singleMode ? (result.rows[0] || null) : result.rows
    return { data, error: null, count }
  }

  private async executeInsert(isUpsert: boolean): Promise<QueryResponse> {
    const rows = normalizeInsertRows(this.payload)
    if (!rows.length) return { data: null, error: null }

    const columns = Object.keys(rows[0])
    const values: unknown[] = []
    const tuples = rows.map((row) => {
      const placeholders = columns.map((column) => {
        values.push(row[column])
        return `$${values.length}`
      })
      return `(${placeholders.join(", ")})`
    })
    const quotedColumns = columns.map(quoteIdent).join(", ")
    const conflict = isUpsert && this.onConflictColumn
      ? ` on conflict (${quoteIdent(this.onConflictColumn)}) do update set ${columns
          .filter((column) => column !== this.onConflictColumn)
          .map((column) => `${quoteIdent(column)} = excluded.${quoteIdent(column)}`)
          .join(", ")}`
      : ""
    const returning = this.selected ? ` returning ${columnList(this.selected)}` : ""
    const result = await dbQuery(
      `insert into ${tableName(this.table)} (${quotedColumns}) values ${tuples.join(", ")}${conflict}${returning}`,
      values
    )

    const data = this.singleMode ? (result.rows[0] || null) : result.rows
    return { data, error: null }
  }

  private async executeUpdate(): Promise<QueryResponse> {
    const payload = this.payload && typeof this.payload === "object" && !Array.isArray(this.payload)
      ? this.payload as Record<string, unknown>
      : {}
    const values: unknown[] = []
    const sets = Object.entries(payload).map(([column, value]) => {
      values.push(value)
      return `${quoteIdent(column)} = $${values.length}`
    })
    if (!sets.length) return { data: null, error: null }

    const where = buildWhere(this.filters, values)
    const returning = this.selected ? ` returning ${columnList(this.selected)}` : ""
    const result = await dbQuery(
      `update ${tableName(this.table)} set ${sets.join(", ")}${where}${returning}`,
      values
    )

    const data = this.singleMode ? (result.rows[0] || null) : result.rows
    return { data, error: null }
  }

  private async executeDelete(): Promise<QueryResponse> {
    const values: unknown[] = []
    const where = buildWhere(this.filters, values)
    const result = await dbQuery(`delete from ${tableName(this.table)}${where} returning *`, values)
    const data = this.singleMode ? (result.rows[0] || null) : result.rows
    return { data, error: null }
  }
}

function mapAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : "Auth error"
  return { message }
}

export function createLocalClient(sessionScope?: CustomerSessionScope) {
  return {
    from(table: string) {
      return new LocalQueryBuilder(table)
    },
    auth: {
      async getUser() {
        const user = await getCurrentUser(sessionScope)
        return { data: { user }, error: null }
      },
      async signInWithPassword(params: { email: string; password: string }) {
        try {
          const user = await verifyPassword(params.email, params.password)
          if (!user) {
            return { data: { user: null }, error: { message: "Неверный email или пароль" } }
          }
          await createSession(user.id, sessionScope)
          return { data: { user }, error: null }
        } catch (error) {
          return { data: { user: null }, error: mapAuthError(error) }
        }
      },
      async signOut() {
        await destroyCurrentSession(sessionScope)
        return { error: null }
      },
      async updateUser(params: { data?: Record<string, unknown>; password?: string }) {
        const currentUser = await getCurrentUser(sessionScope)
        if (!currentUser) return { data: { user: null }, error: { message: "Не авторизован" } }
        const metadata = params.data
          ? { ...currentUser.user_metadata, ...params.data }
          : undefined
        const user = await updateAuthUser(currentUser.id, {
          metadata,
          password: params.password,
        })
        return { data: { user }, error: null }
      },
    },
  }
}

export function createLocalAdminClient() {
  return {
    ...createLocalClient(),
    auth: {
      admin: {
        async createUser(params: {
          email: string
          password: string
          email_confirm?: boolean
          user_metadata?: Record<string, unknown>
        }) {
          try {
            const user = await createAuthUser({
              email: params.email,
              password: params.password,
              metadata: params.user_metadata || {},
            })
            return { data: { user }, error: null }
          } catch (error) {
            return { data: { user: null }, error: mapAuthError(error) }
          }
        },
        async updateUserById(id: string, params: { password?: string; user_metadata?: Record<string, unknown> }) {
          try {
            const current = await getUserById(id)
            const metadata = params.user_metadata
              ? { ...(current?.user_metadata || {}), ...params.user_metadata }
              : undefined
            const user = await updateAuthUser(id, {
              password: params.password,
              metadata,
            })
            return { data: { user }, error: null }
          } catch (error) {
            return { data: { user: null }, error: mapAuthError(error) }
          }
        },
        async getUserById(id: string) {
          try {
            const user = await getUserById(id)
            return { data: { user }, error: null }
          } catch (error) {
            return { data: { user: null }, error: mapAuthError(error) }
          }
        },
        async listUsers() {
          try {
            const users = await listAuthUsers()
            return { data: { users }, error: null }
          } catch (error) {
            return { data: { users: [] as AppUser[] }, error: mapAuthError(error) }
          }
        },
      },
    },
  }
}
