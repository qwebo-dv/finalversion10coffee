import { createLocalClient } from "@/lib/supabase/local-adapter"
import type { CustomerSessionScope } from "@/lib/auth/constants"

export async function createClient(sessionScope?: CustomerSessionScope) {
  return createLocalClient(sessionScope)
}
