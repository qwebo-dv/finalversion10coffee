import { z } from "zod"

const text = z.string().max(2000).nullable().optional()
const companyFields = {
  name: z.string().trim().min(1).max(500),
  inn: z.string().transform((value) => value.replace(/\D/g, "").slice(0, 12)),
  kpp: text, ogrn: text, legal_address: text, actual_address: text,
  bank_name: text, bik: text, correspondent_account: text, settlement_account: text,
  contact_person: text, contact_phone: text, contact_email: text,
}

// Unknown fields (owner, primary key, integration IDs) never reach SQL.
export const createCompanyInput = z.object(companyFields)
export const updateCompanyInput = z.object(companyFields).partial()
