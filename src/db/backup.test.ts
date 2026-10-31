import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { backupDue, backupFileName, createBackup, parseBackup, restoreBackup } from './backup'
import { loadFamily, openFamilyDB } from './db'
import { sampleFamily } from '../sample/sampleFamily'

const at = (s: string) => new Date(s)

describe('backup reminder', () => {
  it('stays quiet with no changes', () => {
    expect(backupDue(null, null, at('2026-01-01'))).toBe(false)
  })
  it('reminds right away when there was never a backup', () => {
    expect(backupDue(null, '2026-01-01T10:00:00Z', at('2026-01-01T10:01:00Z'))).toBe(true)
  })
  it('reminds once the last backup is a week old and something changed since', () => {
    const backup = '2026-01-01T00:00:00.000Z'
    expect(backupDue(backup, '2026-01-02T00:00:00.000Z', at('2026-01-05'))).toBe(false)
    expect(backupDue(backup, '2026-01-02T00:00:00.000Z', at('2026-01-09'))).toBe(true)
    expect(backupDue(backup, '2025-12-31T00:00:00.000Z', at('2026-03-01'))).toBe(false)
  })
})

describe('backup files', () => {
  it('names files by date', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('urgiin-mod-2026-10-03.json')
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow(/JSON/)
    expect(() => parseBackup('{"format":"other"}')).toThrow(/нөөц биш/)
    expect(() => parseBackup('{"format":"family-tree","data":{"persons":[{}],"unions":[],"parentLinks":[]}}')).toThrow(/гэмтсэн/)
  })

  it('round-trips, keeping who "Би" is on each device', async () => {
    const dad = openFamilyDB('backup-dad')
    const data = sampleFamily()
    await dad.persons.bulkAdd(data.persons)
    await dad.unions.bulkAdd(data.unions)
    await dad.parentLinks.bulkAdd(data.parentLinks)
    await dad.settings.bulkPut([
      { key: 'homePersonId', value: 'Оргил' },
      { key: 'terms', value: { wife: 'Гэргий' } },
    ])
    const file = await createBackup(dad, new Date(2026, 0, 2))
    expect(file.name).toBe('urgiin-mod-2026-01-02.json')
    expect(await dad.settings.get('lastBackupAt')).toBeDefined()

    const son = openFamilyDB('backup-son')
    await son.settings.put({ key: 'homePersonId', value: 'Тэмүүжин' })
    await restoreBackup(son, parseBackup(await file.text()))

    expect((await loadFamily(son)).persons).toHaveLength(data.persons.length)
    expect((await son.settings.get('homePersonId'))?.value).toBe('Тэмүүжин')
    expect((await son.settings.get('terms'))?.value).toEqual({ wife: 'Гэргий' })

    // A new device takes "Би" from the file.
    const fresh = openFamilyDB('backup-new')
    await restoreBackup(fresh, parseBackup(await file.text()))
    expect((await fresh.settings.get('homePersonId'))?.value).toBe('Оргил')
  })
})
