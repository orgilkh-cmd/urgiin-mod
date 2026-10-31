// Editing operations. Each runs in one transaction and keeps the stored edges consistent;
// "smart linking" (SPEC.md §2) lives here so the UI only says what the user meant.
import { markChanged } from './backup'
import type { FamilyDB } from './db'
import type { ID, ParentLink, Person, Union } from '../model/types'

export type NewPerson = Partial<Omit<Person, 'id' | 'createdAt' | 'updatedAt'>> & { givenName: string }

/** How the new or existing person relates to the anchor. */
export type Relative = 'parent' | 'spouse' | 'child' | 'sibling'

export interface RelativeOptions {
  /** Parent and child links: birth (default), adopted or step. */
  kind?: ParentLink['kind']
  /**
   * Child: the anchor's partner who is the other parent. Omitted → the only partner, if there is
   * exactly one; null → no other parent.
   */
  partnerId?: ID | null
  /** Spouse: union details. */
  union?: Partial<Omit<Union, 'id' | 'partnerIds'>>
  /** Sibling without birth years on both sides: older or younger than the anchor. */
  older?: boolean
}

export type Target = { existingId: ID } | { person: NewPerson }

const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

export function makePerson(fields: NewPerson): Person {
  const time = now()
  return { sex: 'U', isLiving: true, ...fields, id: newId(), createdAt: time, updatedAt: time }
}

const tables = (db: FamilyDB) => [db.persons, db.unions, db.parentLinks, db.settings]

export async function createPerson(db: FamilyDB, fields: NewPerson): Promise<ID> {
  const person = makePerson(fields)
  await db.persons.add(person)
  await markChanged(db)
  return person.id
}

export async function updatePerson(db: FamilyDB, id: ID, patch: Partial<Omit<Person, 'id' | 'createdAt'>>) {
  await db.persons.update(id, { ...patch, updatedAt: now() })
  await markChanged(db)
}

/** Gives several people the same ургийн овог at once. */
export async function setClan(db: FamilyDB, ids: ID[], clanName: string) {
  await db.transaction('rw', tables(db), async () => {
    const updatedAt = now()
    for (const id of ids) await db.persons.update(id, { clanName, updatedAt })
    await markChanged(db)
  })
}

/** Removes the person with every link and union they are part of. */
export async function deletePerson(db: FamilyDB, id: ID) {
  await db.transaction('rw', tables(db), async () => {
    const unions = await db.unions.where('partnerIds').equals(id).toArray()
    for (const u of unions) await deleteUnion(db, u.id)
    await db.parentLinks.where('childId').equals(id).delete()
    await db.parentLinks.where('parentId').equals(id).delete()
    await db.persons.delete(id)
    const home = await db.settings.get('homePersonId')
    if (home?.value === id) await db.settings.delete('homePersonId')
    await markChanged(db)
  })
}

/** Removes a union; children stay linked to both parents, just not to the union. */
export async function deleteUnion(db: FamilyDB, unionId: ID) {
  await db.transaction('rw', tables(db), async () => {
    await db.parentLinks.where('unionId').equals(unionId).modify((l) => {
      delete l.unionId
    })
    await db.unions.delete(unionId)
    await markChanged(db)
  })
}

export async function updateUnion(db: FamilyDB, unionId: ID, patch: Partial<Omit<Union, 'id' | 'partnerIds'>>) {
  await db.unions.update(unionId, patch)
  await markChanged(db)
}

export async function deleteParentLink(db: FamilyDB, linkId: ID) {
  await db.parentLinks.delete(linkId)
  await markChanged(db)
}

export async function updateParentLink(db: FamilyDB, linkId: ID, kind: ParentLink['kind']) {
  await db.parentLinks.update(linkId, { kind })
  await markChanged(db)
}

/** Creates (or picks) a person and links them to `anchor` as the given relative. Returns their id. */
export async function addRelative(
  db: FamilyDB,
  anchor: ID,
  relative: Relative,
  target: Target,
  options: RelativeOptions = {},
): Promise<ID> {
  return db.transaction('rw', tables(db), async () => {
    const id = 'existingId' in target ? target.existingId : await createPerson(db, target.person)
    if (id === anchor) throw new Error('A person cannot be their own relative')
    switch (relative) {
      case 'parent':
        await linkParent(db, anchor, id, options.kind ?? 'birth')
        break
      case 'spouse':
        await findOrCreateUnion(db, anchor, id, options.union)
        break
      case 'child':
        await linkChild(db, anchor, id, options)
        break
      case 'sibling':
        await linkSibling(db, anchor, id, options.older)
        break
    }
    await markChanged(db)
    return id
  })
}

async function unionsOf(db: FamilyDB, id: ID) {
  return db.unions.where('partnerIds').equals(id).toArray()
}

async function findOrCreateUnion(db: FamilyDB, a: ID, b: ID, fields: RelativeOptions['union'] = {}): Promise<ID> {
  const existing = (await unionsOf(db, a)).find((u) => (u.partnerIds as ID[]).includes(b))
  if (existing) return existing.id
  const order = Math.max((await unionsOf(db, a)).length, (await unionsOf(db, b)).length) + 1
  const union: Union = { id: newId(), partnerIds: [a, b], type: 'married', order, ...fields }
  await db.unions.add(union)
  return union.id
}

async function addLink(db: FamilyDB, link: Omit<ParentLink, 'id'>) {
  const existing = await db.parentLinks
    .where('childId')
    .equals(link.childId)
    .filter((l) => l.parentId === link.parentId)
    .first()
  if (existing) {
    if (link.unionId && !existing.unionId) await db.parentLinks.update(existing.id, { unionId: link.unionId })
    return
  }
  await db.parentLinks.add({ id: newId(), ...link })
}

const counted = (l: ParentLink) => l.kind !== 'step'

/**
 * Parent → child. When the child already has one other parent, the two are joined in a union, and
 * the child's full siblings through that parent (those with no second parent yet) get the new parent too.
 */
async function linkParent(db: FamilyDB, child: ID, parent: ID, kind: ParentLink['kind']) {
  const others = (await db.parentLinks.where('childId').equals(child).toArray()).filter(
    (l) => counted(l) && l.parentId !== parent,
  )
  const children = [child]
  let unionId: ID | undefined
  if (kind !== 'step' && others.length === 1) {
    const other = others[0]
    unionId = await findOrCreateUnion(db, other.parentId, parent)
    await db.parentLinks.update(other.id, { unionId })
    for (const l of await db.parentLinks.where('parentId').equals(other.parentId).toArray()) {
      if (l.childId === child || !counted(l) || l.unionId !== other.unionId) continue
      const theirParents = (await db.parentLinks.where('childId').equals(l.childId).toArray()).filter(counted)
      if (theirParents.length !== 1) continue
      await db.parentLinks.update(l.id, { unionId })
      children.push(l.childId)
    }
  }
  for (const c of children) await addLink(db, { childId: c, parentId: parent, kind: c === child ? kind : 'birth', unionId })

  // A father's name is the children's patronymic.
  const p = await db.persons.get(parent)
  if (p?.sex === 'M' && kind === 'birth') {
    for (const c of children) {
      const person = await db.persons.get(c)
      if (person && !person.patronymic) await updatePerson(db, c, { patronymic: p.givenName })
    }
  }
}

async function linkChild(db: FamilyDB, parent: ID, child: ID, options: RelativeOptions) {
  const kind = options.kind ?? 'birth'
  let partnerId = options.partnerId
  if (partnerId === undefined) {
    const partners = (await unionsOf(db, parent)).flatMap((u) => u.partnerIds.filter((p) => p !== parent))
    partnerId = new Set(partners).size === 1 ? partners[0] : null
  }
  const unionId = partnerId ? await findOrCreateUnion(db, parent, partnerId) : undefined
  await addLink(db, { childId: child, parentId: parent, kind, unionId })
  if (partnerId) await addLink(db, { childId: child, parentId: partnerId, kind, unionId })
}

/** Gives the sibling the anchor's (non-step) parents, and fixes the birth order when years are missing. */
async function linkSibling(db: FamilyDB, anchor: ID, sibling: ID, older?: boolean) {
  const parents = (await db.parentLinks.where('childId').equals(anchor).toArray()).filter(counted)
  if (!parents.length) throw new Error('Add a parent first: siblings are linked through parents')
  for (const l of parents) await addLink(db, { childId: sibling, parentId: l.parentId, kind: 'birth', unionId: l.unionId })

  const [a, s] = await Promise.all([db.persons.get(anchor), db.persons.get(sibling)])
  if (older === undefined || (a?.birth?.year != null && s?.birth?.year != null)) return
  const ids = new Set<ID>()
  for (const l of parents) {
    for (const c of await db.parentLinks.where('parentId').equals(l.parentId).toArray()) {
      if (counted(c) && c.childId !== sibling) ids.add(c.childId)
    }
  }
  const group = (await db.persons.bulkGet([...ids])).filter((p): p is Person => !!p)
  const key = (p: Person) => [p.birthOrder ?? Infinity, p.birth?.year ?? Infinity]
  group.sort((x, y) => key(x)[0] - key(y)[0] || key(x)[1] - key(y)[1])
  const at = group.findIndex((p) => p.id === anchor) + (older ? 0 : 1)
  const ordered = [...group.slice(0, at).map((p) => p.id), sibling, ...group.slice(at).map((p) => p.id)]
  for (const [i, id] of ordered.entries()) await db.persons.update(id, { birthOrder: i + 1 })
}
