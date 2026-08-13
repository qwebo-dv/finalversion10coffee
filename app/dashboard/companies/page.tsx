import Link from "next/link"
import { getClientCompanies } from "@/lib/actions/companies"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Building2, Pencil, Plus } from "lucide-react"
import { DeleteCompanyButton } from "./delete-button"

export default async function CompaniesPage() {
  let companies: Awaited<ReturnType<typeof getClientCompanies>> = []
  let loadError = false
  try {
    companies = await getClientCompanies()
  } catch {
    loadError = true
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Мои компании</h1>
          <p className="text-sm text-muted-foreground">
            Управление юридическими лицами
          </p>
        </div>
        <Button asChild size="sm" className="w-full sm:w-auto">
          <Link href="/dashboard/companies/new">
            <Plus className="h-4 w-4 mr-2" />
            Добавить компанию
          </Link>
        </Button>
      </div>

      {loadError ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="mb-4 h-16 w-16 text-red-300" />
          <h3 className="text-lg font-medium">Не удалось загрузить компании</h3>
          <p className="mt-1 text-sm text-muted-foreground">Данные не удалены. Повторите загрузку через несколько секунд.</p>
          <Button className="mt-4" variant="outline" asChild>
            <Link href="/dashboard/companies">Повторить</Link>
          </Button>
        </div>
      ) : companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="h-16 w-16 text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-medium">Нет добавленных компаний</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Добавьте компанию для оформления заказов
          </p>
          <Button className="mt-4" asChild>
            <Link href="/dashboard/companies/new">
              <Plus className="h-4 w-4 mr-2" />
              Добавить компанию
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{company.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      ИНН: {company.inn}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                      <Link href={`/dashboard/companies/${company.id}`}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </Button>
                    <DeleteCompanyButton companyId={company.id} companyName={company.name} />
                  </div>
                </div>
                {company.legal_address && (
                  <p className="text-sm text-muted-foreground">
                    {company.legal_address}
                  </p>
                )}
                {company.contact_person && (
                  <p className="text-sm">
                    Контакт: {company.contact_person}
                    {company.contact_phone && ` · ${company.contact_phone}`}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
