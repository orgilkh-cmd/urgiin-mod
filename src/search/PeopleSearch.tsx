import { useMemo, useState, type KeyboardEvent } from 'react'
import { FamilyGraph } from '../kinship/graph'
import { Kinship } from '../kinship/kinship'
import type { Terms } from '../kinship/terms.mn'
import { displayName, formatYears } from '../model/format'
import type { FamilyData, ID } from '../model/types'
import { searchKey } from '../translit/latinToCyrillic'
import { Dialog } from '../ui/Dialog'
import { ConvertToggle, NameInput } from '../ui/NameInput'
import { useStored } from '../ui/storage'
import './search.css'

interface Props {
  data: FamilyData
  terms: Terms
  /** Relations are shown from this person's point of view. */
  focus: ID
  onPick: (id: ID) => void
  onClose: () => void
}

type Filter = 'all' | 'living' | 'deceased'

export function PeopleSearch({ data, terms, focus, onPick, onClose }: Props) {
  const [convert, setConvert] = useStored('translit', true)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [active, setActive] = useState(0)

  const kinship = useMemo(() => new Kinship(new FamilyGraph(data), terms), [data, terms])
  const people = useMemo(
    () =>
      data.persons
        .map((p) => ({ p, key: searchKey(`${p.givenName} ${p.patronymic ?? ''} ${p.clanName ?? ''}`) }))
        .sort((a, b) => a.p.givenName.localeCompare(b.p.givenName, 'mn')),
    [data],
  )

  const q = searchKey(query)
  const matches = people
    .filter(({ p }) => filter === 'all' || p.isLiving === (filter === 'living'))
    .filter(({ key }) => key.includes(q))
    // Name starts with the query first.
    .sort((a, b) => Number(!a.key.startsWith(q)) - Number(!b.key.startsWith(q)))
  const living = data.persons.filter((p) => p.isLiving).length

  const pick = (id: ID) => {
    onPick(id)
    onClose()
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => Math.min(Math.max(i + step, 0), matches.length - 1))
    } else if (e.key === 'Enter' && matches[active]) {
      e.preventDefault()
      pick(matches[active].p.id)
    }
  }

  return (
    <Dialog title="Хүн хайх" onClose={onClose} actions={<ConvertToggle on={convert} onChange={setConvert} />}>
      <div className="form search" onKeyDown={onKeyDown}>
        <NameInput
          convert={convert}
          value={query}
          onChange={(v) => {
            setQuery(v)
            setActive(0)
          }}
          placeholder="Нэр, эцгийн нэр, овог"
          aria-label="Хайх"
          autoFocus
        />
        <div className="search-filters">
          {(
            [
              ['all', `Бүгд ${data.persons.length}`],
              ['living', `Амьд ${living}`],
              ['deceased', `Нас барсан ${data.persons.length - living}`],
            ] as [Filter, string][]
          ).map(([f, text]) => (
            <button key={f} type="button" className={`chip${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)} aria-pressed={filter === f}>
              {text}
            </button>
          ))}
        </div>
        <ul className="pick-list search-results" role="listbox" aria-label="Олдсон хүмүүс">
          {matches.map(({ p }, i) => {
            const relation = kinship.relate(focus, p.id)
            return (
              <li key={p.id} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  className={`${i === active ? 'on' : ''}${p.isLiving ? '' : ' deceased'}`}
                  onClick={() => pick(p.id)}
                  onMouseEnter={() => setActive(i)}
                  title={relation?.hint}
                >
                  <span>
                    {displayName(p)}
                    {p.clanName && <small> · {p.clanName}</small>}
                  </span>
                  <span className="search-meta">
                    {relation && <span className="badge">{relation.term}</span>}
                    <small>{formatYears(p)}</small>
                  </span>
                </button>
              </li>
            )
          })}
          {!matches.length && <p className="hint">Олдсонгүй.</p>}
        </ul>
      </div>
    </Dialog>
  )
}
