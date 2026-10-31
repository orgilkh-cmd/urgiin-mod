import type { ID, Person, Sex, Union } from '../model/types'
import type { FamilyGraph } from './graph'
import { genitivePhrase, mnPlain, mnTerms, type Terms } from './terms.mn'

export type Age = 'older' | 'younger' | 'unknown'

/** Is `a` older or younger than `b`? Birth date first, then manual birth order. */
export function compareAge(a?: Person, b?: Person): Age {
  if (!a || !b) return 'unknown'
  const da = a.birth
  const db = b.birth
  if (da?.year != null && db?.year != null) {
    if (da.year !== db.year) return da.year < db.year ? 'older' : 'younger'
    if (da.month != null && db.month != null && da.month !== db.month) {
      return da.month < db.month ? 'older' : 'younger'
    }
    if (da.month === db.month && da.day != null && db.day != null && da.day !== db.day) {
      return da.day < db.day ? 'older' : 'younger'
    }
  }
  if (a.birthOrder != null && b.birthOrder != null && a.birthOrder !== b.birthOrder) {
    return a.birthOrder < b.birthOrder ? 'older' : 'younger'
  }
  return 'unknown'
}

/** Sort comparator, oldest first: birth date, then birth order, then the order they were entered. */
export function byBirth(a: Person, b: Person): number {
  const age = compareAge(a, b)
  if (age !== 'unknown') return age === 'older' ? -1 : 1
  return (a.birthOrder ?? Infinity) - (b.birthOrder ?? Infinity) || a.createdAt.localeCompare(b.createdAt)
}

/** Shortest blood path: `up` steps from the focus to the common ancestor, then `down` to the target. */
interface BloodPath {
  up: number
  down: number
  /** focus … common ancestor */
  fPath: ID[]
  /** common ancestor … target */
  pPath: ID[]
}

/** Phrases joined by spaces, e.g. ['Аавын', 'үеэлийн', 'хүү']. */
type Phrases = string[]

export interface Relation {
  kind: 'self' | 'spouse' | 'blood' | 'step' | 'inLaw'
  /** Badge text, e.g. "Нагац өвөө". */
  term: string
  /** Literal path, e.g. "Ахын охин", when it says more than the term. */
  hint?: string
  up?: number
  down?: number
}

const pick = (sex: Sex, male: string, female: string, unknown: string) =>
  sex === 'M' ? male : sex === 'F' ? female : unknown

const wordCount = (p: Phrases) => p.join(' ').split(' ').length

function sentence(p: Phrases): string {
  const s = p.join(' ').toLowerCase()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** owner's …: possessive(['Авга ах'], 'эхнэр') → ['Авга ахын', 'эхнэр']. */
const possessive = (owner: Phrases, ...rest: string[]): Phrases => [
  ...owner.slice(0, -1),
  genitivePhrase(owner[owner.length - 1]),
  ...rest,
]

const isFormer = (u: Union) => u.endReason === 'divorce' || u.endReason === 'separation'

export class Kinship {
  private g: FamilyGraph
  private t: Terms
  private ancestorCache = new Map<ID, Map<ID, ID[]>>()
  private describeCache = new Map<string, Phrases | null>()

  constructor(graph: FamilyGraph, terms: Terms = mnTerms) {
    this.g = graph
    this.t = terms
  }

  /** How `target` is related to `focus`, or null if not connected. */
  relate(focus: ID, target: ID): Relation | null {
    if (focus === target) return { kind: 'self', term: this.t.self }

    const spouse = this.g.partners(focus).find((x) => x.partnerId === target)
    if (spouse) {
      const word = pick(this.g.sex(target), this.t.husband, this.t.wife, this.t.partner)
      return this.result('spouse', isFormer(spouse.union) ? [this.t.formerPrefix, word] : [word])
    }

    const r = this.blood(focus, target)
    if (r) {
      const fixed = this.bloodTerm(focus, target, r)
      const term = fixed?.phrases ?? this.describe(focus, target)
      if (term) return this.result('blood', term, this.plainBlood(r), r)
    }

    return this.stepRelation(focus, target) ?? this.inLaw(focus, target)
  }

  /** Relations of everyone in `ids` to the focus person — what the tree view needs. */
  relateAll(focus: ID, ids: Iterable<ID>): Map<ID, Relation | null> {
    const out = new Map<ID, Relation | null>()
    for (const id of ids) out.set(id, this.relate(focus, id))
    return out
  }

  // ── Blood ──────────────────────────────────────────────

  private ancestors(id: ID): Map<ID, ID[]> {
    let paths = this.ancestorCache.get(id)
    if (paths) return paths
    paths = new Map([[id, [id]]])
    const queue = [id]
    for (let cur = queue.shift(); cur !== undefined; cur = queue.shift()) {
      for (const parent of this.g.parents(cur)) {
        if (!paths.has(parent)) {
          paths.set(parent, [...paths.get(cur)!, parent])
          queue.push(parent)
        }
      }
    }
    this.ancestorCache.set(id, paths)
    return paths
  }

  private blood(focus: ID, target: ID): BloodPath | null {
    const targetAncestors = this.ancestors(target)
    let best: BloodPath | null = null
    for (const [ancestor, fPath] of this.ancestors(focus)) {
      const pUp = targetAncestors.get(ancestor)
      if (!pUp) continue
      const up = fPath.length - 1
      const down = pUp.length - 1
      const better =
        !best || up + down < best.up + best.down || (up + down === best.up + best.down && up < best.up)
      if (better) best = { up, down, fPath, pPath: [...pUp].reverse() }
    }
    return best
  }

  /** A named term, or null. `generic` terms ("Ах дүүгийн хүүхэд") are not used inside longer descriptions. */
  private bloodTerm(focus: ID, target: ID, r: BloodPath): { phrases: Phrases; generic: boolean } | null {
    const t = this.t
    const sex = this.g.sex(target)
    const fixed = (s: string | null) => (s === null ? null : { phrases: [s], generic: false })

    if (r.up === 0 && r.down === 0) return null
    if (r.down === 0) return fixed(this.ancestorTerm(focus, target, r))
    if (r.up === 0) return fixed(this.descendantTerm(target, r))
    if (r.up === 1 && r.down === 1) return { phrases: this.siblingTerm(focus, target), generic: false }
    if (r.up === 1 && r.down === 2) return { phrases: [t.siblingsChild], generic: true }
    if (r.up === 2 && r.down === 1) {
      return fixed(
        this.g.sex(r.fPath[1]) === 'F'
          ? pick(sex, t.maternalUncle, t.maternalAunt, t.maternalParentSibling)
          : pick(sex, t.paternalUncle, t.paternalAunt, t.paternalParentSibling),
      )
    }
    if (r.up === 2 && r.down === 2) {
      const age = compareAge(this.g.person(target), this.g.person(focus))
      if (age === 'older') return fixed(pick(sex, t.cousinOlderMale, t.cousinOlderFemale, t.cousin))
      return fixed(age === 'younger' ? t.cousinYounger : t.cousin)
    }
    return null
  }

  private ancestorTerm(focus: ID, target: ID, r: BloodPath): string {
    const t = this.t
    const sex = this.g.sex(target)
    switch (r.up) {
      case 1: {
        const adopted = this.g.parentLinks(focus).some((l) => l.parentId === target && l.kind === 'adopted')
        return adopted
          ? pick(sex, t.adoptiveFather, t.adoptiveMother, t.parent)
          : pick(sex, t.father, t.mother, t.parent)
      }
      case 2:
        return this.g.sex(r.fPath[1]) === 'F'
          ? pick(sex, t.maternalGrandfather, t.maternalGrandmother, t.grandparent)
          : pick(sex, t.grandfather, t.grandmother, t.grandparent)
      case 3:
        return pick(sex, t.greatGrandfather, t.greatGrandmother, t.ancestor.replace('{n}', '3'))
      case 4:
        return pick(sex, t.greatGreatGrandfather, t.greatGreatGrandmother, t.ancestor.replace('{n}', '4'))
      case 5:
        return pick(sex, t.greatGreatGreatGrandfather, t.greatGreatGreatGrandmother, t.ancestor.replace('{n}', '5'))
      default:
        return pick(sex, t.ancestorMale, t.ancestorFemale, t.ancestor).replace('{n}', String(r.up))
    }
  }

  private descendantTerm(target: ID, r: BloodPath): string | null {
    const t = this.t
    const sex = this.g.sex(target)
    // Son's line → ач, жич; daughter's line → зээ, зээнцэр.
    const line = this.g.sex(r.pPath[1])
    switch (r.down) {
      case 1:
        return pick(sex, t.son, t.daughter, t.child)
      case 2:
        if (line === 'M') return pick(sex, t.sonsSon, t.sonsDaughter, t.sonsChild)
        if (line === 'F') return pick(sex, t.daughtersSon, t.daughtersDaughter, t.daughtersChild)
        return t.grandchild
      case 3:
        return line === 'F' ? t.greatGrandchildViaDaughter : t.greatGrandchildViaSon
      default:
        return null
    }
  }

  private siblingTerm(focus: ID, target: ID): Phrases {
    const t = this.t
    const sex = this.g.sex(target)
    const age = compareAge(this.g.person(target), this.g.person(focus))
    const base =
      age === 'older'
        ? pick(sex, t.olderBrother, t.olderSister, t.olderSibling)
        : age === 'younger'
          ? pick(sex, t.youngerBrother, t.youngerSister, t.youngerSibling)
          : t.siblingUnknownAge

    // Half-siblings: both have two known parents but share only one.
    const fp = this.g.parents(focus)
    const pp = this.g.parents(target)
    const shared = fp.filter((x) => pp.includes(x))
    if (fp.length === 2 && pp.length === 2 && shared.length === 1) {
      return [this.g.sex(shared[0]) === 'F' ? t.halfViaMother : t.halfViaFather, base]
    }
    return [base]
  }

  /** Builds a description from named pieces when there is no single term: "Аавын үеэлийн хүү". */
  private describe(focus: ID, target: ID): Phrases | null {
    const key = `${focus}\u0000${target}`
    if (this.describeCache.has(key)) return this.describeCache.get(key)!

    const r = this.blood(focus, target)
    let best: Phrases | null = null
    const consider = (c: Phrases | null) => {
      if (c && (!best || wordCount(c) < wordCount(best))) best = c
    }

    if (r && (r.up > 0 || r.down > 0)) {
      const fixed = this.bloodTerm(focus, target, r)
      if (fixed && !fixed.generic) {
        best = fixed.phrases
      } else {
        // Through one of the focus person's ancestors: "Өвөөгийн ах".
        for (let k = 1; k < r.up; k++) {
          const x = r.fPath[k]
          const rx = this.blood(x, target)
          if (!rx || rx.up === 0 || rx.down === 0) continue
          const toX = this.describe(focus, x)
          const fromX = this.describe(x, target)
          if (toX && fromX) consider([...possessive(toX), ...fromX])
        }
        // Through the target's parent: "Ахын хүү".
        if (r.down > 0) {
          const toParent = this.describe(focus, r.pPath[r.down - 1])
          if (toParent) consider(possessive(toParent, this.childWord(target)))
        }
      }
    }

    this.describeCache.set(key, best)
    return best
  }

  /** Literal path with only аав/ээж/ах/эгч/дүү/хүү/охин: "Аавын дүүгийн хүү". */
  private plainBlood(r: BloodPath): Phrases {
    const words: string[] = []
    const parentWord = (id: ID) => pick(this.g.sex(id), mnPlain.father, mnPlain.mother, mnPlain.parent)
    if (r.down === 0) {
      for (const id of r.fPath.slice(1)) words.push(parentWord(id))
    } else if (r.up === 0) {
      for (const id of r.pPath.slice(1)) words.push(this.childWord(id))
    } else {
      for (const id of r.fPath.slice(1, r.up)) words.push(parentWord(id))
      words.push(this.plainSibling(r.pPath[1], r.fPath[r.up - 1]))
      for (const id of r.pPath.slice(2)) words.push(this.childWord(id))
    }
    return words.map((w, i) => (i < words.length - 1 ? genitivePhrase(w) : w))
  }

  private plainSibling(sibling: ID, of: ID): string {
    const age = compareAge(this.g.person(sibling), this.g.person(of))
    if (age === 'younger') return mnPlain.younger
    if (age === 'older') {
      return pick(this.g.sex(sibling), mnPlain.olderBrother, mnPlain.olderSister, mnPlain.siblingUnknownAge)
    }
    return mnPlain.siblingUnknownAge
  }

  private childWord(id: ID): string {
    return pick(this.g.sex(id), mnPlain.son, mnPlain.daughter, mnPlain.child)
  }

  private spouseWord(id: ID): string {
    return pick(this.g.sex(id), mnPlain.husband, mnPlain.wife, mnPlain.partner)
  }

  // ── Step and in-law ────────────────────────────────────

  private stepRelation(focus: ID, target: ID): Relation | null {
    const t = this.t
    const sex = this.g.sex(target)
    if (this.g.parentLinks(focus).some((l) => l.parentId === target && l.kind === 'step')) {
      return this.result('step', [pick(sex, t.stepFather, t.stepMother, t.parent)])
    }
    if (this.g.parentLinks(target).some((l) => l.parentId === focus && l.kind === 'step')) {
      return this.result('step', [pick(sex, t.stepSon, t.stepDaughter, t.stepChild)])
    }
    return null
  }

  private inLaw(focus: ID, target: ID): Relation | null {
    const partnersOf = (id: ID) => this.g.partners(id).map((x) => x.partnerId)

    // Target married into the focus person's blood family.
    const viaRelative = closest(partnersOf(target), (x) => (x === focus ? null : this.blood(focus, x)))
    if (viaRelative) {
      const { item: x, path: r } = viaRelative
      const word = this.spouseWord(target)
      const fixed = this.relativesSpouseTerm(focus, x, target, r)
      const described = this.describe(focus, x)
      if (fixed || described) {
        return this.result('inLaw', fixed ? [fixed] : possessive(described!, word), possessive(this.plainBlood(r), word))
      }
    }

    // Target is a blood relative of the focus person's partner.
    const viaSpouse = closest(partnersOf(focus), (s) => this.blood(s, target))
    if (viaSpouse) {
      const { item: s, path: r } = viaSpouse
      const owner = [this.spouseWord(s)]
      const fixed = this.spousesRelativeTerm(s, target, r)
      const described = this.describe(s, target)
      if (fixed || described) {
        return this.result(
          'inLaw',
          fixed ? [fixed] : possessive(owner, ...described!),
          possessive(owner, ...this.plainBlood(r)),
        )
      }
    }

    // Target married a blood relative of the focus person's partner (or the partner too: a co-wife).
    const pairs = partnersOf(focus).flatMap((s) => partnersOf(target).map((y) => ({ s, y })))
    const viaBoth = closest(pairs, ({ s, y }) => this.blood(s, y))
    if (viaBoth) {
      const { item: { s, y }, path: r } = viaBoth
      const owner = [this.spouseWord(s)]
      const word = this.spouseWord(target)
      if (r.up === 0 && r.down === 0) return this.result('inLaw', possessive(owner, word))
      const g = this.g
      const isBaz =
        r.up === 1 && r.down === 1 &&
        g.sex(focus) === 'M' && g.sex(target) === 'M' && g.sex(s) === 'F' && g.sex(y) === 'F'
      if (isBaz) return this.result('inLaw', [this.t.wifesSistersHusband], possessive(owner, ...possessive(this.plainBlood(r), word)))
      const described = this.describe(s, y)
      if (described) {
        return this.result(
          'inLaw',
          possessive(owner, ...possessive(described, word)),
          possessive(owner, ...possessive(this.plainBlood(r), word)),
        )
      }
    }
    return null
  }

  /** `target` is the partner of `relative`, a blood relative of the focus person. */
  private relativesSpouseTerm(focus: ID, relative: ID, target: ID, r: BloodPath): string | null {
    const t = this.t
    const sexR = this.g.sex(relative)
    if (r.up === 1 && r.down === 0) return pick(this.g.sex(target), t.stepFather, t.stepMother, t.parent)
    if (r.up === 0 && r.down === 1) return sexR === 'M' ? t.sonsWife : sexR === 'F' ? t.daughtersHusband : null
    if (r.up === 1 && r.down === 1) {
      const age = compareAge(this.g.person(relative), this.g.person(focus))
      if (sexR === 'M') return age === 'older' ? t.olderBrothersWife : age === 'younger' ? t.youngerBrothersWife : t.brothersWife
      if (sexR === 'F') return age === 'older' ? t.olderSistersHusband : age === 'younger' ? t.youngerSistersHusband : t.sistersHusband
    }
    return null
  }

  /** `target` is a blood relative of `spouse`. */
  private spousesRelativeTerm(spouse: ID, target: ID, r: BloodPath): string | null {
    const t = this.t
    const sex = this.g.sex(target)
    if (r.up === 1 && r.down === 0) return sex === 'M' ? t.fatherInLaw : sex === 'F' ? t.motherInLaw : null
    if (r.up === 0 && r.down === 1) return pick(sex, t.stepSon, t.stepDaughter, t.stepChild)
    if (r.up === 1 && r.down === 1) {
      const age = compareAge(this.g.person(target), this.g.person(spouse))
      if (age === 'older') return pick(sex, t.spouseOlderBrother, t.spouseOlderSister, t.spouseSibling)
      return age === 'younger' ? t.spouseYoungerSibling : t.spouseSibling
    }
    return null
  }

  private result(kind: Relation['kind'], term: Phrases, plain?: Phrases, r?: BloodPath): Relation {
    const text = sentence(term)
    const hint = plain && wordCount(plain) > 1 ? sentence(plain) : undefined
    return {
      kind,
      term: text,
      ...(hint && hint !== text && { hint }),
      ...(r && { up: r.up, down: r.down }),
    }
  }
}

function closest<T>(items: T[], pathOf: (item: T) => BloodPath | null): { item: T; path: BloodPath } | null {
  let best: { item: T; path: BloodPath } | null = null
  for (const item of items) {
    const path = pathOf(item)
    if (path && (!best || path.up + path.down < best.path.up + best.path.down)) best = { item, path }
  }
  return best
}
