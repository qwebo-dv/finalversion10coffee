"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/providers/auth-provider"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import PhoneInput from "@/components/shared/phone-input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Plus, X, Loader2, Camera } from "lucide-react"
import { toast } from "sonner"
import { saveQuickComments, getQuickComments } from "@/lib/actions/client-settings"
import { isValidRussianPhone, normalizeRussianPhone } from "@/lib/utils/phone"

function resizeImage(file: File, maxSize: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = maxSize
      canvas.height = maxSize
      const ctx = canvas.getContext("2d")!
      const min = Math.min(img.width, img.height)
      const sx = (img.width - min) / 2
      const sy = (img.height - min) / 2
      ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85
      )
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function SettingsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const isIndividual = user?.user_metadata?.customer_type === "individual"
  const [loading, setLoading] = useState(false)
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [quickComments, setQuickComments] = useState<string[]>([])
  const [newComment, setNewComment] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (user) {
      setFullName(user.user_metadata?.full_name || "")
      setPhone(user.user_metadata?.phone || "")
      setAddress((user.user_metadata?.address as string) || "")
      setAvatarUrl(user.user_metadata?.avatar_url || null)

      // Load settings via server action (bypasses RLS)
      getQuickComments().then((comments) => {
        setQuickComments(comments)
      })
    }
  }, [user, supabase])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setAvatarLoading(true)

    try {
      const resized = await resizeImage(file, 200)
      const form = new FormData()
      form.append("file", resized, "avatar.jpg")

      const res = await fetch("/api/upload-avatar", { method: "POST", body: form })
      const json = await res.json()

      if (!res.ok) throw new Error(json.error || "Ошибка загрузки")

      await supabase.auth.updateUser({ data: { avatar_url: json.url } })
      setAvatarUrl(json.url)
      toast.success("Аватар обновлён")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Ошибка загрузки"
      toast.error(message)
    } finally {
      setAvatarLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSaveProfile() {
    if (!user) return

    if (!isValidRussianPhone(phone)) {
      toast.error("Введите корректный мобильный телефон")
      return
    }

    setLoading(true)

    try {
      const normalizedPhone = normalizeRussianPhone(phone)
      // Update auth metadata so values persist across sessions
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: fullName, phone: normalizedPhone, address: address.trim() },
      })
      if (authError) throw authError

      setPhone(normalizedPhone)
      toast.success("Профиль обновлён")
    } catch {
      toast.error("Ошибка при сохранении")
    }
    setLoading(false)
  }

  async function handleAddComment() {
    if (!newComment.trim() || !user) return

    const updated = [...quickComments, newComment.trim()]
    setQuickComments(updated)
    setNewComment("")

    const result = await saveQuickComments(updated)
    if (!result.success) {
      toast.error("Ошибка сохранения комментария")
      setQuickComments(quickComments) // revert
    }
  }

  async function handleRemoveComment(index: number) {
    if (!user) return

    const updated = quickComments.filter((_, i) => i !== index)
    setQuickComments(updated)

    const result = await saveQuickComments(updated)
    if (!result.success) {
      toast.error("Ошибка сохранения")
      setQuickComments(quickComments) // revert
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Настройки</h1>
        <p className="text-muted-foreground">
          Управление профилем и настройками
        </p>
      </div>

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Профиль</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-16 w-16 rounded-full bg-[#e6610d] flex items-center justify-center text-white text-lg font-bold overflow-hidden group shrink-0"
              disabled={avatarLoading}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Аватар" className="h-full w-full object-cover" />
              ) : (
                (fullName || user?.email || "U").charAt(0).toUpperCase()
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {avatarLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            <div>
              <p className="text-sm font-medium">Фото профиля</p>
              <p className="text-xs text-muted-foreground">Нажмите для загрузки</p>
            </div>
          </div>

          <Separator />

          <div>
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled className="mt-1.5" />
          </div>
          <div>
            <Label>ФИО</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label>Телефон</Label>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              required
              className="mt-1.5 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            />
          </div>
          {isIndividual && (
            <div>
              <Label>Адрес доставки</Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Город, улица, дом, квартира"
                className="mt-1.5"
              />
            </div>
          )}
          <Button onClick={handleSaveProfile} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Сохранить
          </Button>
        </CardContent>
      </Card>

      {/* Quick comments */}
      {!isIndividual && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Быстрые комментарии</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Сохранённые комментарии для быстрого выбора при оформлении заказа
            </p>

            {quickComments.length > 0 && (
              <div className="space-y-2">
                {quickComments.map((comment, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 bg-muted rounded-md"
                  >
                    <span className="text-sm flex-1">{comment}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveComment(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Новый комментарий"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
              />
              <Button variant="outline" onClick={handleAddComment}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
