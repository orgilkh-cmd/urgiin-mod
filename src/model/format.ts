import type { FuzzyDate, Person } from './types'

/** "Б. Оргил" when the patronymic is known. */
export function displayName(p: Person): string {
  return p.patronymic ? `${p.patronymic[0]}. ${p.givenName}` : p.givenName
}

export function formatDate(d?: FuzzyDate): string {
  if (d?.year == null) return ''
  switch (d.qualifier) {
    case 'about':
      return `~${d.year}`
    case 'before':
      return `<${d.year}`
    case 'after':
      return `>${d.year}`
    case 'decade':
      return `${Math.floor(d.year / 10) * 10}-аад`
    default:
      return String(d.year)
  }
}

/** "1980 –", "1932 – 2004", "Нас барсан". */
export function formatYears(p: Person): string {
  const birth = formatDate(p.birth)
  const death = formatDate(p.death)
  if (p.isLiving) return birth ? `${birth} –` : ''
  if (!birth && !death) return 'Нас барсан'
  return `${birth} – ${death}`.trim()
}
