"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { Company } from "@/types"

function sanitizeInn(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "").slice(0, 12)
}

export async function getClientCompanies() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return []

  const { data } = await supabase
    .from("companies")
    .select("*")
    .eq("client_id", user.id)
    .order("created_at", { ascending: false })

  return (data as Company[]) || []
}

export async function getCompanyById(companyId: string) {
  const supabase = await createClient()
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
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Не авторизован" }

  const normalizedFormData = {
    ...formData,
    inn: sanitizeInn(formData.inn),
  }

  const { data, error } = await supabase
    .from("companies")
    .insert({
      client_id: user.id,
      ...normalizedFormData,
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
  const supabase = await createClient()
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
  const updateData: Partial<Company> = {
    ...formData,
  }

  if (typeof formData.inn === "string") {
    updateData.inn = sanitizeInn(formData.inn)
  }

  if (fieldsThatChangeCounterparty.some((field) => field in formData)) {
    updateData.moysklad_counterparty_id = null
  }

  const { error } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", companyId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/companies")
  return { success: true }
}

export async function deleteCompany(companyId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from("companies")
    .delete()
    .eq("id", companyId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/companies")
  return { success: true }
}
