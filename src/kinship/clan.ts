// Ургийн овог passes from father to children; a wife keeps her own. With no father recorded
// the child carries the mother's. Adoptive parents count after birth parents.
import type { ID } from '../model/types'
import type { FamilyGraph } from './graph'

/** The parent whose clan `childId` carries. */
export function clanSource(g: FamilyGraph, childId: ID): ID | undefined {
  const rank = (parentId: ID, kind: string) => (g.sex(parentId) === 'M' ? 0 : 2) + (kind === 'birth' ? 0 : 1)
  return g
    .parentLinks(childId)
    .filter((l) => l.kind !== 'step')
    .sort((a, b) => rank(a.parentId, a.kind) - rank(b.parentId, b.kind))[0]?.parentId
}

/** The clan `id` would carry from their parents, if any is recorded. */
export function inheritedClan(g: FamilyGraph, id: ID): string | undefined {
  const source = clanSource(g, id)
  return source ? g.person(source)?.clanName || undefined : undefined
}

export interface ClanPlan {
  /** People who will get the new clan. */
  apply: ID[]
  /** Descendants who already carry a different clan; changed only when in `include`. */
  conflicts: { id: ID; clan: string }[]
}

/**
 * Who follows when `rootId`'s clan changes from `from` to `to`: children who carry it, and theirs.
 * Empty clans and the old value follow; a different clan is a conflict and stops the walk there
 * unless the user includes that person.
 */
export function planClanChange(g: FamilyGraph, rootId: ID, from: string | undefined, to: string, include = new Set<ID>()): ClanPlan {
  const plan: ClanPlan = { apply: [], conflicts: [] }
  const seen = new Set<ID>([rootId])
  const walk = (parentId: ID, old: string | undefined) => {
    const children = [...new Set(g.childLinks(parentId).map((l) => l.childId))]
    for (const child of children) {
      if (seen.has(child) || clanSource(g, child) !== parentId) continue
      seen.add(child)
      const current = g.person(child)?.clanName || undefined
      if (current === to) {
        walk(child, current)
      } else if (!current || current === from || current === old) {
        plan.apply.push(child)
        walk(child, current)
      } else {
        plan.conflicts.push({ id: child, clan: current })
        if (include.has(child)) {
          plan.apply.push(child)
          walk(child, current)
        }
      }
    }
  }
  walk(rootId, from)
  return plan
}
