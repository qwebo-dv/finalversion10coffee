"use server"

import config from "@payload-config"
import { getPayload } from "payload"
import { z } from "zod"

export type JobApplicationState = {
  success: boolean
  error?: string
}

const MAX_RESUME_SIZE = 10 * 1024 * 1024
const ALLOWED_RESUME_TYPES = new Map([
  ["pdf", "application/pdf"],
  ["doc", "application/msword"],
  ["docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
])

const applicationSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(120, "Имя слишком длинное"),
  desiredPosition: z.string().trim().min(2, "Укажите желаемую должность").max(160, "Название должности слишком длинное"),
  email: z.string().trim().email("Укажите корректный email").max(254),
  phone: z.string().trim().regex(/^\+7\d{10}$/, "Укажите телефон полностью"),
  consent: z.literal("on", { error: "Подтвердите согласие на обработку персональных данных" }),
  website: z.string().max(0).optional(),
})

function safeFileName(name: string): string {
  const extension = name.split(".").pop()?.toLowerCase() || "file"
  const base = name.slice(0, -(extension.length + 1)) || "resume"
  const cleanBase = base
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "resume"
  return `${cleanBase}.${extension}`
}

function hasExpectedSignature(extension: string, bytes: Buffer): boolean {
  if (extension === "pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-"
  if (extension === "doc") {
    return bytes.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
  }
  if (extension === "docx") {
    return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
  }
  return false
}

export async function submitJobApplication(
  _previousState: JobApplicationState,
  formData: FormData,
): Promise<JobApplicationState> {
  const parsed = applicationSchema.safeParse({
    name: formData.get("name"),
    desiredPosition: formData.get("desiredPosition"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    consent: formData.get("consent"),
    website: formData.get("website") || "",
  })

  if (!parsed.success) {
    const isHoneypot = parsed.error.issues.some((issue) => issue.path[0] === "website")
    if (isHoneypot) return { success: true }
    return { success: false, error: parsed.error.issues[0]?.message || "Проверьте заполнение формы" }
  }

  const resume = formData.get("resume")
  if (!(resume instanceof File) || resume.size === 0) {
    return { success: false, error: "Прикрепите резюме в формате PDF, DOC или DOCX" }
  }
  if (resume.size > MAX_RESUME_SIZE) {
    return { success: false, error: "Размер резюме не должен превышать 10 МБ" }
  }

  const extension = resume.name.split(".").pop()?.toLowerCase() || ""
  const expectedMimeType = ALLOWED_RESUME_TYPES.get(extension)
  if (!expectedMimeType) {
    return { success: false, error: "Допустимы только файлы PDF, DOC и DOCX" }
  }

  const resumeBytes = Buffer.from(await resume.arrayBuffer())
  if (!hasExpectedSignature(extension, resumeBytes)) {
    return { success: false, error: "Файл повреждён или его формат не соответствует расширению" }
  }

  const payload = await getPayload({ config })
  let uploadedResumeId: number | string | null = null

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const recentApplications = await payload.find({
      collection: "job-applications",
      where: {
        and: [
          { email: { equals: parsed.data.email } },
          { createdAt: { greater_than: oneHourAgo } },
        ],
      },
      limit: 3,
      depth: 0,
      overrideAccess: true,
    })
    if (recentApplications.totalDocs >= 3) {
      return { success: false, error: "Слишком много заявок. Попробуйте снова через час." }
    }

    const uploadedResume = await payload.create({
      collection: "job-application-files",
      data: {
        title: `${parsed.data.name} — ${parsed.data.desiredPosition}`,
      },
      file: {
        data: resumeBytes,
        mimetype: expectedMimeType,
        name: safeFileName(resume.name),
        size: resume.size,
      },
      overrideAccess: true,
    })
    uploadedResumeId = uploadedResume.id

    await payload.create({
      collection: "job-applications",
      data: {
        name: parsed.data.name,
        desiredPosition: parsed.data.desiredPosition,
        email: parsed.data.email,
        phone: parsed.data.phone,
        resume: uploadedResume.id,
        consent: true,
        status: "new",
        source: "website",
      },
      overrideAccess: true,
    })

    return { success: true }
  } catch (error) {
    if (uploadedResumeId !== null) {
      try {
        await payload.delete({
          collection: "job-application-files",
          id: uploadedResumeId,
          overrideAccess: true,
        })
      } catch {
        // The application failed, but cleanup must not hide the original error.
      }
    }
    payload.logger.error({ err: error, msg: "Failed to save job application" })
    return { success: false, error: "Не удалось отправить заявку. Попробуйте ещё раз позже." }
  }
}
