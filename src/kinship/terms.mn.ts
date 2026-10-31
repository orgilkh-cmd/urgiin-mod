// Default Mongolian kinship words (SPEC.md §4). Users can override any key.
// Rule: prefer simple, common words; rare terms are replaced by a described path.

export const mnTerms = {
  self: 'Өөрөө',

  father: 'Аав',
  mother: 'Ээж',
  parent: 'Эцэг эх',
  adoptiveFather: 'Өргөмөл аав',
  adoptiveMother: 'Өргөмөл ээж',
  stepFather: 'Хойт аав',
  stepMother: 'Хойт ээж',

  grandfather: 'Өвөө',
  grandmother: 'Эмээ',
  maternalGrandfather: 'Нагац өвөө',
  maternalGrandmother: 'Нагац эмээ',
  grandparent: 'Өвөө эмээ',
  greatGrandfather: 'Элэнц өвөө',
  greatGrandmother: 'Элэнц эмээ',
  greatGreatGrandfather: 'Хуланц өвөө',
  greatGreatGrandmother: 'Хуланц эмээ',
  greatGreatGreatGrandfather: 'Өндөр өвөө',
  greatGreatGreatGrandmother: 'Өндөр эмээ',
  /** {n} = generations up. */
  ancestorMale: '{n} дахь үеийн өвөө',
  ancestorFemale: '{n} дахь үеийн эмээ',
  ancestor: '{n} дахь үеийн өвөг',

  son: 'Хүү',
  daughter: 'Охин',
  child: 'Хүүхэд',
  stepSon: 'Дагавар хүү',
  stepDaughter: 'Дагавар охин',
  stepChild: 'Дагавар хүүхэд',
  sonsSon: 'Ач хүү',
  sonsDaughter: 'Ач охин',
  sonsChild: 'Ач',
  daughtersSon: 'Зээ хүү',
  daughtersDaughter: 'Зээ охин',
  daughtersChild: 'Зээ',
  grandchild: 'Ач зээ',
  greatGrandchildViaSon: 'Жич',
  greatGrandchildViaDaughter: 'Зээнцэр',

  olderBrother: 'Ах',
  olderSister: 'Эгч',
  olderSibling: 'Ах эгч',
  youngerBrother: 'Эрэгтэй дүү',
  youngerSister: 'Эмэгтэй дүү',
  youngerSibling: 'Дүү',
  siblingUnknownAge: 'Ах дүү',
  halfViaFather: 'Эцэг нэгт',
  halfViaMother: 'Эх нэгт',
  siblingsChild: 'Ах дүүгийн хүүхэд',

  paternalUncle: 'Авга ах',
  paternalAunt: 'Авга эгч',
  paternalParentSibling: 'Авга',
  maternalUncle: 'Нагац ах',
  maternalAunt: 'Нагац эгч',
  maternalParentSibling: 'Нагац',

  cousinOlderMale: 'Үеэл ах',
  cousinOlderFemale: 'Үеэл эгч',
  cousinYounger: 'Үеэл дүү',
  cousin: 'Үеэл',

  husband: 'Нөхөр',
  wife: 'Эхнэр',
  partner: 'Хань',
  formerPrefix: 'Хуучин',
  fatherInLaw: 'Хадам аав',
  motherInLaw: 'Хадам ээж',
  spouseOlderBrother: 'Хадам ах',
  spouseOlderSister: 'Хадам эгч',
  spouseYoungerSibling: 'Хадам дүү',
  spouseSibling: 'Хадам ах дүү',
  olderBrothersWife: 'Бэргэн эгч',
  youngerBrothersWife: 'Бэр',
  brothersWife: 'Бэр',
  olderSistersHusband: 'Хүргэн ах',
  youngerSistersHusband: 'Хүргэн дүү',
  sistersHusband: 'Хүргэн',
  sonsWife: 'Бэр',
  daughtersHusband: 'Хүргэн',
  wifesSistersHusband: 'Баз',
}

export type TermKey = keyof typeof mnTerms
export type Terms = Record<TermKey, string>

/** Plain words used to build described paths and hover hints ("Ахын хүү"). Not user-editable. */
export const mnPlain = {
  father: 'аав',
  mother: 'ээж',
  parent: 'эцэг эх',
  son: 'хүү',
  daughter: 'охин',
  child: 'хүүхэд',
  husband: 'нөхөр',
  wife: 'эхнэр',
  partner: 'хань',
  olderBrother: 'ах',
  olderSister: 'эгч',
  younger: 'дүү',
  siblingUnknownAge: 'ах дүү',
}

const IRREGULAR_GENITIVE: Record<string, string> = {
  нөхөр: 'нөхрийн',
  хүүхэд: 'хүүхдийн',
  авга: 'авгын',
  хань: 'ханийн',
}

const VOWELS = 'аэиоуөүяеёюы'

/** Genitive case of one word: аав → аавын, охин → охины, хүү → хүүгийн. */
export function genitive(word: string): string {
  const lower = word.toLowerCase()
  const irregular = IRREGULAR_GENITIVE[lower]
  if (irregular) return word[0] + irregular.slice(1)
  const back = /[аоуя]/.test(lower) && !/[эөүе]/.test(lower)
  const last = lower.at(-1) ?? ''
  if (VOWELS.includes(last)) return word + 'гийн'
  if (last === 'н') return word + (back ? 'ы' : 'ий')
  return word + (back ? 'ын' : 'ийн')
}

/** Genitive of the last word of a phrase: "Авга ах" → "Авга ахын". */
export function genitivePhrase(phrase: string): string {
  return phrase.replace(/(\S+)$/, (w) => genitive(w))
}
