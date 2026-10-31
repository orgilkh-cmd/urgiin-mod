import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { exportFamily, importFamily, loadFamily, openFamilyDB } from './db'
import { sampleFamily } from '../sample/sampleFamily'

describe('family database', () => {
  it('round-trips through export and import', async () => {
    const source = openFamilyDB('test-source')
    const data = sampleFamily()
    await source.persons.bulkAdd(data.persons)
    await source.unions.bulkAdd(data.unions)
    await source.parentLinks.bulkAdd(data.parentLinks)
    await source.settings.put({ key: 'terms', value: { greatGrandfather: 'Буурал өвөө' } })

    const file = JSON.parse(JSON.stringify(await exportFamily(source)))

    const target = openFamilyDB('test-target')
    await target.persons.add({ ...data.persons[0], id: 'leftover' })
    await importFamily(target, file)

    const loaded = await loadFamily(target)
    expect(loaded.persons).toHaveLength(data.persons.length)
    expect(loaded.persons.find((p) => p.id === 'leftover')).toBeUndefined()
    expect(loaded.unions).toHaveLength(data.unions.length)
    expect(loaded.parentLinks).toHaveLength(data.parentLinks.length)
    expect(await target.settings.get('terms')).toEqual({ key: 'terms', value: { greatGrandfather: 'Буурал өвөө' } })
  })

  it('rejects files that are not exports', async () => {
    const db = openFamilyDB('test-bad')
    await expect(importFamily(db, { format: 'other' } as never)).rejects.toThrow()
  })

  it('finds unions by partner', async () => {
    const db = openFamilyDB('test-index')
    await db.unions.bulkAdd(sampleFamily().unions)
    const ofBat = await db.unions.where('partnerIds').equals('Бат').toArray()
    expect(ofBat).toHaveLength(2)
  })
})
