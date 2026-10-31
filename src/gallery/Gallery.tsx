import { useEffect, useMemo, useRef } from 'react'
import { FamilyGraph } from '../kinship/graph'
import { compareAge, Kinship, type Relation } from '../kinship/kinship'
import type { Terms } from '../kinship/terms.mn'
import { displayName, formatYears } from '../model/format'
import type { FamilyData, ID } from '../model/types'
import { Avatar } from '../ui/Avatar'
import { generations, generationTitle } from './generations'
import './gallery.css'

interface Props {
  data: FamilyData
  terms: Terms
  photos: Map<ID, string>
  focus: ID
  onFocus: (id: ID) => void
  onEdit: (id: ID) => void
}

const isBlood = (r: Relation | null) => r?.kind === 'self' || r?.kind === 'blood'

/** Everyone as photo cards, one row per generation; couples stay together, blood relatives first. */
export function Gallery({ data, terms, photos, focus, onFocus, onEdit }: Props) {
  const graph = useMemo(() => new FamilyGraph(data), [data])
  const kinship = useMemo(() => new Kinship(graph, terms), [graph, terms])
  const scroller = useRef<HTMLElement>(null)

  useEffect(() => {
    scroller.current?.querySelector('.photo-card.focus')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focus])

  const sections = useMemo(() => {
    const gen = generations(graph, focus)
    const relation = new Map(data.persons.map((p) => [p.id, kinship.relate(focus, p.id)]))
    const byAge = (a: ID, b: ID) => {
      const r = compareAge(graph.person(a), graph.person(b))
      return r === 'older' ? -1 : r === 'younger' ? 1 : 0
    }

    const rows = Map.groupBy(data.persons.map((p) => p.id), (id) => gen.get(id) ?? null)
    const ordered = [...rows.keys()].filter((g): g is number => g !== null).sort((a, b) => b - a)
    const result = ordered.map((g) => {
      const ids = rows.get(g)!
      const blood = ids.filter((id) => isBlood(relation.get(id)!)).sort(byAge)
      const rest = ids.filter((id) => !blood.includes(id)).sort(byAge)
      const used = new Set<ID>()
      const units: ID[][] = []
      for (const id of [...blood, ...rest]) {
        if (used.has(id)) continue
        used.add(id)
        const partners = graph
          .partners(id)
          .sort((a, b) => (a.union.order ?? 99) - (b.union.order ?? 99))
          .map((x) => x.partnerId)
          .filter((p) => ids.includes(p) && !used.has(p))
        for (const p of partners) used.add(p)
        units.push([id, ...partners])
      }
      return { title: generationTitle(g), units }
    })
    const others = rows.get(null)
    if (others?.length) result.push({ title: 'Холбоогүй', units: others.map((id) => [id]) })
    return { result, relation }
  }, [data, graph, kinship, focus])

  return (
    <main className="gallery" ref={scroller}>
      {sections.result.map((section) => (
        <section key={section.title} className="gallery-row">
          <h2>{section.title}</h2>
          <div className="gallery-units">
            {section.units.map((unit) => (
              <div key={unit[0]} className={unit.length > 1 ? 'gallery-unit couple' : 'gallery-unit'}>
                {unit.map((id) => {
                  const p = graph.person(id)!
                  const r = sections.relation.get(id) ?? null
                  const classes = ['photo-card', id === focus && 'focus', !isBlood(r) && r && 'married', !p.isLiving && 'deceased']
                  return (
                    <button
                      key={id}
                      type="button"
                      className={classes.filter(Boolean).join(' ')}
                      onClick={() => onFocus(id)}
                      onDoubleClick={() => onEdit(id)}
                      title={r?.hint}
                    >
                      <Avatar person={p} url={p.photoId ? photos.get(p.photoId) : undefined} />
                      <span className="name">{displayName(p)}</span>
                      <span className="years">{formatYears(p)}</span>
                      {r && <span className="badge">{r.term}</span>}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </main>
  )
}
