import { useMemo, useState, type KeyboardEvent } from 'react'
import { updatePerson } from '../db/edit'
import { db } from '../db/instance'
import type { ClanChange } from '../edit/ClanSpreadDialog'
import type { QuickAdd } from '../edit/quickAdd'
import { inheritedClan } from '../kinship/clan'
import { FamilyGraph } from '../kinship/graph'
import { Kinship } from '../kinship/kinship'
import type { Terms } from '../kinship/terms.mn'
import { displayName } from '../model/format'
import type { FamilyData, FuzzyDate, ID, Person, Sex } from '../model/types'
import { cleanName, searchKey } from '../translit/latinToCyrillic'
import { ConvertToggle, NameInput } from '../ui/NameInput'
import { useStored } from '../ui/storage'
import './table.css'

interface Props {
  data: FamilyData
  terms: Terms
  /** Relations are shown from this person's point of view. */
  focus: ID
  onShow: (id: ID) => void
  onEdit: (id: ID) => void
  onAdd: (id: ID, kind: QuickAdd) => void
  onClanChange: (change: ClanChange) => void
}

type Field = 'patronymic' | 'clanName' | 'sex' | 'birth' | 'death' | 'father' | 'mother' | 'clanDiffers'
type Filter = 'all' | 'any' | Field
type Sort = 'name' | 'birth' | 'missing'

const FIELDS: [Field, string][] = [
  ['patronymic', 'Эцэг/эхийн нэр байхгүй'],
  ['clanName', 'Ургийн овог байхгүй'],
  ['clanDiffers', 'Овог эцгийнхээс өөр'],
  ['birth', 'Төрсөн он байхгүй'],
  ['death', 'Нас барсан он байхгүй'],
  ['sex', 'Хүйс байхгүй'],
  ['father', 'Аав байхгүй'],
  ['mother', 'Ээж байхгүй'],
]

/** Parents aren't counted as "missing info": the oldest generation never has them. */
const COUNTED: Field[] = ['patronymic', 'clanName', 'birth', 'death', 'sex']

const SEXES: [Sex, string][] = [
  ['M', 'Эр'],
  ['F', 'Эм'],
  ['U', '?'],
]

const toYear = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Number(s))
const withYear = (d: FuzzyDate | undefined, year: number | undefined): FuzzyDate | undefined =>
  year == null ? undefined : { ...d, qualifier: d?.qualifier ?? 'exact', year }

function TextCell({ value, onSave, convert, label, required }: { value: string; onSave: (v: string) => void; convert: boolean; label: string; required?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const v = cleanName(draft)
    setDraft(null)
    if (v !== value && (v || !required)) onSave(v)
  }
  return (
    <NameInput
      convert={convert}
      value={draft ?? value}
      onChange={setDraft}
      onBlur={commit}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      aria-label={label}
    />
  )
}

function YearCell({ value, onSave, label }: { value?: number; onSave: (v?: number) => void; label: string }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    setDraft(null)
    const v = toYear(draft)
    if (v !== value) onSave(v)
  }
  return (
    <input
      type="number"
      inputMode="numeric"
      className="year"
      value={draft ?? value ?? ''}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setDraft(null)
      }}
      aria-label={label}
    />
  )
}

export function PeopleTable({ data, terms, focus, onShow, onEdit, onAdd, onClanChange }: Props) {
  const [convert, setConvert] = useStored('translit', true)
  const [filter, setFilter] = useState<Filter>('any')
  const [sort, setSort] = useState<Sort>('name')
  const [query, setQuery] = useState('')
  // Rows edited under a filter stay until the filter changes, so they don't vanish mid-typing.
  const [kept, setKept] = useState<Set<ID>>(new Set())
  const changeFilter = (f: Filter) => {
    setFilter(f)
    setKept(new Set())
  }

  const graph = useMemo(() => new FamilyGraph(data), [data])
  const kinship = useMemo(() => new Kinship(graph, terms), [graph, terms])

  const rows = useMemo(
    () =>
      data.persons.map((p) => {
        const parents = graph.parents(p.id).map((id) => graph.person(id)).filter((x): x is Person => !!x)
        const father = parents.find((x) => x.sex === 'M')
        const mother = parents.find((x) => x.sex === 'F')
        const missing = new Set<Field>()
        if (!p.patronymic) missing.add('patronymic')
        if (!p.clanName) missing.add('clanName')
        if (p.sex === 'U') missing.add('sex')
        if (p.birth?.year == null) missing.add('birth')
        if (!p.isLiving && p.death?.year == null) missing.add('death')
        if (!father) missing.add('father')
        if (!mother) missing.add('mother')
        const inherited = inheritedClan(graph, p.id)
        if (p.clanName && inherited && p.clanName !== inherited) missing.add('clanDiffers')
        const gaps = COUNTED.filter((f) => missing.has(f)).length
        return { p, father, mother, missing, gaps, inherited, key: searchKey(`${p.givenName} ${p.patronymic ?? ''} ${p.clanName ?? ''}`) }
      }),
    [data, graph],
  )

  const counts = new Map<Filter, number>([
    ['all', rows.length],
    ['any', rows.filter((r) => r.gaps > 0).length],
    ...FIELDS.map(([f]) => [f, rows.filter((r) => r.missing.has(f)).length] as [Filter, number]),
  ])

  const q = searchKey(query)
  const shown = rows
    .filter((r) => filter === 'all' || kept.has(r.p.id) || (filter === 'any' ? r.gaps > 0 : r.missing.has(filter)))
    .filter((r) => !q || r.key.includes(q))
    .sort((a, b) => {
      if (sort === 'birth') return (a.p.birth?.year ?? 99999) - (b.p.birth?.year ?? 99999)
      if (sort === 'missing') return b.gaps - a.gaps
      return a.p.givenName.localeCompare(b.p.givenName, 'mn')
    })

  const save = (p: Person, patch: Partial<Person>) => {
    if (!kept.has(p.id)) setKept(new Set(kept).add(p.id))
    return updatePerson(db, p.id, patch)
  }
  const saveClan = async (p: Person, value: string) => {
    await save(p, { clanName: value || undefined })
    if (value) onClanChange({ id: p.id, from: p.clanName, to: value })
  }
  const cls = (r: (typeof rows)[number], f: Field) => (r.missing.has(f) ? 'missing' : undefined)
  const focusPerson = graph.person(focus)

  return (
    <main className="table-view">
      <div className="table-tools">
        <NameInput convert={convert} value={query} onChange={setQuery} placeholder="Хайх" aria-label="Хайх" className="table-search" />
        <label className="depth">
          Эрэмбэ
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="name">Нэрээр</option>
            <option value="birth">Төрсөн оноор</option>
            <option value="missing">Дутуу ихтэй нь эхэнд</option>
          </select>
        </label>
        <ConvertToggle on={convert} onChange={setConvert} />
      </div>
      <div className="table-filters" role="group" aria-label="Шүүлт">
        {(
          [
            ['all', 'Бүгд'],
            ['any', 'Дутуу мэдээлэлтэй'],
            ...FIELDS,
          ] as [Filter, string][]
        ).map(([f, text]) => (
          <button key={f} type="button" className={`chip${filter === f ? ' on' : ''}`} aria-pressed={filter === f} onClick={() => changeFilter(f)}>
            {text} <b>{counts.get(f)}</b>
          </button>
        ))}
      </div>

      <div className="table-scroll">
        <table className="people-table">
          <thead>
            <tr>
              <th>Нэр</th>
              <th>Эцэг/эхийн нэр</th>
              <th>Ургийн овог</th>
              <th>Хүйс</th>
              <th>Төрсөн</th>
              <th>Нас барсан</th>
              <th>Эцэг эх</th>
              <th title={focusPerson ? `Сонгосон хүн: ${displayName(focusPerson)}` : undefined}>Хамаарал</th>
              <th aria-label="Үйлдэл" />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const { p } = r
              const relation = kinship.relate(focus, p.id)
              const clanDiffers = r.missing.has('clanDiffers')
              return (
                <tr key={p.id} className={p.isLiving ? undefined : 'deceased'}>
                  <td className="name-cell">
                    <TextCell convert={convert} value={p.givenName} onSave={(givenName) => save(p, { givenName })} label="Нэр" required />
                  </td>
                  <td className={cls(r, 'patronymic')}>
                    <span className="cell-row">
                    <TextCell convert={convert} value={p.patronymic ?? ''} onSave={(v) => save(p, { patronymic: v || undefined })} label="Эцэг/эхийн нэр" />
                    {!p.patronymic && r.father && (
                      <button type="button" className="suggest" onClick={() => save(p, { patronymic: r.father!.givenName })}>
                        + {r.father.givenName}
                      </button>
                    )}
                    </span>
                  </td>
                  <td className={clanDiffers ? 'conflict' : cls(r, 'clanName')}>
                    <span className="cell-row">
                    <TextCell convert={convert} value={p.clanName ?? ''} onSave={(v) => saveClan(p, v)} label="Ургийн овог" />
                    {!p.clanName && r.inherited && (
                      <button type="button" className="suggest" onClick={() => saveClan(p, r.inherited!)}>
                        + {r.inherited}
                      </button>
                    )}
                    {clanDiffers && (
                      <span className="warn" title={`Эцэг (эх)-ийнх нь «${r.inherited}»`}>
                        ≠ {r.inherited}
                      </span>
                    )}
                    </span>
                  </td>
                  <td className={cls(r, 'sex')}>
                    <select value={p.sex} onChange={(e) => save(p, { sex: e.target.value as Sex })} aria-label="Хүйс">
                      {SEXES.map(([v, t]) => (
                        <option key={v} value={v}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={cls(r, 'birth')}>
                    <YearCell value={p.birth?.year} onSave={(y) => save(p, { birth: withYear(p.birth, y) })} label="Төрсөн он" />
                  </td>
                  <td className={cls(r, 'death')}>
                    <span className="death-cell">
                      <input
                        type="checkbox"
                        checked={!p.isLiving}
                        onChange={(e) => save(p, e.target.checked ? { isLiving: false } : { isLiving: true, death: undefined })}
                        aria-label="Нас барсан"
                      />
                      {!p.isLiving && <YearCell value={p.death?.year} onSave={(y) => save(p, { death: withYear(p.death, y) })} label="Нас барсан он" />}
                    </span>
                  </td>
                  <td className={r.missing.has('father') || r.missing.has('mother') ? 'missing soft' : undefined}>
                    <span className="parents-cell">
                      {r.father ? <span>{displayName(r.father)}</span> : (
                        <button type="button" className="suggest" onClick={() => onAdd(p.id, 'father')}>
                          + Аав
                        </button>
                      )}
                      {r.mother ? <span>{displayName(r.mother)}</span> : (
                        <button type="button" className="suggest" onClick={() => onAdd(p.id, 'mother')}>
                          + Ээж
                        </button>
                      )}
                    </span>
                  </td>
                  <td>{relation && <span className="badge" title={relation.hint}>{relation.term}</span>}</td>
                  <td className="row-actions">
                    <button type="button" className="icon-btn" onClick={() => onShow(p.id)} title="Модонд харах" aria-label="Модонд харах">
                      ⌖
                    </button>
                    <button type="button" className="icon-btn" onClick={() => onEdit(p.id)} title="Бүгдийг засах" aria-label="Бүгдийг засах">
                      ✎
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!shown.length && <p className="hint table-empty">{filter === 'any' ? 'Бүх мэдээлэл бүрэн байна.' : 'Олдсонгүй.'}</p>}
      </div>
    </main>
  )
}
