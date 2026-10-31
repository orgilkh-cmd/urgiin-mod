import { describe, expect, it } from 'vitest'
import { FamilyBuilder } from '../sample/sampleFamily'
import { clanSource, inheritedClan, planClanChange } from './clan'
import { FamilyGraph } from './graph'

function family() {
  const f = new FamilyBuilder()
  f.person('Дорж', 'M', 1930, { clanName: 'Боржигин' })
  f.person('Цэцэг', 'F', 1932, { clanName: 'Жалайр' })
  f.marry('Дорж', 'Цэцэг')
  f.person('Бат', 'M', 1955)
  f.person('Мөнхөө', 'F', 1950)
  f.child('Бат', ['Дорж', 'Цэцэг'])
  f.child('Мөнхөө', ['Дорж', 'Цэцэг'])
  f.person('Сараа', 'F', 1958, { clanName: 'Хиад' })
  f.marry('Бат', 'Сараа')
  f.person('Оргил', 'M', 1980)
  f.person('Ганбат', 'M', 1975, { clanName: 'Тайчууд' })
  f.child('Оргил', ['Бат', 'Сараа'])
  f.child('Ганбат', ['Бат', 'Сараа'])
  f.person('Ариун', 'F', 2000)
  f.child('Ариун', ['Ганбат'])
  // Мөнхөө's son by an unrecorded father, and her daughter whose father is known.
  f.person('Бямба', 'M', 1975)
  f.child('Бямба', ['Мөнхөө'])
  f.person('Эрдэнэ', 'M', 1948, { clanName: 'Олхонуд' })
  f.person('Сувд', 'F', 1978)
  f.child('Сувд', ['Мөнхөө', 'Эрдэнэ'])
  return f
}

describe('clan', () => {
  it('comes from the father, or the mother when there is none', () => {
    const g = new FamilyGraph(family().data)
    expect(clanSource(g, 'Оргил')).toBe('Бат')
    expect(clanSource(g, 'Бямба')).toBe('Мөнхөө')
    expect(clanSource(g, 'Сувд')).toBe('Эрдэнэ')
    expect(inheritedClan(g, 'Бат')).toBe('Боржигин')
    expect(inheritedClan(g, 'Оргил')).toBeUndefined()
  })

  it("follows the father's line and leaves wives alone", () => {
    const g = new FamilyGraph(family().data)
    const plan = planClanChange(g, 'Дорж', 'Боржигин', 'Боржигон')
    // Бямба has no father, so he carries his mother's.
    expect(plan.apply.sort()).toEqual(['Бат', 'Бямба', 'Мөнхөө', 'Оргил'])
    expect(plan.apply).not.toContain('Сараа')
    expect(plan.apply).not.toContain('Цэцэг')
    expect(plan.apply).not.toContain('Сувд')
    expect(plan.conflicts).toEqual([{ id: 'Ганбат', clan: 'Тайчууд' }])
  })

  it('changes a conflicting person and their line only when included', () => {
    const g = new FamilyGraph(family().data)
    expect(planClanChange(g, 'Дорж', 'Боржигин', 'Боржигон').apply).not.toContain('Ариун')
    const plan = planClanChange(g, 'Дорж', 'Боржигин', 'Боржигон', new Set(['Ганбат']))
    expect(plan.apply).toContain('Ганбат')
    expect(plan.apply).toContain('Ариун')
  })

  it('fills a new father’s children who had none', () => {
    const f = family()
    f.data.persons.find((p) => p.id === 'Бат')!.clanName = 'Боржигин'
    const g = new FamilyGraph(f.data)
    const plan = planClanChange(g, 'Бат', undefined, 'Боржигин')
    expect(plan.apply).toEqual(['Оргил'])
    expect(plan.conflicts.map((c) => c.id)).toEqual(['Ганбат'])
  })
})
