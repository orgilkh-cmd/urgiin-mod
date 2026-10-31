// Hourglass layout around a focus person:
//   rows above  — ancestors (father's side left, mother's side right)
//   row 0       — older siblings · focus with partners · younger siblings
//   rows below  — descendants, each with their partners; children grouped per union
import type { FamilyGraph } from '../kinship/graph'
import { compareAge } from '../kinship/kinship'
import type { ID } from '../model/types'

export const CARD_W = 168
export const CARD_H = 96
const GAP_X = 20
const GAP_Y = 72
const ROW_H = CARD_H + GAP_Y
const PITCH = CARD_W + GAP_X
/** Vertical spacing between the child bars of different unions. */
const BAR_STAGGER = 14

export type Role = 'focus' | 'partner' | 'sibling' | 'ancestor' | 'descendant'
export type Side = 'paternal' | 'maternal'
export type Point = [number, number]

export interface PlacedCard {
  id: ID
  /** Top-left corner. */
  x: number
  y: number
  role: Role
  side?: Side
}

export interface TreeLayout {
  cards: PlacedCard[]
  /** Connector polylines. */
  lines: Point[][]
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

export interface LayoutOptions {
  ancestorDepth: number
  descendantDepth: number
}

interface DescUnit {
  id: ID
  /** Person and partners, left to right. */
  cards: ID[]
  groups: { partner?: ID; children: DescUnit[]; width: number }[]
  width: number
}

interface AncUnit {
  id: ID
  parents: AncUnit[]
  width: number
}

const rowWidth = (n: number) => n * CARD_W + Math.max(0, n - 1) * GAP_X
const sumWidth = (widths: number[]) => widths.reduce((a, b) => a + b, 0) + Math.max(0, widths.length - 1) * GAP_X
const top = (row: number) => row * ROW_H

export function layoutTree(graph: FamilyGraph, focus: ID, options: LayoutOptions): TreeLayout {
  return new HourglassLayout(graph, options).run(focus)
}

class HourglassLayout {
  private g: FamilyGraph
  private opts: LayoutOptions
  private cards: PlacedCard[] = []
  private lines: Point[][] = []
  private placed = new Set<ID>()
  private descSeen = new Set<ID>()
  private ancSeen = new Set<ID>()

  constructor(graph: FamilyGraph, options: LayoutOptions) {
    this.g = graph
    this.opts = options
  }

  run(focus: ID): TreeLayout {
    const focusCx = this.placeDesc(this.measureDesc(focus, 0), 0, 0, 'focus')
    const siblingCxs = this.placeSiblings(focus)
    this.placeParents(this.measureAnc(focus, 0), focusCx, 0, [focusCx, ...siblingCxs])

    const xs = this.cards.map((c) => c.x)
    const ys = this.cards.map((c) => c.y)
    return {
      cards: this.cards,
      lines: this.lines,
      bounds: {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs) + CARD_W,
        maxY: Math.max(...ys) + CARD_H,
      },
    }
  }

  private add(id: ID, cx: number, row: number, role: Role, side?: Side) {
    if (this.placed.has(id)) return
    this.placed.add(id)
    this.cards.push({ id, x: cx - CARD_W / 2, y: top(row), role, ...(side && { side }) })
  }

  /**
   * Line from a parent (or couple) down to a bar, then down to each child.
   * `barOffset` moves the bar up or down so several unions' bars don't merge into one.
   */
  private connect(dropX: number, dropY: number, childRow: number, childCxs: number[], barOffset = 0) {
    const barY = top(childRow) - GAP_Y / 2 + barOffset
    this.lines.push([[dropX, dropY], [dropX, barY]])
    this.lines.push([[Math.min(dropX, ...childCxs), barY], [Math.max(dropX, ...childCxs), barY]])
    for (const cx of childCxs) this.lines.push([[cx, barY], [cx, top(childRow)]])
  }

  private byAge = (a: ID, b: ID) => {
    const r = compareAge(this.g.person(a), this.g.person(b))
    return r === 'older' ? -1 : r === 'younger' ? 1 : 0
  }

  private partnersOf(id: ID): ID[] {
    const sorted = [...this.g.partners(id)].sort(
      (a, b) =>
        (a.union.order ?? 99) - (b.union.order ?? 99) ||
        (a.union.start?.year ?? 9999) - (b.union.start?.year ?? 9999),
    )
    return [...new Set(sorted.map((x) => x.partnerId))]
  }

  /** Birth and adoptive parents, father first. */
  private parentsOf(id: ID): ID[] {
    return [...new Set(this.g.parents(id))].sort(
      (a, b) => Number(this.g.sex(a) === 'F') - Number(this.g.sex(b) === 'F'),
    )
  }

  // ── Descendants ────────────────────────────────────────

  private measureDesc(id: ID, depth: number): DescUnit {
    this.descSeen.add(id)
    const partners = this.partnersOf(id).filter((p) => !this.descSeen.has(p))
    for (const p of partners) this.descSeen.add(p)

    // 1st partner to the right, 2nd to the left, 3rd further right…
    const left: ID[] = []
    const right: ID[] = []
    partners.forEach((p, i) => (i % 2 === 0 ? right : left).push(p))
    const cards = [...left.reverse(), id, ...right]

    const groups: DescUnit['groups'] = []
    if (depth < this.opts.descendantDepth) {
      const byPartner = new Map<ID | undefined, ID[]>()
      for (const { childId } of this.g.childLinks(id)) {
        if (this.descSeen.has(childId)) continue
        this.descSeen.add(childId)
        const otherParents = this.g.parentLinks(childId).map((l) => l.parentId)
        const partner = cards.find((c) => c !== id && otherParents.includes(c))
        byPartner.set(partner, [...(byPartner.get(partner) ?? []), childId])
      }
      const position = (partner?: ID) => cards.indexOf(partner ?? id)
      for (const [partner, kids] of [...byPartner].sort((a, b) => position(a[0]) - position(b[0]))) {
        const children = kids.sort(this.byAge).map((k) => this.measureDesc(k, depth + 1))
        groups.push({ partner, children, width: sumWidth(children.map((c) => c.width)) })
      }
    }

    const width = Math.max(rowWidth(cards.length), sumWidth(groups.map((g) => g.width)))
    return { id, cards, groups, width }
  }

  /** Places a unit inside [left, left + width]; returns the person's center x. */
  private placeDesc(u: DescUnit, left: number, row: number, role: Role): number {
    const cardsLeft = left + (u.width - rowWidth(u.cards.length)) / 2
    const cxAt = (i: number) => cardsLeft + i * PITCH + CARD_W / 2
    const personCx = cxAt(u.cards.indexOf(u.id))
    const midY = top(row) + CARD_H / 2

    u.cards.forEach((id, i) => {
      this.add(id, cxAt(i), row, id === u.id ? role : 'partner')
      if (id !== u.id) {
        const s = Math.sign(cxAt(i) - personCx)
        this.lines.push([[personCx + (s * CARD_W) / 2, midY], [cxAt(i) - (s * CARD_W) / 2, midY]])
      }
    })

    let cursor = left + (u.width - sumWidth(u.groups.map((g) => g.width))) / 2
    u.groups.forEach((group, i) => {
      const childCxs = group.children.map((child) => {
        const cx = this.placeDesc(child, cursor, row + 1, 'descendant')
        cursor += child.width + GAP_X
        return cx
      })
      const barOffset = (i - (u.groups.length - 1) / 2) * BAR_STAGGER
      if (group.partner) {
        // Drop from the gap next to the partner, on the person's side.
        const pcx = cxAt(u.cards.indexOf(group.partner))
        this.connect(pcx - (Math.sign(pcx - personCx) * PITCH) / 2, midY, row + 1, childCxs, barOffset)
      } else {
        this.connect(personCx, top(row) + CARD_H, row + 1, childCxs, barOffset)
      }
    })
    return personCx
  }

  // ── Siblings ───────────────────────────────────────────

  /** Older siblings to the left of the focus row, younger (and unknown) to the right. */
  private placeSiblings(focus: ID): number[] {
    const siblings = [
      ...new Set(
        this.parentsOf(focus).flatMap((p) =>
          this.g.childLinks(p).filter((l) => l.kind !== 'step').map((l) => l.childId),
        ),
      ),
    ].filter((s) => !this.placed.has(s))
    const older = siblings
      .filter((s) => compareAge(this.g.person(s), this.g.person(focus)) === 'older')
      .sort(this.byAge)
    const younger = siblings.filter((s) => !older.includes(s)).sort(this.byAge)

    const row0 = this.cards.filter((c) => c.y === 0)
    const minX = Math.min(...row0.map((c) => c.x))
    const maxX = Math.max(...row0.map((c) => c.x)) + CARD_W
    const cxs: number[] = []
    older.reverse().forEach((s, i) => {
      const cx = minX - GAP_X - CARD_W / 2 - i * PITCH
      this.add(s, cx, 0, 'sibling')
      cxs.push(cx)
    })
    younger.forEach((s, i) => {
      const cx = maxX + GAP_X + CARD_W / 2 + i * PITCH
      this.add(s, cx, 0, 'sibling')
      cxs.push(cx)
    })
    return cxs
  }

  // ── Ancestors ──────────────────────────────────────────

  private measureAnc(id: ID, depth: number): AncUnit {
    this.ancSeen.add(id)
    const parents: AncUnit[] = []
    if (depth < this.opts.ancestorDepth) {
      for (const p of this.parentsOf(id)) {
        if (!this.ancSeen.has(p)) parents.push(this.measureAnc(p, depth + 1))
      }
    }
    return { id, parents, width: Math.max(CARD_W, sumWidth(parents.map((p) => p.width))) }
  }

  /** Places `u`'s parents centered above `childCx`, connected to every center in `members`. */
  private placeParents(u: AncUnit, childCx: number, childRow: number, members: number[], side?: Side) {
    if (!u.parents.length) return
    const row = childRow - 1
    let cursor = childCx - sumWidth(u.parents.map((p) => p.width)) / 2
    const cxs = u.parents.map((p) => {
      const cx = cursor + p.width / 2
      cursor += p.width + GAP_X
      const s = side ?? (this.g.sex(p.id) === 'F' ? 'maternal' : 'paternal')
      this.add(p.id, cx, row, 'ancestor', s)
      this.placeParents(p, cx, row, [cx], s)
      return cx
    })

    const first = cxs[0]
    const last = cxs[cxs.length - 1]
    if (cxs.length > 1) {
      const midY = top(row) + CARD_H / 2
      this.lines.push([[first + CARD_W / 2, midY], [last - CARD_W / 2, midY]])
      this.connect((first + last) / 2, midY, childRow, members)
    } else {
      this.connect(first, top(row) + CARD_H, childRow, members)
    }
  }
}
