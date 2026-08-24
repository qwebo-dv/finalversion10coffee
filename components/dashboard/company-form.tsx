"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createCompany, updateCompany, deleteCompany } from "@/lib/actions/companies"
import { companySchema, type CompanyFormData } from "@/lib/utils/validators"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import PhoneInput from "@/components/shared/phone-input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Loader2, Search, Trash2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface CompanyFormProps {
  mode: "create" | "edit"
  companyId?: string
  defaultValues?: CompanyFormData
}

function sanitizeInn(value: string): string {
  return value.replace(/\D/g, "").slice(0, 12)
}

export function CompanyForm({ mode, companyId, defaultValues }: CompanyFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchingInn, setSearchingInn] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)

  const form = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    defaultValues: defaultValues ?? {
      name: "",
      inn: "",
      kpp: "",
      ogrn: "",
      legal_address: "",
      actual_address: "",
      bank_name: "",
      bik: "",
      correspondent_account: "",
      settlement_account: "",
      contact_person: "",
      contact_phone: "",
      contact_email: "",
    },
  })

  async function searchByInn() {
    const inn = sanitizeInn(form.getValues("inn"))
    form.setValue("inn", inn, { shouldValidate: true })

    if (!inn || inn.length < 10) {
      toast.error("Введите корректный ИНН (минимум 10 цифр)")
      return
    }

    setSearchingInn(true)
    try {
      const response = await fetch("/api/dadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inn }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.name) {
          form.setValue("name", data.name)
          form.setValue("kpp", data.kpp || "")
          form.setValue("ogrn", data.ogrn || "")
          form.setValue("legal_address", data.address || "")
          toast.success("Данные компании найдены")
        } else {
          toast.error("Компания не найдена по данному ИНН")
        }
      }
    } catch {
      toast.error("Ошибка при поиске компании")
    } finally {
      setSearchingInn(false)
    }
  }

  async function onSubmit(data: CompanyFormData) {
    setLoading(true)
    if (mode === "edit" && companyId) {
      const result = await updateCompany(companyId, data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Компания обновлена")
        router.push("/dashboard/companies")
      }
    } else {
      const result = await createCompany(data)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Компания добавлена")
        router.push("/dashboard/companies")
      }
    }
    setLoading(false)
  }

  async function handleDelete() {
    if (!companyId) return
    if (!confirm("Удалить компанию? Это действие нельзя отменить.")) return

    setDeleting(true)
    const result = await deleteCompany(companyId)
    if (result.error) {
      toast.error(result.error)
      setDeleting(false)
    } else {
      toast.success("Компания удалена")
      router.push("/dashboard/companies")
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard/companies">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            {mode === "edit" ? "Редактировать компанию" : "Добавить компанию"}
          </h1>
          <p className="text-muted-foreground">
            {mode === "edit"
              ? "Измените данные компании"
              : "Введите ИНН для автозаполнения данных"}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Основные данные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <FormField
                  control={form.control}
                  name="inn"
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>ИНН</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="1234567890"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={12}
                          {...field}
                          onChange={(event) => field.onChange(sanitizeInn(event.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="sm:pt-[21px]">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={searchByInn}
                    disabled={searchingInn}
                    className="w-full sm:w-auto"
                  >
                    {searchingInn ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    <span className="ml-2">Найти</span>
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Название организации</FormLabel>
                    <FormControl>
                      <Input placeholder="ООО «Кофейня»" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="kpp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>КПП</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="ogrn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ОГРН</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="legal_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Юридический адрес</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="actual_address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Фактический адрес</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Bank details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Банковские реквизиты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="bank_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Наименование банка</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bik"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>БИК</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="settlement_account"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Расчётный счёт</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="correspondent_account"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Корреспондентский счёт</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Контактные данные</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="contact_person"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Контактное лицо</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contact_phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Телефон</FormLabel>
                      <FormControl>
                        <PhoneInput
                          name="contact_phone"
                          className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="contact_email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border p-3">
            <input name="consent" type="checkbox" required checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#5b328a]" />
            <span className="text-xs leading-5 text-muted-foreground">Я принимаю <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">политику конфиденциальности</a> и даю согласие на обработку персональных данных в соответствии с <a href="/Политика обработки персональных данных пользователей сайта.pdf" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">правилами обработки персональных данных</a>.</span>
          </label>

          <div className="flex gap-3">
            <Button type="submit" disabled={loading || !consentAccepted}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {mode === "edit" ? "Сохранить" : "Добавить компанию"}
            </Button>
            {mode === "edit" && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Удалить
              </Button>
            )}
            <Button variant="outline" type="button" asChild>
              <Link href="/dashboard/companies">Отмена</Link>
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
