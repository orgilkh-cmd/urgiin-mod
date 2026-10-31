import type { Relation } from '../kinship/kinship'
import { displayName, formatYears } from '../model/format'
import type { Person } from '../model/types'
import type { PlacedCard } from './layout'

interface Props {
  card: PlacedCard
  person: Person
  relation: Relation | null
  onSelect: (id: string) => void
  onEdit?: (id: string) => void
}

export function PersonCard({ card, person, relation, onSelect, onEdit }: Props) {
  const classes = ['card', card.role, card.side, person.isLiving ? '' : 'deceased'].filter(Boolean).join(' ')
  const years = formatYears(person)
  return (
    <button
      type="button"
      className={classes}
      style={{ transform: `translate(${card.x}px, ${card.y}px)` }}
      onClick={() => onSelect(person.id)}
      onDoubleClick={() => onEdit?.(person.id)}
      title={relation?.hint}
      data-person={person.id}
    >
      <span className="avatar" aria-hidden>
        {person.givenName.charAt(0)}
      </span>
      <span className="name">{displayName(person)}</span>
      <span className="years">{years}</span>
      {relation && <span className="badge">{relation.term}</span>}
    </button>
  )
}
