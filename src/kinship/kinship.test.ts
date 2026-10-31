import { describe, expect, it } from 'vitest'
import { FamilyBuilder, sampleFamily } from '../sample/sampleFamily'
import { FamilyGraph } from './graph'
import { Kinship } from './kinship'
import { genitive, mnTerms } from './terms.mn'

const kin = new Kinship(new FamilyGraph(sampleFamily()))
const term = (focus: string, target: string) => kin.relate(focus, target)?.term
const hint = (focus: string, target: string) => kin.relate(focus, target)?.hint

describe('focus changes the label (SPEC examples)', () => {
  it('my father is Аав to me and Өвөө to my son', () => {
    expect(term('Оргил', 'Бат')).toBe('Аав')
    expect(term('Тэмүүжин', 'Бат')).toBe('Өвөө')
  })
  it("my son's mother's side: my mother is Эмээ, her father Элэнц өвөө", () => {
    expect(term('Тэмүүжин', 'Сараа')).toBe('Эмээ')
    expect(term('Тэмүүжин', 'Төмөр')).toBe('Элэнц өвөө')
  })
  it('self', () => expect(term('Оргил', 'Оргил')).toBe('Өөрөө'))
})

describe('ancestors', () => {
  it.each([
    ['Дорж', 'Өвөө'],
    ['Цэцэг', 'Эмээ'],
    ['Төмөр', 'Нагац өвөө'],
    ['Оюун', 'Нагац эмээ'],
    ['Ганбаатар', 'Элэнц өвөө'],
    ['Батбаяр', 'Хуланц өвөө'],
    ['Тэмүүлэн', 'Өндөр өвөө'],
    ['Жаргал', '6 дахь үеийн өвөө'],
  ])('%s → %s', (target, expected) => expect(term('Оргил', target)).toBe(expected))
})

describe('descendants', () => {
  it.each([
    ['Тэмүүжин', 'Хүү'],
    ['Анужин', 'Охин'],
    ['Билгүүн', 'Ач хүү'],
    ['Сувд', 'Зээ охин'],
    ['Хүслэн', 'Жич'],
    ['Цолмон', 'Зээнцэр'],
    ['Энх', 'Жичийн хүү'],
  ])('%s → %s', (target, expected) => expect(term('Оргил', target)).toBe(expected))
})

describe('siblings', () => {
  it('older brother, younger sister', () => {
    expect(term('Оргил', 'Ганбат')).toBe('Ах')
    expect(term('Оргил', 'Сарнай')).toBe('Эмэгтэй дүү')
    expect(term('Сарнай', 'Оргил')).toBe('Ах')
    expect(term('Анужин', 'Тэмүүжин')).toBe('Ах')
  })
  it('no birth date and no order → Ах дүү', () => expect(term('Оргил', 'Тодгүй')).toBe('Ах дүү'))
  it('child of father’s 2nd wife → Эцэг нэгт', () => expect(term('Оргил', 'Төгс')).toBe('Эцэг нэгт эрэгтэй дүү'))
  it('birth order decides when dates are missing', () => {
    const f = new FamilyBuilder()
    f.person('A', 'M', undefined, { birthOrder: 1 })
    f.person('B', 'F', undefined, { birthOrder: 2 })
    f.person('Dad', 'M')
    f.child('A', ['Dad']); f.child('B', ['Dad'])
    const k = new Kinship(new FamilyGraph(f.data))
    expect(k.relate('B', 'A')?.term).toBe('Ах')
    expect(k.relate('A', 'B')?.term).toBe('Эмэгтэй дүү')
  })
  it("sibling's child → Ах дүүгийн хүүхэд, hint shows the exact path", () => {
    expect(term('Оргил', 'Ариун')).toBe('Ах дүүгийн хүүхэд')
    expect(hint('Оргил', 'Ариун')).toBe('Ахын охин')
  })
})

describe('parents’ siblings and cousins', () => {
  it.each([
    ['Ганаа', 'Авга ах'],
    ['Мөнхөө', 'Авга эгч'],
    ['Нараа', 'Нагац эгч'],
    ['Бямба', 'Үеэл дүү'],
    ['Отгон', 'Аавын үеэл'],
    ['Лхагва', 'Аавын авга ах'],
    ['Цогт', 'Аавын үеэлийн хүү'],
    ['Түвшин', 'Үеэл дүүгийн хүү'],
  ])('%s → %s', (target, expected) => expect(term('Оргил', target)).toBe(expected))
  it('hint for uncle', () => expect(hint('Оргил', 'Ганаа')).toBe('Аавын дүү'))
})

describe('spouses and in-laws', () => {
  it.each([
    ['Номин', 'Эхнэр'],
    ['Долгор', 'Хойт ээж'],
    ['Ундрах', 'Бэргэн эгч'],
    ['Эрдэнэ', 'Хүргэн дүү'],
    ['Золзаяа', 'Бэр'],
    ['Мөнх', 'Хүргэн'],
    ['Сүх', 'Хадам аав'],
    ['Уянга', 'Хадам эгч'],
    ['Баяр', 'Баз'],
    ['Солонго', 'Авга ахын эхнэр'],
  ])('%s → %s', (target, expected) => expect(term('Оргил', target)).toBe(expected))

  it('from the other side', () => {
    expect(term('Номин', 'Оргил')).toBe('Нөхөр')
    expect(term('Номин', 'Бат')).toBe('Хадам аав')
    expect(term('Бат', 'Номин')).toBe('Бэр')
    expect(term('Ганбат', 'Номин')).toBe('Бэр')
  })

  it('co-wives', () => expect(term('Сараа', 'Долгор')).toBe('Нөхрийн эхнэр'))

  it('divorced partner gets Хуучин', () => {
    const f = new FamilyBuilder()
    f.person('A', 'M'); f.person('B', 'F')
    f.marry('A', 'B', { endReason: 'divorce' })
    expect(new Kinship(new FamilyGraph(f.data)).relate('A', 'B')?.term).toBe('Хуучин эхнэр')
  })

  it("spouse's child from another union → Дагавар", () => {
    const f = new FamilyBuilder()
    f.person('Me', 'M'); f.person('Wife', 'F'); f.person('Kid', 'F'); f.person('Ex', 'M')
    f.marry('Me', 'Wife'); f.child('Kid', ['Wife', 'Ex'])
    const k = new Kinship(new FamilyGraph(f.data))
    expect(k.relate('Me', 'Kid')?.term).toBe('Дагавар охин')
    expect(k.relate('Kid', 'Me')?.term).toBe('Хойт аав')
  })
})

describe('other', () => {
  it('unconnected person → null', () => expect(kin.relate('Оргил', 'Гадны')).toBeNull())
  it('adopted parent', () => {
    const f = new FamilyBuilder()
    f.person('Kid', 'M'); f.person('Mom', 'F')
    f.child('Kid', ['Mom'], 'adopted')
    expect(new Kinship(new FamilyGraph(f.data)).relate('Kid', 'Mom')?.term).toBe('Өргөмөл ээж')
  })
  it('user overrides a term', () => {
    const k = new Kinship(new FamilyGraph(sampleFamily()), { ...mnTerms, greatGrandfather: 'Буурал өвөө' })
    expect(k.relate('Оргил', 'Ганбаатар')?.term).toBe('Буурал өвөө')
  })
})

describe('genitive', () => {
  it.each([
    ['аав', 'аавын'], ['ээж', 'ээжийн'], ['өвөө', 'өвөөгийн'], ['хүү', 'хүүгийн'],
    ['охин', 'охины'], ['ах', 'ахын'], ['эгч', 'эгчийн'], ['дүү', 'дүүгийн'],
    ['үеэл', 'үеэлийн'], ['эхнэр', 'эхнэрийн'], ['нөхөр', 'нөхрийн'], ['хүргэн', 'хүргэний'],
    ['жич', 'жичийн'], ['хүүхэд', 'хүүхдийн'],
  ])('%s → %s', (word, expected) => expect(genitive(word)).toBe(expected))
})
