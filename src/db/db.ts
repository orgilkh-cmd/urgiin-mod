import Dexie, { type EntityTable } from 'dexie'
import type { FamilyData, ID, ParentLink, Person, Union } from '../model/types'

/** A small square JPEG as a data URL (~20–40 KB), so it goes into backups as is. */
export interface Photo {
  id: ID
  dataUrl: string
}

/** Key/value settings, e.g. `terms` → user overrides of kinship words. */
export interface Setting {
  key: string
  value: unknown
}

export type FamilyDB = Dexie & {
  persons: EntityTable<Person, 'id'>
  unions: EntityTable<Union, 'id'>
  parentLinks: EntityTable<ParentLink, 'id'>
  photos: EntityTable<Photo, 'id'>
  settings: EntityTable<Setting, 'key'>
}

export function openFamilyDB(name = 'family-tree'): FamilyDB {
  const db = new Dexie(name) as FamilyDB
  db.version(1).stores({
    persons: 'id, givenName',
    unions: 'id, *partnerIds',
    parentLinks: 'id, childId, parentId, unionId',
    photos: 'id',
    settings: 'key',
  })
  return db
}

export async function loadFamily(db: FamilyDB): Promise<FamilyData> {
  const [persons, unions, parentLinks] = await Promise.all([
    db.persons.toArray(),
    db.unions.toArray(),
    db.parentLinks.toArray(),
  ])
  return { persons, unions, parentLinks }
}

export const EXPORT_FORMAT = 'family-tree'
export const EXPORT_VERSION = 1

export interface FamilyExport {
  format: typeof EXPORT_FORMAT
  version: number
  exportedAt: string
  data: FamilyData
  settings: Setting[]
  /** Missing in files from before photos existed. */
  photos?: Photo[]
}

export async function exportFamily(db: FamilyDB): Promise<FamilyExport> {
  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    data: await loadFamily(db),
    settings: await db.settings.toArray(),
    photos: await db.photos.toArray(),
  }
}

/** Replaces everything in the database with the export's contents. */
export async function importFamily(db: FamilyDB, file: FamilyExport): Promise<void> {
  if (file.format !== EXPORT_FORMAT) throw new Error('Not a family-tree export file')
  if (file.version > EXPORT_VERSION) throw new Error(`Export version ${file.version} is newer than this app`)
  await db.transaction('rw', [db.persons, db.unions, db.parentLinks, db.photos, db.settings], async () => {
    await Promise.all([db.persons.clear(), db.unions.clear(), db.parentLinks.clear(), db.photos.clear(), db.settings.clear()])
    await db.persons.bulkAdd(file.data.persons)
    await db.unions.bulkAdd(file.data.unions)
    await db.parentLinks.bulkAdd(file.data.parentLinks)
    await db.photos.bulkAdd(file.photos ?? [])
    await db.settings.bulkAdd(file.settings)
  })
}
