import { describe, expect, it } from 'vitest'
import { FamilyGraph } from '../kinship/graph'
import { sampleFamily } from '../sample/sampleFamily'
import { CARD_W, layoutTree, type TreeLayout } from './layout'

const graph = new FamilyGraph(sampleFamily())
const layout = (focus: string, ancestorDepth = 3, descendantDepth = 3, collateral = 0) =>
  layoutTree(graph, focus, { ancestorDepth, descendantDepth, collateral })
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

  it('puts spouses under their partner and children below both', () => {
    const l = layout('Оргил')
    const me = card(l, 'Оргил')!
    const wife = card(l, 'Номин')!
    expect(wife).toMatchObject({ role: 'partner', x: me.x })
    expect(wife.y).toBeGreaterThan(0)
    expect(card(l, 'Тэмүүжин')!.y).toBeGreaterThan(wife.y)
    expect(card(l, 'Золзаяа')).toMatchObject({ role: 'partner', x: card(l, 'Тэмүүжин')!.x })
  })

  it("lines siblings up on the focus's row with their spouses under them", () => {
    const l = layout('Оргил')
    expect(card(l, 'Ганбат')!.y).toBe(0)
    expect(card(l, 'Ундрах')).toMatchObject({ role: 'partner', x: card(l, 'Ганбат')!.x, y: card(l, 'Номин')!.y })
    // The direct view leaves siblings' children out.
    expect(card(l, 'Ариун')).toBeUndefined()
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

  it('shows ancestors only in the direct view', () => {
    const l = layout('Оргил')
    for (const id of ['Ганаа', 'Нараа', 'Лхагва', 'Ариун']) expect(card(l, id)).toBeUndefined()
  })

  it('adds siblings of parents and grandparents with their families', () => {
    const l = layout('Оргил', 3, 3, 2)
    const y = (id: string) => card(l, id)!.y
    const x = (id: string) => card(l, id)!.x
    // Father's siblings to the left of him, mother's to the right of her.
    expect(y('Ганаа')).toBe(y('Бат'))
    expect(x('Ганаа')).toBeLessThan(x('Бат'))
    expect(x('Нараа')).toBeGreaterThan(x('Сараа'))
    // Cousin and their child, on the rows below.
    expect(y('Бямба')).toBe(0)
    expect(y('Түвшин')).toBeGreaterThan(0)
    // Grandfather's brother and his line, further out than the father's siblings.
    expect(y('Лхагва')).toBe(y('Дорж'))
    expect(x('Лхагва')).toBeLessThan(x('Ганаа'))
    expect(y('Цогт')).toBe(0)
    // Siblings' children.
    expect(card(l, 'Ариун')).toBeDefined()
  })

  it('stops at the chosen number of generations', () => {
    const l = layout('Оргил', 3, 3, 1)
    expect(card(l, 'Ганаа')).toBeDefined()
    expect(card(l, 'Лхагва')).toBeUndefined()
  })

  it('never overlaps cards in the expanded views', () => {
    for (const focus of ['Оргил', 'Бат', 'Дорж', 'Тэмүүжин', 'Цогт', 'Түвшин', 'Сувд']) {
      for (const collateral of [1, 2, 99]) {
        const l = layout(focus, 99, 99, collateral)
        expectNoOverlaps(l)
        expect(new Set(l.cards.map((c) => c.id)).size).toBe(l.cards.length)
      }
    }
  })

  it('reaches every blood relative in the full view', () => {
    const l = layout('Цогт', 99, 99, 99)
    for (const id of ['Жаргал', 'Оргил', 'Энх', 'Цолмон', 'Түвшин', 'Төгс', 'Сараа']) expect(card(l, id)).toBeDefined()
  })
})
