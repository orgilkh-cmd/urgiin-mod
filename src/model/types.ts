export type ID = string

export type Sex = 'M' | 'F' | 'U'

export interface FuzzyDate {
  year?: number
  month?: number
  day?: number
  qualifier: 'exact' | 'about' | 'before' | 'after' | 'decade'
}

export interface Person {
  id: ID
  givenName: string
  /** Эцгийн (эсвэл эхийн) нэр — shown as "Б. Оргил". */
  patronymic?: string
  /** Ургийн овог. */
  clanName?: string
  sex: Sex
  birth?: FuzzyDate
  death?: FuzzyDate
  isLiving: boolean
  /** Fallback for ах/дүү when birth dates are missing. Lower = older. */
  birthOrder?: number
  photoId?: ID
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Union {
  id: ID
  /** One partner may be unknown. */
  partnerIds: [ID, ID] | [ID]
  type: 'married' | 'partner'
  start?: FuzzyDate
  end?: FuzzyDate
  endReason?: 'divorce' | 'death' | 'separation'
  /** 1st, 2nd wife… from the point of view of the person with several unions. */
  order?: number
  notes?: string
}

export interface ParentLink {
  id: ID
  childId: ID
  parentId: ID
  /** Which union the child belongs to — lets half-siblings resolve correctly. */
  unionId?: ID
  kind: 'birth' | 'adopted' | 'step'
}

export interface FamilyData {
  persons: Person[]
  unions: Union[]
  parentLinks: ParentLink[]
}
