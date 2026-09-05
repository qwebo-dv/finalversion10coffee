"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Company } from "@/types"
import { createCompanyInput, updateCompanyInput } from "@/lib/company-input"

export async function getClientCompanies() {
  const supabase = await createClient("business")
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[companies] Не удалось загрузить компании", { userId: user.id, error: error.message })
    throw new Error("Не удалось загрузить компании")
  }
  return (data as Company[]) || []
}

export async function getCompanyById(companyId: string) {
  const supabase = await createClient("business")
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .eq("client_id", user.id)
    .single()

  return data as Company | null
}

export async function createCompany(formData: {
  name: string
  inn: string
  kpp?: string
  ogrn?: string
  legal_address?: string
  actual_address?: string
  bank_name?: string
  bik?: string
  correspondent_account?: string
  settlement_account?: string
  contact_person?: string
  contact_phone?: string
  contact_email?: string
}) {
  const supabase = await createClient("business")
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Не авторизован" }

  const parsed = createCompanyInput.safeParse(formData)
  if (!parsed.success) return { error: "Некорректные реквизиты компании" }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      ...parsed.data,
      client_id: user.id,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath("/dashboard/companies")
  return { success: true, company: data as Company }
}

export async function updateCompany(
  companyId: string,
  formData: Partial<Company>
) {
  const supabase = await createClient("business")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }
  const fieldsThatChangeCounterparty = [
    "name",
    "inn",
    "kpp",
    "ogrn",
    "legal_address",
    "actual_address",
    "contact_phone",
    "contact_email",
  ]
  const parsed = updateCompanyInput.safeParse(formData)
  if (!parsed.success) return { error: "Некорректные реквизиты компании" }
  const updateData: Partial<Company> = parsed.data

  if (fieldsThatChangeCounterparty.some((field) => field in updateData)) {
    updateData.moysklad_counterparty_id = null
  }

  const { error } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", companyId)
    .eq("client_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/companies")
  return { success: true }
}

export async function deleteCompany(companyId: string) {
  const supabase = await createClient("business")
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Не авторизован" }

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)
    .eq("client_id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/companies")
  return { success: true }
}
