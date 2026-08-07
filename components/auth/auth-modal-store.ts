"use client"

import { useSyncExternalStore } from "react"

export type AuthView = "login" | "register" | "forgot"

interface AuthModalState {
  open: boolean
  view: AuthView
}

let state: AuthModalState = { open: false, view: "login" }
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): AuthModalState {
  return state
}

function syncUrl(mutate: (params: URLSearchParams) => void) {
  if (typeof window === "undefined") return
  const url = new URL(window.location.href)
  mutate(url.searchParams)
  const qs = url.searchParams.toString()
  window.history.replaceState(null, "", url.pathname + (qs ? `?${qs}` : ""))
}

export function openAuthModal(view: AuthView = "login") {
  state = { open: true, view }
  emit()
  syncUrl((params) => params.set("auth", view))
}

export function closeAuthModal() {
  if (!state.open) return
  state = { ...state, open: false }
  emit()
  syncUrl((params) => params.delete("auth"))
}

export function useAuthModalStore(): AuthModalState {
  return useSyncExternalStore(subscribe, getSnapshot)
}
