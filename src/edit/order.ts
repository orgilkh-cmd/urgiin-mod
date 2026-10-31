import { byBirth } from '../kinship/kinship'
import type { FamilyData, ID, Person } from '../model/types'

/** Children of any of these parents (birth and adopted), oldest first. */
export function childrenOf(data: FamilyData, parentIds: ID[]): Person[] {
  const ids = new Set(
    data.parentLinks.filter((l) => l.kind !== 'step' && parentIds.includes(l.parentId)).map((l) => l.childId),
  )
  return data.persons.filter((p) => ids.has(p.id)).sort(byBirth)
}

/** The birth and adoptive parents whose children `id` is ordered among. */
export const parentIdsOf = (data: FamilyData, id: ID): ID[] =>
  data.parentLinks.filter((l) => l.childId === id && l.kind !== 'step').map((l) => l.parentId)
