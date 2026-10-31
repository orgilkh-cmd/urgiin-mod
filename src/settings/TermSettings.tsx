import { useState, type FormEvent } from 'react'
import { saveSetting } from '../db/instance'
import { mnTerms, type TermKey, type Terms } from '../kinship/terms.mn'
import { Dialog } from '../ui/Dialog'
import './settings.css'

/** Section headings, keyed by the first term of each section in mnTerms. */
const SECTIONS: Partial<Record<TermKey, string>> = {
  father: 'Эцэг эх',
  grandfather: 'Өвөг дээдэс',
  son: 'Үр хүүхэд',
  olderBrother: 'Ах эгч дүү',
  paternalUncle: 'Авга, нагац',
  cousinOlderMale: 'Үеэл',
  husband: 'Эхнэр нөхөр, хадам, ураг',
}

/** Shown under the default word, to tell apart keys that share it (Бэр, Хүргэн…). */
const NOTES: Partial<Record<TermKey, string>> = {
  parent: 'хүйс тодорхойгүй',
  grandparent: 'хүйс тодорхойгүй',
  ancestorMale: '{n} = хэд дэх үе',
  ancestorFemale: '{n} = хэд дэх үе',
  ancestor: '{n} = хэд дэх үе',
  child: 'хүйс тодорхойгүй',
  sonsChild: 'хүүгийн хүүхэд',
  daughtersChild: 'охины хүүхэд',
  greatGrandchildViaSon: 'ачийн хүүхэд',
  greatGrandchildViaDaughter: 'зээгийн хүүхэд',
  olderSibling: 'хүйс тодорхойгүй',
  youngerSibling: 'хүйс тодорхойгүй',
  siblingUnknownAge: 'нас тодорхойгүй',
  halfViaFather: 'угтвар: эцэг нэг, эх өөр',
  halfViaMother: 'угтвар: эх нэг, эцэг өөр',
  paternalParentSibling: 'хүйс тодорхойгүй',
  maternalParentSibling: 'хүйс тодорхойгүй',
  cousin: 'нас тодорхойгүй',
  partner: 'гэрлээгүй хань',
  formerPrefix: 'угтвар: салсан эхнэр, нөхөр',
  spouseSibling: 'нас тодорхойгүй',
  olderBrothersWife: 'ахын эхнэр',
  youngerBrothersWife: 'дүүгийн эхнэр',
  brothersWife: 'ах дүүгийн эхнэр, нас тодорхойгүй',
  olderSistersHusband: 'эгчийн нөхөр',
  youngerSistersHusband: 'дүүгийн нөхөр',
  sistersHusband: 'эгч дүүгийн нөхөр, нас тодорхойгүй',
  sonsWife: 'хүүгийн эхнэр',
  daughtersHusband: 'охины нөхөр',
  wifesSistersHusband: 'эхнэрийн эгч дүүгийн нөхөр',
}

interface Props {
  overrides: Partial<Terms>
  onClose: () => void
}

export function TermSettings({ overrides, onClose }: Props) {
  const [draft, setDraft] = useState<Partial<Terms>>(overrides)
  const keys = (Object.keys(mnTerms) as TermKey[]).filter((k) => k !== 'self')
  const changed = Object.keys(draft).length

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const clean: Partial<Terms> = {}
    for (const k of keys) {
      const v = draft[k]?.trim()
      if (v && v !== mnTerms[k]) clean[k] = v
    }
    await saveSetting('terms', clean)
    onClose()
  }

  const set = (k: TermKey, value: string) => {
    const next = { ...draft }
    if (!value || value === mnTerms[k]) delete next[k]
    else next[k] = value
    setDraft(next)
  }

  return (
    <Dialog title="Хамаатны нэр томьёо" onClose={onClose} wide>
      <form className="form" onSubmit={save}>
        <p className="hint">
          Өөрийн гэр бүлд хэрэглэдэг үгээ бичиж болно. Хоосон орхивол үндсэн үг хэрэглэгдэнэ. Солисон үг шар өнгөтэй.
        </p>
        <div className="terms-grid">
          {keys.map((k) => (
            <TermRow key={k} k={k} value={draft[k]} onChange={(v) => set(k, v)} section={SECTIONS[k]} />
          ))}
        </div>
        <div className="form-actions">
          <button type="button" className="btn danger" disabled={!changed} onClick={() => setDraft({})}>
            Бүгдийг анхны болгох
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

function TermRow({ k, value, onChange, section }: { k: TermKey; value?: string; onChange: (v: string) => void; section?: string }) {
  const overridden = value !== undefined
  return (
    <>
      {section && <h3 className="section-title terms-section">{section}</h3>}
      <label className={`term-row${overridden ? ' changed' : ''}`}>
        <span className="term-default">
          {mnTerms[k]}
          {NOTES[k] && <small>{NOTES[k]}</small>}
        </span>
        <input value={value ?? ''} placeholder={mnTerms[k]} onChange={(e) => onChange(e.target.value)} aria-label={mnTerms[k]} />
        {overridden && (
          <button type="button" className="icon-btn" onClick={() => onChange(mnTerms[k])} aria-label="Анхны болгох" title="Анхны болгох">
            ↺
          </button>
        )}
      </label>
    </>
  )
}
