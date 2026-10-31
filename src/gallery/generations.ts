import type { FamilyGraph } from '../kinship/graph'
import type { ID } from '../model/types'

/**
 * Generation of everyone reachable from `focus`: +1 per parent step, −1 per child step,
 * same for a spouse. Step links count too, so step-parents land with the parents.
 */
export function generations(g: FamilyGraph, focus: ID): Map<ID, number> {
  const gen = new Map<ID, number>([[focus, 0]])
  const queue = [focus]
  const visit = (id: ID, value: number) => {
    if (gen.has(id) || !g.person(id)) return
    gen.set(id, value)
    queue.push(id)
  }
  while (queue.length) {
    const id = queue.shift()!
    const value = gen.get(id)!
    for (const l of g.parentLinks(id)) visit(l.parentId, value + 1)
    for (const l of g.childLinks(id)) visit(l.childId, value - 1)
    for (const { partnerId } of g.partners(id)) visit(partnerId, value)
  }
  return gen
}

const UP = ['', 'Эцэг эхийн үе', 'Өвөө эмээгийн үе', 'Элэнц өвөөгийн үе', 'Хуланц өвөөгийн үе', 'Өндөр өвөөгийн үе']
const DOWN = ['Өөрийн үе', 'Хүүхдийн үе', 'Ач зээгийн үе', 'Жич, зээнцэрийн үе']

export function generationTitle(gen: number): string {
  if (gen > 0) return UP[gen] ?? `${gen} үе дээш`
  return DOWN[-gen] ?? `${-gen} үе доош`
}
