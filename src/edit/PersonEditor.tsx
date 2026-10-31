import { useState, type FormEvent } from 'react'
import { db } from '../db/instance'
import { deleteParentLink, deletePerson, deleteUnion, updateParentLink, updatePerson, updateUnion } from '../db/edit'
import { displayName, formatYears } from '../model/format'
import type { FamilyData, ID, ParentLink, Person, Union } from '../model/types'
import { cleanName } from '../translit/latinToCyrillic'
import type { ClanChange } from './ClanSpreadDialog'
import { Dialog } from '../ui/Dialog'
import { DateInput, Segmented } from '../ui/fields'
import { SEX_OPTIONS } from '../ui/options'
import { ConvertToggle, NameInput } from '../ui/NameInput'
import { useStored } from '../ui/storage'

interface Props {
  data: FamilyData
  personId: ID
  onClose: () => void
  /** Saved with a new clan: lets the caller offer it to the descendants. */
  onClanChange?: (change: ClanChange) => void
}

const LINK_KINDS: [ParentLink['kind'], string][] = [
  ['birth', 'Төрсөн'],
  ['adopted', 'Өргөмөл'],
  ['step', 'Хойт / дагавар'],
]

const END_REASONS: [NonNullable<Union['endReason']> | '', string][] = [
  ['', 'Хамт байгаа'],
  ['divorce', 'Салсан'],
  ['separation', 'Тусдаа'],
  ['death', 'Нас барснаар'],
]

export function PersonEditor({ data, personId, onClose, onClanChange }: Props) {
  const person = data.persons.find((p) => p.id === personId)
  const [draft, setDraft] = useState<Person | undefined>(person)
  const [convert, setConvert] = useStored('translit', true)
  if (!person || !draft) return null

  const set = (patch: Partial<Person>) => setDraft({ ...draft, ...patch })
  const name = (id: ID) => {
    const p = data.persons.find((x) => x.id === id)
    return p ? displayName(p) : '?'
  }
  const years = (id: ID) => {
    const p = data.persons.find((x) => x.id === id)
    return p ? formatYears(p) : ''
  }

  const parentLinks = data.parentLinks.filter((l) => l.childId === personId)
  const childLinks = data.parentLinks.filter((l) => l.parentId === personId)
  const unions = data.unions
    .filter((u) => (u.partnerIds as ID[]).includes(personId))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const givenName = cleanName(draft.givenName)
    if (!givenName) return
    const { id: _id, createdAt: _c, ...fields } = draft
    const clanName = cleanName(draft.clanName ?? '') || undefined
    await updatePerson(db, personId, {
      ...fields,
      givenName,
      patronymic: cleanName(draft.patronymic ?? '') || undefined,
      clanName,
      notes: draft.notes?.trim() || undefined,
      death: draft.isLiving ? undefined : draft.death,
    })
    onClose()
    if (clanName && clanName !== person.clanName) onClanChange?.({ id: personId, from: person.clanName, to: clanName })
  }

  const remove = async () => {
    if (!window.confirm(`${displayName(person)} — энэ хүнийг бүх холбоосын хамт устгах уу?`)) return
    await deletePerson(db, personId)
    onClose()
  }

  const unlink = (text: string, action: () => Promise<void>) => {
    if (window.confirm(text)) action()
  }

  return (
    <Dialog title="Хүний мэдээлэл" onClose={onClose} actions={<ConvertToggle on={convert} onChange={setConvert} />}>
      <form className="form" onSubmit={save}>
        <label className="field">
          Нэр *
          <NameInput convert={convert} value={draft.givenName} onChange={(givenName) => set({ givenName })} required autoFocus />
        </label>
        <div className="row">
          <label className="field">
            Эцэг/эхийн нэр
            <NameInput convert={convert} value={draft.patronymic ?? ''} onChange={(patronymic) => set({ patronymic })} />
          </label>
          <label className="field">
            Ургийн овог
            <NameInput convert={convert} value={draft.clanName ?? ''} onChange={(clanName) => set({ clanName })} />
          </label>
        </div>
        <div className="field">
          Хүйс
          <Segmented label="Хүйс" value={draft.sex} options={SEX_OPTIONS} onChange={(sex) => set({ sex })} />
        </div>
        <DateInput label="Төрсөн" value={draft.birth} onChange={(birth) => set({ birth })} />
        <label className="check">
          <input type="checkbox" checked={!draft.isLiving} onChange={(e) => set({ isLiving: !e.target.checked })} />
          Нас барсан
        </label>
        {!draft.isLiving && <DateInput label="Нас барсан" value={draft.death} onChange={(death) => set({ death })} />}
        <label className="field">
          Төрсөн дараалал
          <input
            type="number"
            min={1}
            value={draft.birthOrder ?? ''}
            onChange={(e) => set({ birthOrder: e.target.value ? Number(e.target.value) : undefined })}
          />
          <span className="hint">Төрсөн он мэдэгдэхгүй үед ах, дүүг ялгахад хэрэглэнэ. 1 = хамгийн том.</span>
        </label>
        <label className="field">
          Тэмдэглэл
          <textarea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
        </label>

        {parentLinks.length > 0 && (
          <>
            <h3 className="section-title">Эцэг эх</h3>
            <ul className="rel-list">
              {parentLinks.map((l) => (
                <li key={l.id}>
                  <span className="who">
                    {name(l.parentId)} <small>{years(l.parentId)}</small>
                  </span>
                  <select
                    aria-label="Холбоосын төрөл"
                    value={l.kind}
                    onChange={(e) => updateParentLink(db, l.id, e.target.value as ParentLink['kind'])}
                  >
                    {LINK_KINDS.map(([k, t]) => (
                      <option key={k} value={k}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Холбоосыг арилгах"
                    title="Холбоосыг арилгах"
                    onClick={() => unlink(`${name(l.parentId)} — холбоосыг арилгах уу?`, () => deleteParentLink(db, l.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {unions.length > 0 && (
          <>
            <h3 className="section-title">Эхнэр / нөхөр</h3>
            <ul className="rel-list">
              {unions.map((u) => {
                const partner = u.partnerIds.find((p) => p !== personId)
                return (
                  <li key={u.id}>
                    <span className="who">
                      {partner ? name(partner) : '?'} <small>{partner && years(partner)}</small>
                    </span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label="Гэрлэлтийг арилгах"
                      title="Гэрлэлтийг арилгах (хүүхдүүд хэвээр үлдэнэ)"
                      onClick={() => unlink('Энэ гэрлэлтийг арилгах уу? Хүүхдүүд хоёр эцэг эхтэйгээ холбоотой хэвээр үлдэнэ.', () => deleteUnion(db, u.id))}
                    >
                      ×
                    </button>
                    <div className="form-inline">
                      <select
                        aria-label="Төрөл"
                        value={u.type}
                        onChange={(e) => updateUnion(db, u.id, { type: e.target.value as Union['type'] })}
                      >
                        <option value="married">Гэрлэсэн</option>
                        <option value="partner">Хамтран амьдарсан</option>
                      </select>
                      <select
                        aria-label="Байдал"
                        value={u.endReason ?? ''}
                        onChange={(e) =>
                          updateUnion(db, u.id, { endReason: (e.target.value || undefined) as Union['endReason'] })
                        }
                      >
                        {END_REASONS.map(([r, t]) => (
                          <option key={r} value={r}>
                            {t}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        aria-label="Хэд дэх гэрлэлт"
                        title="Хэд дэх гэрлэлт"
                        placeholder="Дараалал"
                        min={1}
                        value={u.order ?? ''}
                        onChange={(e) => updateUnion(db, u.id, { order: e.target.value ? Number(e.target.value) : undefined })}
                      />
                      <input
                        type="number"
                        aria-label="Гэрлэсэн он"
                        placeholder="Гэрлэсэн он"
                        value={u.start?.year ?? ''}
                        onChange={(e) =>
                          updateUnion(db, u.id, {
                            start: e.target.value ? { year: Number(e.target.value), qualifier: 'exact' } : undefined,
                          })
                        }
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        {childLinks.length > 0 && (
          <>
            <h3 className="section-title">Хүүхдүүд</h3>
            <ul className="rel-list">
              {childLinks.map((l) => (
                <li key={l.id}>
                  <span className="who">
                    {name(l.childId)} <small>{years(l.childId)}</small>
                  </span>
                  <small>{LINK_KINDS.find(([k]) => k === l.kind)?.[1]}</small>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Холбоосыг арилгах"
                    title="Холбоосыг арилгах"
                    onClick={() => unlink(`${name(l.childId)} — холбоосыг арилгах уу?`, () => deleteParentLink(db, l.id))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="form-actions">
          <button type="button" className="btn danger" onClick={remove}>
            Устгах
          </button>
          <button type="button" className="btn" onClick={onClose}>
            Болих
          </button>
          <button type="submit" className="btn primary">
            Хадгалах
          </button>
        </div>
      </form>
    </Dialog>
  )
}
