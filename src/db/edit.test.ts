import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { loadFamily, openFamilyDB } from './db'
import { addRelative, createPerson, deletePerson, deleteUnion } from './edit'
import { FamilyGraph } from '../kinship/graph'
import { Kinship } from '../kinship/kinship'

let n = 0
const fresh = () => openFamilyDB(`edit-${++n}`)

async function relate(db: ReturnType<typeof fresh>, from: string, to: string) {
  return new Kinship(new FamilyGraph(await loadFamily(db))).relate(from, to)?.term
}

describe('editing', () => {
  it('joins two parents in a union and gives full siblings the new parent', async () => {
    const db = fresh()
    const me = await createPerson(db, { givenName: 'Оргил', sex: 'M', birth: { year: 1980, qualifier: 'exact' } })
    const mom = await addRelative(db, me, 'parent', { person: { givenName: 'Сараа', sex: 'F' } })
    const sis = await addRelative(db, me, 'sibling', { person: { givenName: 'Номин', sex: 'F' } }, { older: true })
    const dad = await addRelative(db, me, 'parent', { person: { givenName: 'Бат', sex: 'M' } })

    const data = await loadFamily(db)
    expect(data.unions).toHaveLength(1)
    expect(data.unions[0].partnerIds).toEqual([mom, dad])
    expect(data.parentLinks.filter((l) => l.parentId === dad).map((l) => l.childId).sort()).toEqual([me, sis].sort())
    expect(data.parentLinks.every((l) => l.unionId === data.unions[0].id)).toBe(true)
    // Father's name became the patronymic.
    expect(data.persons.find((p) => p.id === sis)?.patronymic).toBe('Бат')
    expect(await relate(db, me, sis)).toBe('Эгч')
    expect(await relate(db, sis, me)).toBe('Эрэгтэй дүү')
  })

  it('links a child to the only partner, or to the chosen one', async () => {
    const db = fresh()
    const dad = await createPerson(db, { givenName: 'Бат', sex: 'M' })
    const w1 = await addRelative(db, dad, 'spouse', { person: { givenName: 'Сараа', sex: 'F' } })
    const kid1 = await addRelative(db, dad, 'child', { person: { givenName: 'Оргил', sex: 'M' } })
    const w2 = await addRelative(db, dad, 'spouse', { person: { givenName: 'Долгор', sex: 'F' } })
    const kid2 = await addRelative(db, dad, 'child', { person: { givenName: 'Төгс', sex: 'M' } }, { partnerId: w2 })
    const kid3 = await addRelative(db, dad, 'child', { person: { givenName: 'Ганц', sex: 'M' } })

    const data = await loadFamily(db)
    expect(data.unions.map((u) => u.order).sort()).toEqual([1, 2])
    const parentsOf = (c: string) => data.parentLinks.filter((l) => l.childId === c).map((l) => l.parentId).sort()
    expect(parentsOf(kid1)).toEqual([dad, w1].sort())
    expect(parentsOf(kid2)).toEqual([dad, w2].sort())
    // Two partners and none chosen → only the anchor.
    expect(parentsOf(kid3)).toEqual([dad])
    expect(await relate(db, kid1, kid2)).toMatch(/Эцэг нэгт/)
  })

  it('places a sibling by birth order when years are missing', async () => {
    const db = fresh()
    const me = await createPerson(db, { givenName: 'Оргил', sex: 'M' })
    await addRelative(db, me, 'parent', { person: { givenName: 'Бат', sex: 'M' } })
    const younger = await addRelative(db, me, 'sibling', { person: { givenName: 'Ганаа', sex: 'M' } }, { older: false })
    const older = await addRelative(db, me, 'sibling', { person: { givenName: 'Мөнхөө', sex: 'M' } }, { older: true })
    const middle = await addRelative(db, younger, 'sibling', { person: { givenName: 'Сод', sex: 'F' } }, { older: true })
    expect(await relate(db, me, younger)).toBe('Эрэгтэй дүү')
    expect(await relate(db, me, older)).toBe('Ах')
    expect(await relate(db, me, middle)).toBe('Эмэгтэй дүү')
    expect(await relate(db, younger, middle)).toBe('Эгч')
  })

  it('refuses a sibling without parents', async () => {
    const db = fresh()
    const me = await createPerson(db, { givenName: 'Оргил', sex: 'M' })
    await expect(addRelative(db, me, 'sibling', { person: { givenName: 'X' } })).rejects.toThrow(/parent/)
    expect(await db.persons.count()).toBe(1)
  })

  it('links an existing person instead of creating one', async () => {
    const db = fresh()
    const a = await createPerson(db, { givenName: 'Бат', sex: 'M' })
    const b = await createPerson(db, { givenName: 'Сараа', sex: 'F' })
    await addRelative(db, a, 'spouse', { existingId: b })
    await addRelative(db, a, 'spouse', { existingId: b })
    expect(await db.persons.count()).toBe(2)
    expect(await db.unions.count()).toBe(1)
  })

  it('deletes a person with their unions and links', async () => {
    const db = fresh()
    const dad = await createPerson(db, { givenName: 'Бат', sex: 'M' })
    const mom = await addRelative(db, dad, 'spouse', { person: { givenName: 'Сараа', sex: 'F' } })
    const kid = await addRelative(db, dad, 'child', { person: { givenName: 'Оргил', sex: 'M' } })
    await db.settings.put({ key: 'homePersonId', value: mom })
    await deletePerson(db, mom)

    const data = await loadFamily(db)
    expect(data.persons.map((p) => p.id).sort()).toEqual([dad, kid].sort())
    expect(data.unions).toHaveLength(0)
    expect(data.parentLinks).toEqual([expect.objectContaining({ childId: kid, parentId: dad })])
    expect(data.parentLinks[0].unionId).toBeUndefined()
    expect(await db.settings.get('homePersonId')).toBeUndefined()
  })

  it('keeps children linked when a union is removed', async () => {
    const db = fresh()
    const dad = await createPerson(db, { givenName: 'Бат', sex: 'M' })
    await addRelative(db, dad, 'spouse', { person: { givenName: 'Сараа', sex: 'F' } })
    await addRelative(db, dad, 'child', { person: { givenName: 'Оргил', sex: 'M' } })
    await deleteUnion(db, (await db.unions.toArray())[0].id)
    const links = await db.parentLinks.toArray()
    expect(links).toHaveLength(2)
    expect(links.every((l) => l.unionId === undefined)).toBe(true)
  })
})
