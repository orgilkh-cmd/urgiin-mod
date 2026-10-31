import type { FamilyData, ID, ParentLink, Person, Union } from '../model/types'

function push<T>(map: Map<ID, T[]>, key: ID, value: T) {
  const list = map.get(key)
  if (list) list.push(value)
  else map.set(key, [value])
}

/** Read-only index over the stored edges. */
export class FamilyGraph {
  private people = new Map<ID, Person>()
  private linksByChild = new Map<ID, ParentLink[]>()
  private linksByParent = new Map<ID, ParentLink[]>()
  private unionsByPerson = new Map<ID, Union[]>()

  constructor(data: FamilyData) {
    for (const p of data.persons) this.people.set(p.id, p)
    for (const l of data.parentLinks) {
      push(this.linksByChild, l.childId, l)
      push(this.linksByParent, l.parentId, l)
    }
    for (const u of data.unions) for (const id of u.partnerIds) push(this.unionsByPerson, id, u)
  }

  person(id: ID): Person | undefined {
    return this.people.get(id)
  }

  sex(id: ID) {
    return this.people.get(id)?.sex ?? 'U'
  }

  parentLinks(childId: ID): ParentLink[] {
    return this.linksByChild.get(childId) ?? []
  }

  childLinks(parentId: ID): ParentLink[] {
    return this.linksByParent.get(parentId) ?? []
  }

  /** Birth and adoptive parents — the links kinship terms are counted through. */
  parents(childId: ID): ID[] {
    return this.parentLinks(childId)
      .filter((l) => l.kind !== 'step')
      .map((l) => l.parentId)
  }

  partners(id: ID): { partnerId: ID; union: Union }[] {
    return (this.unionsByPerson.get(id) ?? []).flatMap((union) =>
      union.partnerIds.filter((p) => p !== id).map((partnerId) => ({ partnerId, union })),
    )
  }
}
