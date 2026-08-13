import "server-only"
import { getPayload } from "payload"
import configPromise from "@payload-config"

export type PublishedFaq = {
  id: string
  question: string
  answer: string
}

export async function getPublishedFaqs(limit?: number): Promise<PublishedFaq[]> {
  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: "faqs",
    where: { status: { equals: "published" } },
    sort: "-updatedAt",
    depth: 0,
    limit: limit || 100,
    overrideAccess: true,
  })

  return docs
    .filter((faq) => Boolean(faq.question && faq.answer))
    .map((faq) => ({ id: String(faq.id), question: faq.question, answer: faq.answer || "" }))
}
