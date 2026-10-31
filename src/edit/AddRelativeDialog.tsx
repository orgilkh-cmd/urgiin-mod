import { useMemo, useState, type FormEvent } from 'react'
import { db } from '../db/instance'
import { addRelative, type RelativeOptions, type Target } from '../db/edit'
import { displayName, formatYears } from '../model/format'
import type { FamilyData, FuzzyDate, ID, ParentLink, Sex, Union } from '../model/types'
import { cleanName, searchKey } from '../translit/latinToCyrillic'
import type { ClanChange } from './ClanSpreadDialog'
import { quickAddLabel, type QuickAdd } from './quickAdd'
import { Dialog } from '../ui/Dialog'
import { Segmented, YearInput } from '../ui/fields'
import { SEX_OPTIONS } from '../ui/options'
import { ConvertToggle, NameInput } from '../ui/NameInput'
import { useStored } from '../ui/storage'

type SiblingType = 'olderBrother' | 'olderSister' | 'youngerBrother' | 'youngerSister'
const SIBLING_TYPES: [SiblingType, string][] = [
  ['olderBrother', 'Ах'],
  ['olderSister', 'Эгч'],
  ['youngerBrother', 'Эрэгтэй дүү'],
  ['youngerSister', 'Эмэгтэй дүү'],
]

const fixedSex: Partial<Record<QuickAdd, Sex>> = { father: 'M', mother: 'F', son: 'M', daughter: 'F' }

interface Props {
  data: FamilyData
  anchorId: ID
  kind: QuickAdd
  onClose: () => void
  onClanChange?: (change: ClanChange) => void
}

export function AddRelativeDialog({ data, anchorId, kind, onClose, onClanChange }: Props) {
  const anchor = data.persons.find((p) => p.id === anchorId)!
  const byId = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data])
  const partners = data.unions
    .filter((u) => (u.partnerIds as ID[]).includes(anchorId))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .flatMap((u) => u.partnerIds.filter((p) => p !== anchorId))

  const [convert, setConvert] = useStored('translit', true)
  const [mode, setMode] = useState<'new' | 'existing'>('new')
  const [givenName, setGivenName] = useState('')
  const [patronymic, setPatronymic] = useState<string | null>(null)
  const [clan, setClan] = useState<string | null>(null)
  const [sex, setSex] = useState<Sex>(
    fixedSex[kind] ?? (kind === 'spouse' ? (anchor.sex === 'M' ? 'F' : anchor.sex === 'F' ? 'M' : 'U') : 'M'),
  )
  const [siblingType, setSiblingType] = useState<SiblingType>('youngerBrother')
  const [birth, setBirth] = useState<FuzzyDate | undefined>()
  const [deceased, setDeceased] = useState(false)
  // Latest union by default: usually the current spouse.
  const [partnerId, setPartnerId] = useState<ID | ''>(partners.at(-1) ?? '')
  const [linkKind, setLinkKind] = useState<ParentLink['kind']>('birth')
  const [endReason, setEndReason] = useState<Union['endReason'] | ''>('')
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<ID | null>(null)
  const [error, setError] = useState('')

  const isChild = kind === 'son' || kind === 'daughter'
  const effectiveSex: Sex =
    kind === 'sibling' ? (siblingType === 'olderBrother' || siblingType === 'youngerBrother' ? 'M' : 'F') : sex

  // Children take their father's name; siblings share the anchor's.
  const suggestedPatronymic = (() => {
    if (isChild) {
      const father = anchor.sex === 'M' ? anchor : partnerId ? byId.get(partnerId) : undefined
      return father?.sex === 'M' ? father.givenName : ''
    }
    return kind === 'sibling' ? (anchor.patronymic ?? '') : ''
  })()
  const patronymicValue = patronymic ?? suggestedPatronymic

  // Ургийн овог comes from the father (the mother's when he's unknown); wives keep their own.
  const suggestedClan = (() => {
    if (isChild) {
      const partner = partnerId ? byId.get(partnerId) : undefined
      const father = anchor.sex === 'M' ? anchor : partner?.sex === 'M' ? partner : undefined
      return (father ?? anchor).clanName ?? ''
    }
    return kind === 'father' || kind === 'sibling' ? (anchor.clanName ?? '') : ''
  })()
  const clanValue = clan ?? suggestedClan

  const candidates = useMemo(() => {
    const q = searchKey(query)
    return data.persons
      .filter((p) => p.id !== anchorId)
      .filter((p) => !q || searchKey(`${p.givenName} ${p.patronymic ?? ''}`).includes(q))
      .sort((a, b) => a.givenName.localeCompare(b.givenName, 'mn'))
      .slice(0, 50)
  }, [data, anchorId, query])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    let target: Target
    if (mode === 'existing') {
      if (!picked) return setError('Жагсаалтаас хүнээ сонгоно уу.')
      target = { existingId: picked }
    } else {
      const name = cleanName(givenName)
      if (!name) return setError('Нэрээ бичнэ үү.')
      target = {
        person: {
          givenName: name,
          patronymic: cleanName(patronymicValue) || undefined,
          clanName: cleanName(clanValue) || undefined,
          sex: effectiveSex,
          birth,
          isLiving: !deceased,
        },
      }
    }
    const options: RelativeOptions = {}
    if (kind === 'father' || kind === 'mother' || isChild) options.kind = linkKind
    if (isChild) options.partnerId = partnerId || null
    if (kind === 'spouse' && endReason) options.union = { endReason }
    if (kind === 'sibling') options.older = siblingType.startsWith('older')
    try {
      const id = await addRelative(db, anchorId, kind === 'father' || kind === 'mother' ? 'parent' : isChild ? 'child' : kind, target, options)
      onClose()
      // A new parent with a clan: their children may not have one yet.
      const clanName = 'person' in target ? target.person.clanName : undefined
      if (clanName && (kind === 'father' || kind === 'mother')) onClanChange?.({ id, to: clanName })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <Dialog
      title={`${quickAddLabel(kind, anchor)} нэмэх · ${displayName(anchor)}`}
      onClose={onClose}
      actions={<ConvertToggle on={convert} onChange={setConvert} />}
    >
      <form className="form" onSubmit={submit}>
        <Segmented
          label="Шинэ эсвэл байгаа хүн"
          value={mode}
          options={[
            ['new', 'Шинэ хүн'],
            ['existing', 'Модонд байгаа хүн'],
          ]}
          onChange={setMode}
        />

        {kind === 'sibling' && (
          <Segmented label="Хэн бэ" value={siblingType} options={SIBLING_TYPES} onChange={setSiblingType} />
        )}

        {mode === 'new' ? (
          <>
            <label className="field">
              Нэр *
              <NameInput convert={convert} value={givenName} onChange={setGivenName} autoFocus placeholder={convert ? 'Bat-Erdene → Бат-Эрдэнэ' : ''} />
            </label>
            <div className="row">
              <label className="field">
                Эцэг/эхийн нэр
                <NameInput convert={convert} value={patronymicValue} onChange={setPatronymic} />
              </label>
              <label className="field">
                Ургийн овог
                <NameInput convert={convert} value={clanValue} onChange={setClan} />
              </label>
            </div>
            <label className="field">
              Төрсөн он
              <YearInput value={birth} onChange={setBirth} />
            </label>
            {kind === 'spouse' && (
              <div className="field">
                Хүйс
                <Segmented label="Хүйс" value={sex} options={SEX_OPTIONS} onChange={setSex} />
              </div>
            )}
            <label className="check">
              <input type="checkbox" checked={deceased} onChange={(e) => setDeceased(e.target.checked)} />
              Нас барсан
            </label>
          </>
        ) : (
          <>
            <label className="field">
              Хайх
              <NameInput convert={convert} value={query} onChange={setQuery} autoFocus placeholder="Нэрээр хайх" />
            </label>
            <ul className="pick-list">
              {candidates.map((p) => (
                <li key={p.id}>
                  <button type="button" className={picked === p.id ? 'on' : ''} onClick={() => setPicked(p.id)} aria-pressed={picked === p.id}>
                    <span>{displayName(p)}</span>
                    <small>{formatYears(p)}</small>
                  </button>
                </li>
              ))}
              {!candidates.length && <p className="hint">Олдсонгүй.</p>}
            </ul>
          </>
        )}

        {isChild && partners.length > 0 && (
          <label className="field">
            {anchor.sex === 'F' ? 'Эцэг нь' : 'Эх нь'}
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              {partners.map((id) => (
                <option key={id} value={id}>
                  {byId.get(id) ? displayName(byId.get(id)!) : '?'}
                </option>
              ))}
              <option value="">Тодорхойгүй</option>
            </select>
          </label>
        )}

        {(kind === 'father' || kind === 'mother' || isChild) && (
          <div className="field">
            Холбоо
            <Segmented
              label="Холбоо"
              value={linkKind}
              options={[
                ['birth', 'Төрсөн'],
                ['adopted', 'Өргөмөл'],
                ['step', kind === 'father' || kind === 'mother' ? 'Хойт' : 'Дагавар'],
              ]}
              onChange={setLinkKind}
            />
          </div>
        )}

        {kind === 'spouse' && (
          <label className="field">
            Байдал
            <select value={endReason} onChange={(e) => setEndReason(e.target.value as Union['endReason'] | '')}>
              <option value="">Хамт байгаа</option>
              <option value="divorce">Салсан</option>
              <option value="separation">Тусдаа</option>
              <option value="death">Нас барснаар</option>
            </select>
          </label>
        )}

        {error && <p className="error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Болих
          </button>
          <button type="submit" className="btn primary">
            Нэмэх
          </button>
        </div>
      </form>
    </Dialog>
  )
}
