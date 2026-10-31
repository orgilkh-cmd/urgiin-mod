import { useState } from 'react'
import { db, saveSetting } from '../db/instance'
import { addRelative, createPerson, type NewPerson } from '../db/edit'
import type { FuzzyDate, ID, Sex, Union } from '../model/types'
import { cleanName } from '../translit/latinToCyrillic'
import { Segmented, YearInput } from '../ui/fields'
import { SEX_OPTIONS } from '../ui/options'
import { ConvertToggle, NameInput } from '../ui/NameInput'
import { useStored } from '../ui/storage'
import './wizard.css'

interface Entry {
  givenName: string
  sex: Sex
  birth?: FuzzyDate
  deceased: boolean
  clanName?: string
}

interface Sibling extends Entry {
  older: boolean
}

interface Spouse extends Entry {
  endReason: Union['endReason'] | ''
}

interface Child extends Entry {
  /** Index into spouses; -1 = not recorded. */
  spouse: number
}

const blank = (sex: Sex, deceased = false): Entry => ({ givenName: '', sex, deceased })
const filled = (e: Entry) => cleanName(e.givenName) !== ''

interface RowProps<T extends Entry> {
  label?: string
  entry: T
  onChange: (e: T) => void
  convert: boolean
  /** Shown when the sex isn't implied by the label. */
  withSex?: boolean
  /** Own ургийн овог field, for people who don't take it from someone already entered. */
  withClan?: boolean
  onRemove?: () => void
  autoFocus?: boolean
  children?: React.ReactNode
}

function PersonRow<T extends Entry>({ label, entry, onChange, convert, withSex, withClan, onRemove, autoFocus, children }: RowProps<T>) {
  const set = (patch: Partial<Entry>) => onChange({ ...entry, ...patch })
  return (
    <div className="wizard-row">
      {label && <span className="wizard-label">{label}</span>}
      <NameInput
        convert={convert}
        value={entry.givenName}
        onChange={(givenName) => set({ givenName })}
        placeholder="Нэр"
        aria-label={label ? `${label}: нэр` : 'Нэр'}
        autoFocus={autoFocus}
      />
      {withClan && (
        <NameInput
          convert={convert}
          value={entry.clanName ?? ''}
          onChange={(clanName) => set({ clanName })}
          placeholder="Ургийн овог"
          aria-label={label ? `${label}: ургийн овог` : 'Ургийн овог'}
        />
      )}
      <YearInput value={entry.birth} onChange={(birth) => set({ birth })} />
      <label className="check">
        <input type="checkbox" checked={entry.deceased} onChange={(e) => set({ deceased: e.target.checked })} />
        Нас барсан
      </label>
      {withSex && <Segmented label="Хүйс" value={entry.sex} options={SEX_OPTIONS.slice(0, 2)} onChange={(sex) => set({ sex })} />}
      {children}
      {onRemove && (
        <button type="button" className="icon-btn" onClick={onRemove} aria-label="Хасах">
          ×
        </button>
      )}
    </div>
  )
}

const STEPS = ['Би', 'Эцэг эх', 'Өвөө эмээ', 'Ах эгч дүү', 'Эхнэр/нөхөр', 'Хүүхдүүд'] as const

export function Wizard({ onCancel, onDone }: { onCancel: () => void; onDone: (me: ID) => void }) {
  const [convert, setConvert] = useStored('translit', true)
  const [step, setStep] = useState(0)
  const [me, setMe] = useState<Entry>(blank('M'))
  const [father, setFather] = useState<Entry>(blank('M'))
  const [mother, setMother] = useState<Entry>(blank('F'))
  const [grand, setGrand] = useState<Entry[]>([blank('M'), blank('F'), blank('M'), blank('F')])
  const [siblings, setSiblings] = useState<Sibling[]>([])
  const [spouses, setSpouses] = useState<Spouse[]>([{ ...blank('F'), endReason: '' }])
  const [children, setChildren] = useState<Child[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const hasParents = filled(father) || filled(mother)
  const spouseOpposite: Sex = me.sex === 'M' ? 'F' : 'M'
  const last = step === STEPS.length - 1

  const next = () => {
    if (step === 0 && !filled(me)) return setError('Өөрийнхөө нэрийг бичнэ үү.')
    setError('')
    if (step === 0) setSpouses((s) => s.map((x) => (filled(x) ? x : { ...x, sex: spouseOpposite })))
    setStep(step + 1)
  }

  const save = async () => {
    setSaving(true)
    setError('')
    // Father's line carries my clan; mother, grandmothers and spouses keep their own.
    const myClan = cleanName(me.clanName ?? '') || undefined
    const person = (e: Entry, patronymic?: string, clan = cleanName(e.clanName ?? '') || undefined): NewPerson => ({
      givenName: cleanName(e.givenName),
      sex: e.sex,
      birth: e.birth,
      isLiving: !e.deceased,
      ...(patronymic && { patronymic }),
      ...(clan && { clanName: clan }),
    })
    try {
      const meId = await db.transaction('rw', [db.persons, db.unions, db.parentLinks, db.settings], async () => {
        const meId = await createPerson(db, person(me))
        const fatherId = filled(father) ? await addRelative(db, meId, 'parent', { person: person(father, undefined, myClan) }) : undefined
        const motherId = filled(mother) ? await addRelative(db, meId, 'parent', { person: person(mother) }) : undefined
        const [pgf, pgm, mgf, mgm] = grand
        const motherClan = cleanName(mother.clanName ?? '') || undefined
        for (const [parent, g, clan] of [
          [fatherId, pgf, myClan],
          [fatherId, pgm, undefined],
          [motherId, mgf, motherClan],
          [motherId, mgm, undefined],
        ] as const) {
          if (parent && filled(g)) await addRelative(db, parent, 'parent', { person: clan ? person(g, undefined, clan) : person(g) })
        }
        const fatherName = filled(father) ? cleanName(father.givenName) : undefined
        if (fatherId || motherId) {
          for (const s of siblings.filter(filled)) {
            await addRelative(db, meId, 'sibling', { person: person(s, fatherName, myClan) }, { older: s.older })
          }
        }
        const spouseIds: ID[] = []
        for (const s of spouses) {
          if (!filled(s)) {
            spouseIds.push('')
            continue
          }
          const union = s.endReason ? { endReason: s.endReason } : undefined
          spouseIds.push(await addRelative(db, meId, 'spouse', { person: person(s) }, { union }))
        }
        for (const c of children.filter(filled)) {
          const spouseId = spouseIds[c.spouse] || null
          const spouse = spouseId ? spouses[c.spouse] : undefined
          const dad = me.sex === 'M' ? me : spouse?.sex === 'M' ? spouse : undefined
          const clan = dad ? cleanName(dad.clanName ?? '') || undefined : myClan
          await addRelative(db, meId, 'child', { person: person(c, dad && cleanName(dad.givenName), clan) }, { partnerId: spouseId })
        }
        await saveSetting('homePersonId', meId)
        return meId
      })
      onDone(meId)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  const filledSpouses = spouses.map((s, i) => [i, s] as const).filter(([, s]) => filled(s))

  return (
    <main className="wizard">
      <header className="wizard-head">
        <h1>Өөрөөсөө эхлэх</h1>
        <ConvertToggle on={convert} onChange={setConvert} />
      </header>
      <ol className="wizard-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            {i < step ? (
              <button type="button" onClick={() => setStep(i)}>
                {s}
              </button>
            ) : (
              s
            )}
          </li>
        ))}
      </ol>

      <form
        className="form wizard-body"
        onSubmit={(e) => {
          e.preventDefault()
          if (last) save()
          else next()
        }}
      >
        {step === 0 && (
          <>
            <p className="hint">Эхлээд өөрийгөө оруулна. Зөвхөн нэр заавал. Латинаар бичвэл кирилл болно: Orgil → Оргил.</p>
            <PersonRow entry={me} onChange={setMe} convert={convert} withSex withClan autoFocus />
            <p className="hint">Ургийн овгоо бичвэл аав, өвөө, ах дүү, хүүхдүүдэд тань автоматаар өгнө. Ээж, эхнэр нь өөрийн овогтой.</p>
          </>
        )}

        {step === 1 && (
          <>
            <p className="hint">Мэдэхгүй бол хоосон орхиж болно.</p>
            <PersonRow label="Аав" entry={father} onChange={setFather} convert={convert} autoFocus />
            <PersonRow label="Ээж" entry={mother} onChange={setMother} convert={convert} withClan />
          </>
        )}

        {step === 2 && (
          <>
            {!filled(father) && !filled(mother) && <p className="hint">Эцэг эхээ оруулаагүй тул энэ алхмыг алгасна.</p>}
            {filled(father) && (
              <>
                <h3 className="section-title">Аавын тал</h3>
                {(['Өвөө', 'Эмээ'] as const).map((label, i) => (
                  <PersonRow key={label} label={label} entry={grand[i]} convert={convert} withClan={i === 1}
                    onChange={(e) => setGrand(grand.map((g, j) => (j === i ? e : g)))} autoFocus={i === 0} />
                ))}
              </>
            )}
            {filled(mother) && (
              <>
                <h3 className="section-title">Ээжийн тал</h3>
                {(['Нагац өвөө', 'Нагац эмээ'] as const).map((label, k) => {
                  const i = k + 2
                  return (
                    <PersonRow key={label} label={label} entry={grand[i]} convert={convert} withClan={k === 1}
                      onChange={(e) => setGrand(grand.map((g, j) => (j === i ? e : g)))} autoFocus={!filled(father) && k === 0} />
                  )
                })}
              </>
            )}
          </>
        )}

        {step === 3 && (
          <>
            {!hasParents ? (
              <p className="hint">Ах, эгч, дүүг эцэг эхээр нь холбодог. Эцэг эхээ оруулбал энд нэмэх боломжтой.</p>
            ) : (
              <>
                {siblings.map((s, i) => (
                  <PersonRow
                    key={i}
                    entry={s}
                    convert={convert}
                    autoFocus={i === siblings.length - 1}
                    onChange={(e) => setSiblings(siblings.map((x, j) => (j === i ? e : x)))}
                    onRemove={() => setSiblings(siblings.filter((_, j) => j !== i))}
                  >
                    <Segmented
                      label="Хэн бэ"
                      value={`${s.older ? 'older' : 'younger'}${s.sex}`}
                      options={[
                        ['olderM', 'Ах'],
                        ['olderF', 'Эгч'],
                        ['youngerM', 'Эр дүү'],
                        ['youngerF', 'Эм дүү'],
                      ]}
                      onChange={(v) =>
                        setSiblings(siblings.map((x, j) => (j === i ? { ...x, older: v.startsWith('older'), sex: v.endsWith('M') ? 'M' : 'F' } : x)))
                      }
                    />
                  </PersonRow>
                ))}
                <button type="button" className="btn" onClick={() => setSiblings([...siblings, { ...blank('M'), older: true }])}>
                  + Ах, эгч, дүү нэмэх
                </button>
              </>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <p className="hint">Олон удаа гэрлэсэн бол дарааллаар нь нэмнэ.</p>
            {spouses.map((s, i) => (
              <PersonRow
                key={i}
                label={spouses.length > 1 ? `${i + 1}.` : undefined}
                entry={s}
                convert={convert}
                withSex={me.sex === 'U'}
                withClan
                autoFocus={i === spouses.length - 1}
                onChange={(e) => setSpouses(spouses.map((x, j) => (j === i ? e : x)))}
                onRemove={spouses.length > 1 ? () => setSpouses(spouses.filter((_, j) => j !== i)) : undefined}
              >
                <select
                  aria-label="Байдал"
                  value={s.endReason}
                  onChange={(e) => setSpouses(spouses.map((x, j) => (j === i ? { ...x, endReason: e.target.value as Spouse['endReason'] } : x)))}
                >
                  <option value="">Хамт байгаа</option>
                  <option value="divorce">Салсан</option>
                  <option value="death">Нас барснаар</option>
                </select>
              </PersonRow>
            ))}
            <button type="button" className="btn" onClick={() => setSpouses([...spouses, { ...blank(spouseOpposite), endReason: '' }])}>
              + Дахин нэмэх
            </button>
          </>
        )}

        {step === 5 && (
          <>
            {children.map((c, i) => (
              <PersonRow
                key={i}
                entry={c}
                convert={convert}
                withSex
                autoFocus={i === children.length - 1}
                onChange={(e) => setChildren(children.map((x, j) => (j === i ? e : x)))}
                onRemove={() => setChildren(children.filter((_, j) => j !== i))}
              >
                {filledSpouses.length > 1 && (
                  <select
                    aria-label={me.sex === 'F' ? 'Эцэг нь' : 'Эх нь'}
                    value={c.spouse}
                    onChange={(e) => setChildren(children.map((x, j) => (j === i ? { ...x, spouse: Number(e.target.value) } : x)))}
                  >
                    {filledSpouses.map(([k, s]) => (
                      <option key={k} value={k}>
                        {cleanName(s.givenName)}
                      </option>
                    ))}
                    <option value={-1}>Тодорхойгүй</option>
                  </select>
                )}
              </PersonRow>
            ))}
            <button
              type="button"
              className="btn"
              onClick={() => setChildren([...children, { ...blank('M'), spouse: filledSpouses.at(-1)?.[0] ?? -1 }])}
            >
              + Хүүхэд нэмэх
            </button>
          </>
        )}

        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn subtle danger-left" onClick={onCancel}>
            Болих
          </button>
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              ← Өмнөх
            </button>
          )}
          <button type="submit" className="btn primary" disabled={saving}>
            {last ? 'Дуусгах' : 'Дараах →'}
          </button>
        </div>
      </form>
    </main>
  )
}
