import type { Metadata } from "next"

import JobApplicationForm from "@/components/landing/JobApplicationForm"
import LandingFooter from "@/components/landing/LandingFooter"
import SiteHeader from "@/components/landing/SiteHeader"

import styles from "./vakansii.module.css"

export const metadata: Metadata = {
  title: "Вакансии | 10coffee",
  description: "Отправьте резюме в кадровый резерв 10coffee. Мы свяжемся с вами, когда появится подходящая вакансия.",
  alternates: { canonical: "/vakansii" },
}

export default function VacanciesPage() {
  return (
    <>
      <SiteHeader />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.eyebrow}>Команда 10coffee</p>
            <h1>Вакансии</h1>
            <p className={styles.lead}>
              Мы собираем кадровый резерв людей, которым близки кофе, гостеприимство и внимательная работа.
            </p>
          </div>
        </section>

        <section className={styles.content}>
          <div className={styles.layout}>
            <div className={styles.copy}>
              <p className={styles.sectionLabel}>Откликнуться</p>
              <h2>Расскажите, чем хотите заниматься</h2>
              <p>
                Мы сохраним отклик в кадровом резерве и свяжемся с вами, когда появится подходящая
                возможность.
              </p>
              <div className={styles.note}>
                <span>Важно</span>
                <p>Резюме и контактные данные видят только уполномоченные сотрудники 10coffee.</p>
              </div>
            </div>

            <div className={styles.formCard}>
              <JobApplicationForm />
            </div>
          </div>
        </section>
      </main>

      <LandingFooter />
    </>
  )
}
