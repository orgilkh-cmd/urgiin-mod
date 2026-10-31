import type { FamilyData, ID, ParentLink, Person, Sex, Union } from '../model/types'

/** Small builder for test families. Names double as IDs to keep tests readable. */
export class FamilyBuilder {
  data: FamilyData = { persons: [], unions: [], parentLinks: [] }
  private seq = 0

  person(name: string, sex: Sex, birthYear?: number, extra: Partial<Person> = {}): ID {
    this.data.persons.push({
      id: name,
      givenName: name,
      sex,
      birth: birthYear ? { year: birthYear, qualifier: 'exact' } : undefined,
      isLiving: true,
      createdAt: '',
      updatedAt: '',
      ...extra,
    })
    return name
  }

  marry(a: ID, b: ID, extra: Partial<Union> = {}): ID {
    const id = `u${++this.seq}`
    this.data.unions.push({ id, partnerIds: [a, b], type: 'married', ...extra })
    return id
  }

  child(childId: ID, parents: ID[], kind: ParentLink['kind'] = 'birth'): void {
    for (const parentId of parents) {
      this.data.parentLinks.push({ id: `l${++this.seq}`, childId, parentId, kind })
    }
  }
}

/**
 * A made-up family centered on "Оргил" (born 1980).
 *
 *   Жаргал → Тэмүүлэн → Батбаяр → Ганбаатар ─┬→ Дорж + Цэцэг → Мөнхөө, Бат, Ганаа(+Солонго → Бямба → Түвшин)
 *                                            └→ Лхагва → Отгон → Цогт
 *   Төмөр + Оюун → Сараа, Нараа
 *   Бат + Сараа → Ганбат(+Ундрах → Ариун), Оргил, Сарнай(+Эрдэнэ), Тодгүй (no birth date)
 *   Бат + Долгор (2nd wife) → Төгс
 *   Оргил + Номин → Тэмүүжин(+Золзаяа → Билгүүн → Хүслэн → Энх), Анужин(+Мөнх → Сувд → Цолмон)
 *   Сүх → Номин, Уянга(+Баяр)
 */
export function sampleFamily(): FamilyData {
  const f = new FamilyBuilder()
  const P = f.person.bind(f)

  P('Жаргал', 'M', 1825); P('Тэмүүлэн', 'M', 1850); P('Батбаяр', 'M', 1875); P('Ганбаатар', 'M', 1900)
  f.child('Тэмүүлэн', ['Жаргал']); f.child('Батбаяр', ['Тэмүүлэн']); f.child('Ганбаатар', ['Батбаяр'])

  P('Дорж', 'M', 1930); P('Цэцэг', 'F', 1932); f.marry('Дорж', 'Цэцэг'); f.child('Дорж', ['Ганбаатар'])
  P('Лхагва', 'M', 1935); f.child('Лхагва', ['Ганбаатар'])
  P('Отгон', 'M'); f.child('Отгон', ['Лхагва'])
  P('Цогт', 'M', 1990); f.child('Цогт', ['Отгон'])

  P('Мөнхөө', 'F', 1950); P('Бат', 'M', 1955); P('Ганаа', 'M', 1960)
  for (const c of ['Мөнхөө', 'Бат', 'Ганаа']) f.child(c, ['Дорж', 'Цэцэг'])
  P('Солонго', 'F', 1962); f.marry('Ганаа', 'Солонго')
  P('Бямба', 'M', 1985); f.child('Бямба', ['Ганаа', 'Солонго'])
  P('Түвшин', 'M', 2010); f.child('Түвшин', ['Бямба'])

  P('Төмөр', 'M', 1928); P('Оюун', 'F', 1930); f.marry('Төмөр', 'Оюун')
  P('Сараа', 'F', 1958); P('Нараа', 'F', 1960)
  f.child('Сараа', ['Төмөр', 'Оюун']); f.child('Нараа', ['Төмөр', 'Оюун'])

  f.marry('Бат', 'Сараа', { order: 1 })
  P('Ганбат', 'M', 1975); P('Оргил', 'M', 1980); P('Сарнай', 'F', 1985); P('Тодгүй', 'M')
  for (const c of ['Ганбат', 'Оргил', 'Сарнай', 'Тодгүй']) f.child(c, ['Бат', 'Сараа'])
  P('Долгор', 'F', 1965); f.marry('Бат', 'Долгор', { order: 2 })
  P('Төгс', 'M', 1990); f.child('Төгс', ['Бат', 'Долгор'])

  P('Ундрах', 'F', 1977); f.marry('Ганбат', 'Ундрах')
  P('Ариун', 'F', 2000); f.child('Ариун', ['Ганбат', 'Ундрах'])
  P('Эрдэнэ', 'M', 1983); f.marry('Сарнай', 'Эрдэнэ')

  P('Номин', 'F', 1982); f.marry('Оргил', 'Номин')
  P('Сүх', 'M', 1955); f.child('Номин', ['Сүх'])
  P('Уянга', 'F', 1978); f.child('Уянга', ['Сүх'])
  P('Баяр', 'M', 1976); f.marry('Уянга', 'Баяр')

  P('Тэмүүжин', 'M', 2008); P('Анужин', 'F', 2012)
  f.child('Тэмүүжин', ['Оргил', 'Номин']); f.child('Анужин', ['Оргил', 'Номин'])
  P('Золзаяа', 'F', 2010); f.marry('Тэмүүжин', 'Золзаяа')
  P('Билгүүн', 'M', 2030); f.child('Билгүүн', ['Тэмүүжин', 'Золзаяа'])
  P('Хүслэн', 'M', 2055); f.child('Хүслэн', ['Билгүүн'])
  P('Энх', 'M', 2080); f.child('Энх', ['Хүслэн'])
  P('Мөнх', 'M', 2010); f.marry('Анужин', 'Мөнх')
  P('Сувд', 'F', 2035); f.child('Сувд', ['Анужин', 'Мөнх'])
  P('Цолмон', 'F', 2060); f.child('Цолмон', ['Сувд'])

  P('Гадны', 'M', 1970)

  // Patronymic from the father's name; people born before 1940 have passed away.
  const byId = new Map(f.data.persons.map((p) => [p.id, p]))
  for (const p of f.data.persons) {
    const father = f.data.parentLinks.find((l) => l.childId === p.id && byId.get(l.parentId)?.sex === 'M')
    if (father) p.patronymic = father.parentId
    if (p.birth?.year && p.birth.year < 1940) {
      p.isLiving = false
      p.death = { year: p.birth.year + 72, qualifier: 'exact' }
    }
  }
  return f.data
}
