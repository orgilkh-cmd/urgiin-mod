import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { loadFamily, openFamilyDB } from './db'
import type { FamilyData } from '../model/types'
import { sampleFamily } from '../sample/sampleFamily'

export const db = openFamilyDB()

/** Live family data; undefined while loading. */
export function useFamily(): FamilyData | undefined {
  return useLiveQuery(() => loadFamily(db))
}

/** Live photo id → image URL. */
export function usePhotos(): Map<string, string> {
  const photos = useLiveQuery(() => db.photos.toArray())
  return useMemo(() => new Map((photos ?? []).map((p) => [p.id, p.dataUrl])), [photos])
}

/** Live setting value: undefined while loading, null when not set. */
export function useSetting<T>(key: string): T | null | undefined {
  return useLiveQuery(() => db.settings.get(key).then((s) => (s ? (s.value as T) : null)), [key])
}

export function saveSetting(key: string, value: unknown) {
  return db.settings.put({ key, value })
}

export async function loadSampleFamily() {
  const data = sampleFamily()
  await db.transaction('rw', [db.persons, db.unions, db.parentLinks, db.settings], async () => {
    await db.persons.bulkPut(data.persons)
    await db.unions.bulkPut(data.unions)
    await db.parentLinks.bulkPut(data.parentLinks)
    await db.settings.bulkPut([
      { key: 'homePersonId', value: 'Оргил' },
      { key: 'sampleLoaded', value: true },
    ])
  })
}

/** Deletes every person, union, link and setting. */
export async function clearAllData() {
  await db.transaction('rw', [db.persons, db.unions, db.parentLinks, db.photos, db.settings], async () => {
    await Promise.all([db.persons.clear(), db.unions.clear(), db.parentLinks.clear(), db.photos.clear(), db.settings.clear()])
  })
}
