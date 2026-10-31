// Backup files: export to .json, restore from one, and when to remind about it.
import { exportFamily, importFamily, type FamilyDB, type FamilyExport } from './db'

/** Backup bookkeeping for this device: never exported, never imported. */
const DEVICE_KEYS = ['lastBackupAt', 'lastChangeAt']

const REMIND_AFTER_DAYS = 7
const DAY = 24 * 60 * 60 * 1000

export function backupFileName(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `urgiin-mod-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/**
 * Remind when there are changes the last backup doesn't have: right away if there was never
 * a backup, otherwise once that backup is a week old.
 */
export function backupDue(lastBackupAt: string | null, lastChangeAt: string | null, now: Date): boolean {
  if (!lastChangeAt) return false
  if (!lastBackupAt) return true
  return lastChangeAt > lastBackupAt && now.getTime() - Date.parse(lastBackupAt) >= REMIND_AFTER_DAYS * DAY
}

export async function markChanged(db: FamilyDB) {
  await db.settings.put({ key: 'lastChangeAt', value: new Date().toISOString() })
}

/** The export as a JSON file; records the backup time. */
export async function createBackup(db: FamilyDB, now = new Date()): Promise<File> {
  const file = await exportFamily(db)
  file.settings = file.settings.filter((s) => !DEVICE_KEYS.includes(s.key))
  await db.settings.put({ key: 'lastBackupAt', value: now.toISOString() })
  return new File([JSON.stringify(file, null, 1)], backupFileName(now), { type: 'application/json' })
}

/** Parses and checks a backup file's text. Throws a message fit to show the user. */
export function parseBackup(text: string): FamilyExport {
  let file: FamilyExport
  try {
    file = JSON.parse(text)
  } catch {
    throw new Error('Файл JSON биш байна.')
  }
  const d = file?.data
  if (file?.format !== 'family-tree' || !Array.isArray(d?.persons) || !Array.isArray(d.unions) || !Array.isArray(d.parentLinks)) {
    throw new Error('Энэ файл ургийн модны нөөц биш байна.')
  }
  if (!d.persons.every((p) => typeof p?.id === 'string' && typeof p.givenName === 'string')) {
    throw new Error('Файл гэмтсэн байна: хүний мэдээлэл дутуу.')
  }
  return { ...file, settings: Array.isArray(file.settings) ? file.settings : [] }
}

/** Replaces the family with the backup's; keeps who "Би" is on this device if they are in it. */
export async function restoreBackup(db: FamilyDB, file: FamilyExport) {
  await db.transaction('rw', [db.persons, db.unions, db.parentLinks, db.settings], async () => {
    const home = (await db.settings.get('homePersonId'))?.value
    const fileHome = file.settings.find((s) => s.key === 'homePersonId')?.value
    const settings = file.settings.filter((s) => s.key !== 'homePersonId' && !DEVICE_KEYS.includes(s.key))
    await importFamily(db, { ...file, settings })
    const keep = [home, fileHome].find((id) => file.data.persons.some((p) => p.id === id))
    if (keep) await db.settings.put({ key: 'homePersonId', value: keep })
    // The file itself is a backup of what is now on the device.
    await db.settings.put({ key: 'lastBackupAt', value: new Date().toISOString() })
  })
}
