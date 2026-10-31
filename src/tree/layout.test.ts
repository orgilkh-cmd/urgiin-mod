import { describe, expect, it } from 'vitest'
import { FamilyGraph } from '../kinship/graph'
import { sampleFamily } from '../sample/sampleFamily'
import { CARD_W, layoutTree, type TreeLayout } from './layout'

const graph = new FamilyGraph(sampleFamily())
const layout = (focus: string, ancestorDepth = 3, descendantDepth = 3) =>
  layoutTree(graph, focus, { ancestorDepth, descendantDepth })
const card = (l: TreeLayout, id: string) => l.cards.find((c) => c.id === id)

function expectNoOverlaps(l: TreeLayout) {
  const rows = Map.groupBy(l.cards, (c) => c.y)
  for (const cards of rows.values()) {
    const xs = cards.map((c) => c.x).sort((a, b) => a - b)
    for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(CARD_W)
  }
}

describe('hourglass layout', () => {
  it('puts the focus on row 0, parents above, father on the left', () => {
    const l = layout('Оргил')
    expect(card(l, 'Оргил')).toMatchObject({ y: 0, role: 'focus' })
    const bat = card(l, 'Бат')!
    const saraa = card(l, 'Сараа')!
    expect(bat.y).toBeLessThan(0)
    expect(bat.y).toBe(saraa.y)
    expect(bat.x).toBeLessThan(saraa.x)
    expect(bat.side).toBe('paternal')
    expect(card(l, 'Төмөр')?.side).toBe('maternal')
  })

  it('places older siblings left and younger right of the focus', () => {
    const l = layout('Оргил')
    const me = card(l, 'Оргил')!.x
    expect(card(l, 'Ганбат')!.x).toBeLessThan(me)
    expect(card(l, 'Сарнай')!.x).toBeGreaterThan(me)
    expect(card(l, 'Төгс')).toMatchObject({ role: 'sibling', y: 0 })
  })

  it('shows partners beside the focus and children below', () => {
    const l = layout('Оргил')
    expect(card(l, 'Номин')).toMatchObject({ role: 'partner', y: 0 })
    expect(card(l, 'Тэмүүжин')!.y).toBeGreaterThan(0)
    expect(card(l, 'Золзаяа')).toMatchObject({ role: 'partner' })
  })

  it('puts two wives on either side, each with her own children', () => {
    const l = layout('Бат')
    const bat = card(l, 'Бат')!.x
    const saraa = card(l, 'Сараа')!.x
    const dolgor = card(l, 'Долгор')!.x
    expect(Math.sign(saraa - bat)).toBe(-Math.sign(dolgor - bat))
    // Children groups follow the wives' order: Төгс on Долгор's side of Сараа's children.
    const tugs = card(l, 'Төгс')!.x
    for (const child of ['Ганбат', 'Оргил', 'Сарнай']) {
      expect(Math.sign(card(l, child)!.x - tugs)).toBe(Math.sign(saraa - dolgor))
    }
  })

  it('respects depth limits', () => {
    const l = layout('Оргил', 1, 1)
    expect(card(l, 'Бат')).toBeDefined()
    expect(card(l, 'Дорж')).toBeUndefined()
    expect(card(l, 'Тэмүүжин')).toBeDefined()
    expect(card(l, 'Билгүүн')).toBeUndefined()
  })

  it('never overlaps cards and shows each person once', () => {
    for (const focus of ['Оргил', 'Бат', 'Дорж', 'Тэмүүжин', 'Ганбаатар', 'Гадны']) {
      const l = layout(focus, 6, 5)
      expectNoOverlaps(l)
      expect(new Set(l.cards.map((c) => c.id)).size).toBe(l.cards.length)
    }
  })
})
