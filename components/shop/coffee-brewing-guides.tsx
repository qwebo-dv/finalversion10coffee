"use client"

import Image from "next/image"
import { useState } from "react"
import { ArrowRight, Coffee, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { CoffeeBrewingGuide } from "@/types"

const ARTICLE_HTML_CLASSNAME = [
  "max-w-none text-[15px] leading-7 text-[#554b43]",
  "[&_p]:mb-4 [&_p:last-child]:mb-0",
  "[&_h1]:mt-7 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-black [&_h1]:leading-tight [&_h1]:text-[#1d1d1b]",
  "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-black [&_h2]:leading-tight [&_h2]:text-[#1d1d1b]",
  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-black [&_h3]:leading-tight [&_h3]:text-[#1d1d1b]",
  "[&_strong]:font-bold [&_strong]:text-[#1d1d1b]",
  "[&_em]:italic",
  "[&_a]:font-semibold [&_a]:text-[#5b328a] [&_a]:underline [&_a]:underline-offset-2",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-5",
  "[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_li]:mb-1.5",
  "[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-[#5b328a]/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[#6e655e]",
  "[&_img]:my-4 [&_img]:rounded-2xl [&_img]:shadow-md",
].join(" ")

interface CoffeeBrewingGuidesProps {
  guides: CoffeeBrewingGuide[]
}

export function CoffeeBrewingGuides({ guides }: CoffeeBrewingGuidesProps) {
  const [selectedGuide, setSelectedGuide] = useState<CoffeeBrewingGuide | null>(null)

  if (!guides.length) return null

  return (
    <section className="mt-16">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#faead5]">
          <Coffee className="h-5 w-5 text-[#5b328a]" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-black tracking-tight">Способы приготовления</h2>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {guides.map((guide) => (
          <button
            key={guide.id}
            type="button"
            onClick={() => setSelectedGuide(guide)}
            className="group flex min-h-16 items-center gap-4 rounded-[20px] border border-black/[0.06] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#5b328a]/25 hover:shadow-md"
          >
            {guide.image_url && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#faead5]">
                <Image src={guide.image_url} alt="" fill className="object-cover" sizes="64px" />
              </div>
            )}
            <span className="min-w-0 flex-1">
              <span className="block font-bold text-[#1d1d1b]">{guide.title}</span>
              {guide.description && <span className="mt-0.5 block line-clamp-2 text-sm leading-5 text-[#6e655e]">{guide.description}</span>}
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[#5b328a] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
      </div>

      <Dialog open={Boolean(selectedGuide)} onOpenChange={(open) => !open && setSelectedGuide(null)}>
        {selectedGuide && (
          <DialogContent showCloseButton={false} className="relative flex max-h-[calc(100dvh-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-2xl border-0 bg-[#f8f5f1] p-0 sm:max-w-3xl">
            <DialogClose asChild>
              <button
                type="button"
                aria-label="Закрыть статью"
                title="Закрыть"
                className="absolute top-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/40 focus-visible:outline-none"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </DialogClose>
            {selectedGuide.image_url && (
              <div className="relative aspect-[16/7] shrink-0 overflow-hidden bg-[#faead5]">
                <Image src={selectedGuide.image_url} alt="" fill className="object-cover" sizes="(min-width: 640px) 768px, 100vw" />
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
              <DialogHeader>
                <DialogTitle className="pr-8 text-2xl font-black leading-tight text-[#1d1d1b]">{selectedGuide.title}</DialogTitle>
                {selectedGuide.description && <DialogDescription className="text-base leading-6 text-[#6e655e]">{selectedGuide.description}</DialogDescription>}
              </DialogHeader>
              <div className={`mt-6 ${ARTICLE_HTML_CLASSNAME}`} dangerouslySetInnerHTML={{ __html: selectedGuide.content }} />
            </div>
          </DialogContent>
        )}
      </Dialog>
    </section>
  )
}
