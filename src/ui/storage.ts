import { useState } from 'react'

/** Per-viewer preference in localStorage; storage may be unavailable (private mode). */
export function useStored(key: string, initial: number): [number, (v: number) => void]
export function useStored(key: string, initial: boolean): [boolean, (v: boolean) => void]
export function useStored<T extends number | boolean>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      const parsed: unknown = JSON.parse(raw)
      return typeof parsed === typeof initial ? (parsed as T) : initial
    } catch {
      return initial
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, JSON.stringify(v))
    } catch {
      // Not persisted; fine for a preference.
    }
  }
  return [value, set]
}
