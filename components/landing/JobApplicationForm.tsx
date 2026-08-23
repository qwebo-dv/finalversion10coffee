"use client"

import { useActionState, useState } from "react"
import { FileText, Upload } from "lucide-react"

import PhoneInput from "@/components/shared/phone-input"
import {
  submitJobApplication,
  type JobApplicationState,
} from "@/lib/actions/job-applications"

import styles from "./JobApplicationForm.module.css"

const initialState: JobApplicationState = { success: false }

export default function JobApplicationForm() {
  const [state, formAction, isPending] = useActionState(submitJobApplication, initialState)
  const [fileName, setFileName] = useState("")

  if (state.success) {
    return (
      <div className={styles.success} role="status">
        <span className={styles.successMark}>✓</span>
        <div>
          <h2>Резюме отправлено</h2>
          <p>Мы сохранили ваши данные и свяжемся с вами, когда появится подходящая вакансия.</p>
        </div>
      </div>
    )
  }

  return (
    <form action={formAction} className={styles.form}>
      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Ваше имя</span>
          <input name="name" type="text" autoComplete="name" maxLength={120} required />
        </label>

        <label className={styles.field}>
          <span>Желаемая должность</span>
          <input name="desiredPosition" type="text" autoComplete="organization-title" maxLength={160} required />
        </label>

        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span>Электронная почта</span>
            <input name="email" type="email" autoComplete="email" maxLength={254} required />
          </label>

          <label className={styles.field}>
            <span>Телефон</span>
            <PhoneInput name="phone" required />
          </label>
        </div>
      </div>

      <label className={styles.consent}>
        <input name="consent" type="checkbox" required />
        <span>
          Я принимаю{" "}
          <a href="/Политика конфиденциальности.pdf" target="_blank" rel="noopener noreferrer">
            политику конфиденциальности
          </a>{" "}
          и{" "}
          <a
            href="/Политика обработки персональных данных пользователей сайта.pdf"
            target="_blank"
            rel="noopener noreferrer"
          >
            правила обработки персональных данных
          </a>
          .
        </span>
      </label>

      <label className={styles.fileDrop}>
        <input
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          required
          onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
        />
        {fileName ? <FileText aria-hidden="true" /> : <Upload aria-hidden="true" />}
        <span>{fileName || "Перетащите или прикрепите резюме"}</span>
        <small>PDF, DOC или DOCX · до 10 МБ</small>
      </label>

      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Ваш сайт
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error && <p className={styles.error} role="alert">{state.error}</p>}

      <button className={styles.submit} type="submit" disabled={isPending}>
        {isPending ? "Отправляем…" : "Отправить резюме"}
      </button>
    </form>
  )
}
