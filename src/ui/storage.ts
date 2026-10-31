import { useState } from 'react'

/** Per-viewer preference in localStorage; storage may be unavailable (private mode). */
export function useStored(key: string, initial: number): [number, (v: number) => void]
export function useStored(key: string, initial: boolean): [boolean, (v: boolean) => void]
/** A string choice; values not in `allowed` fall back to `initial`. */
export function useStored<T extends string>(key: string, initial: T, allowed: readonly T[]): [T, (v: T) => void]
export function useStored<T extends number | boolean | string>(key: string, initial: T, allowed?: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw === null) return initial
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== typeof initial) return initial
      return !allowed || allowed.includes(parsed as T) ? (parsed as T) : initial
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
