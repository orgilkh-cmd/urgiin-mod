import { describe, expect, it } from 'vitest'
import { FamilyGraph } from '../kinship/graph'
import { sampleFamily } from '../sample/sampleFamily'
import { generations, generationTitle } from './generations'

describe('generations', () => {
  const gen = generations(new FamilyGraph(sampleFamily()), 'Оргил')

  it('counts up through parents and down through children', () => {
    expect(gen.get('Оргил')).toBe(0)
    expect(gen.get('Бат')).toBe(1)
    expect(gen.get('Дорж')).toBe(2)
    expect(gen.get('Тэмүүжин')).toBe(-1)
    expect(gen.get('Билгүүн')).toBe(-2)
  })

  it('puts spouses and cousins on the same row as their partners and peers', () => {
    expect(gen.get('Номин')).toBe(0)
    expect(gen.get('Золзаяа')).toBe(-1)
    expect(gen.get('Бямба')).toBe(0)
    expect(gen.get('Уянга')).toBe(0)
  })

  it('leaves out people with no path to the focus', () => {
    expect(gen.has('Гадны')).toBe(false)
  })

  it('names the generations', () => {
    expect(generationTitle(2)).toBe('Өвөө эмээгийн үе')
    expect(generationTitle(0)).toBe('Өөрийн үе')
    expect(generationTitle(-1)).toBe('Хүүхдийн үе')
    expect(generationTitle(9)).toBe('9 үе дээш')
  })
})
