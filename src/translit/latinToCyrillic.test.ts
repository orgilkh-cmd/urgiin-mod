import { describe, expect, it } from 'vitest'
import { cleanName, convertTyping, latinToCyrillic as tr } from './latinToCyrillic'

describe('latinToCyrillic', () => {
  it.each([
    ['Bat-Erdene', 'Бат-Эрдэнэ'],
    ['Tqmqr', 'Төмөр'],
    ["To'mo'r", 'Төмөр'],
    ['Anhbayar', 'Анхбаяр'],
    ['Dorj', 'Дорж'],
    ['Ochir', 'Очир'],
    ['Ceceg', 'Цэцэг'],
    ['Wyenee', 'Үенээ'],
    ['Ayuush', 'Аюуш'],
    ['Yesqnbayar', 'Есөнбаяр'],
    ['Yondon', 'Ёндон'],
    ["Gu'rragchaa", 'Гүррагчаа'],
  ])('%s → %s', (latin, cyr) => expect(tr(latin)).toBe(cyr))

  it('i after a vowel becomes й', () => {
    expect(tr('ai oi ui wi ii ei')).toBe('ай ой уй үй ий эй')
    expect(tr('AI Ai ai')).toBe('АЙ Ай ай')
    expect(tr('Ganzorig')).toBe('Ганзориг')
  })

  it('soft and hard signs', () => {
    expect(tr("hel'")).toBe('хэль')
    expect(tr('o"')).toBe('оъ')
  })

  it('separator prevents a digraph', () => {
    expect(tr('Ash')).toBe('Аш')
    expect(tr('As|h')).toBe('Асх')
  })

  it('leaves Cyrillic, digits and punctuation alone', () => {
    expect(tr('Оргил 1980, Bat')).toBe('Оргил 1980, Бат')
  })

  it('uppercase digraphs', () => {
    expect(tr('CHULUUN')).toBe('ЧУЛУУН')
    expect(tr('Sharav')).toBe('Шарав')
  })
})

/** Types `text` one character at a time, like a keyboard would. */
function typeInto(text: string) {
  let value = ''
  for (const ch of text) {
    const next = value + ch
    value = convertTyping(value, next)?.value ?? next
  }
  return cleanName(value)
}

describe('convertTyping', () => {
  it.each([
    ['Bat-Erdene', 'Бат-Эрдэнэ'],
    ['Ochir', 'Очир'],
    ['Shiree', 'Ширээ'],
    ['Wyenee', 'Үенээ'],
    ['Ayuush', 'Аюуш'],
    ['Yondon', 'Ёндон'],
    ["To'mo'r", 'Төмөр'],
    ["Gu'rragchaa", 'Гүррагчаа'],
    ['Saihan', 'Сайхан'],
    ['Ceceg', 'Цэцэг'],
    ['s|h', 'сх'],
  ])('typed %s → %s', (latin, cyr) => expect(typeInto(latin)).toBe(cyr))

  it('converts pasted text in the middle and places the caret after it', () => {
    expect(convertTyping('Бат-', 'Бат-Erdene')).toEqual({ value: 'Бат-Эрдэнэ', caret: 10 })
    expect(convertTyping('Ба', 'Бsа')).toEqual({ value: 'Бса', caret: 2 })
  })

  it('leaves deletions and Cyrillic typing alone', () => {
    expect(convertTyping('Бат', 'Ба')).toBeNull()
    expect(convertTyping('Ба', 'Бат')).toBeNull()
    expect(convertTyping('с', 'с|')).toBeNull()
  })
})
