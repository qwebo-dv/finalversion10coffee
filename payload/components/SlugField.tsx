"use client"

import { useEffect, useRef } from "react"
import type { ChangeEvent } from "react"
import { TextInput, useField, useFormFields } from "@payloadcms/ui"
import { slugify } from "@/lib/slug"

interface SlugFieldProps {
  field: {
    admin?: {
      description?: string
      placeholder?: string
    }
    label?: string
    required?: boolean
  }
  path: string
  readOnly?: boolean
}

export default function SlugField({ field, path: pathFromProps, readOnly = false }: SlugFieldProps) {
  const source = useFormFields(([fields]) => fields?.title?.value ?? fields?.name?.value)
  const { disabled, path, setValue, showError, value } = useField<string>({ path: pathFromProps })
  const generatedValue = useRef("")

  useEffect(() => {
    const nextGeneratedValue = slugify(String(source || ""))
    const currentValue = String(value || "")

    if (!nextGeneratedValue || (currentValue && currentValue !== generatedValue.current)) return

    generatedValue.current = nextGeneratedValue
    if (currentValue !== nextGeneratedValue) setValue(nextGeneratedValue, true)
  }, [source, setValue, value])

  return (
    <TextInput
      description={field.admin?.description || "Формируется из названия; можно отредактировать вручную."}
      label={field.label || "Slug (URL)"}
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const nextValue = slugify(event.target.value)
        generatedValue.current = nextValue === slugify(String(source || "")) ? nextValue : ""
        setValue(nextValue)
      }}
      path={path}
      placeholder={field.admin?.placeholder || "sposob-prigotovleniya-espresso"}
      readOnly={readOnly || disabled}
      required={field.required}
      showError={showError}
      value={value || ""}
    />
  )
}
