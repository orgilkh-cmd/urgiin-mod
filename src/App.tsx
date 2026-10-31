import { useEffect, useMemo, useState } from 'react'
import { BackupDialog } from './backup/BackupDialog'
import { backupDue } from './db/backup'
import { clearAllData, loadSampleFamily, saveSetting, useFamily, useSetting } from './db/instance'
import { AddRelativeDialog } from './edit/AddRelativeDialog'
import { quickAddLabel, type QuickAdd } from './edit/quickAdd'
import { PersonEditor } from './edit/PersonEditor'
import { Wizard } from './edit/Wizard'
import { mnTerms, type Terms } from './kinship/terms.mn'
import { displayName, formatYears } from './model/format'
import type { ID } from './model/types'
import { PeopleSearch } from './search/PeopleSearch'
import { TermSettings } from './settings/TermSettings'
import { TreeView } from './tree/TreeView'
import { useStored } from './ui/storage'
import './App.css'

type Modal =
  | { type: 'edit'; id: ID }
  | { type: 'add'; id: ID; kind: QuickAdd }
  | { type: 'terms' | 'search' | 'backup' }
  | null

export default function App() {
  const data = useFamily()
  const home = useSetting<ID>('homePersonId')
  const sampleLoaded = useSetting<boolean>('sampleLoaded')
  const termOverrides = useSetting<Partial<Terms>>('terms')
  const lastBackupAt = useSetting<string>('lastBackupAt')
  const lastChangeAt = useSetting<string>('lastChangeAt')
  const terms = useMemo(() => ({ ...mnTerms, ...termOverrides }), [termOverrides])

  const [focus, setFocus] = useState<ID | null>(null)
  const [history, setHistory] = useState<ID[]>([])
  const [modal, setModal] = useState<Modal>(null)
  const [wizard, setWizard] = useState(false)
  const [ancestorDepth, setAncestorDepth] = useStored('ancestorDepth', 3)
  const [descendantDepth, setDescendantDepth] = useStored('descendantDepth', 3)
  const [reminderHidden, setReminderHidden] = useState(false)
  // Checked once per visit; the reminder doesn't need to appear mid-session.
  const [openedAt] = useState(() => new Date())

  const hasPeople = !!data?.persons.length

  // Ctrl/⌘+K or "/" opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest('input, textarea, select, dialog')
      if (((e.metaKey || e.ctrlKey) && e.key === 'k') || (e.key === '/' && !typing)) {
        if (!hasPeople || document.querySelector('dialog[open]')) return
        e.preventDefault()
        setModal({ type: 'search' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hasPeople])

  // Ask the browser not to evict the family when space runs low.
  useEffect(() => {
    if (hasPeople && !sampleLoaded) navigator.storage?.persist?.().catch(() => {})
  }, [hasPeople, sampleLoaded])

  const restored = () => {
    setFocus(null)
    setHistory([])
  }

  const backupDialog = modal?.type === 'backup' && (
    <BackupDialog
      people={data?.persons.length ?? 0}
      lastBackupAt={lastBackupAt ?? null}
      onRestored={restored}
      onClose={() => setModal(null)}
    />
  )

  if (data === undefined || home === undefined) return <div className="app" />

  if (wizard) {
    return (
      <div className="app scroll">
        <Wizard
          onCancel={() => setWizard(false)}
          onDone={(me) => {
            setWizard(false)
            setFocus(me)
            setHistory([])
          }}
        />
      </div>
    )
  }

  if (data.persons.length === 0) {
    return (
      <div className="app">
        <main className="empty">
          <h1>Ургийн мод</h1>
          <p>Өөрөөсөө эхлээд эцэг эх, өвөө эмээ, ах дүү, эхнэр нөхөр, хүүхдүүдээ алхам алхмаар оруулна.</p>
          <div className="empty-actions">
            <button type="button" className="btn primary" onClick={() => setWizard(true)}>
              Өөрөөсөө эхлэх
            </button>
            <button type="button" className="btn" onClick={() => loadSampleFamily()}>
              Жишээ гэр бүлээр туршиж үзэх
            </button>
          </div>
          <p className="empty-restore">
            Гэр бүлийнхнээсээ нөөц файл авсан уу?{' '}
            <button type="button" className="link" onClick={() => setModal({ type: 'backup' })}>
              Файлаас сэргээх
            </button>
          </p>
        </main>
        {backupDialog}
      </div>
    )
  }

  const exists = (id: ID | null | undefined): id is ID => !!id && data.persons.some((p) => p.id === id)
  const current = exists(focus) ? focus : exists(home) ? home : data.persons[0].id
  const person = data.persons.find((p) => p.id === current)!

  const go = (id: ID) => {
    if (id === current) return
    setHistory((h) => [...h, current])
    setFocus(id)
  }

  const back = () => {
    const prev = history.at(-1)
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    setFocus(prev)
  }

  const clearSample = () => {
    if (window.confirm('Жишээ гэр бүлийг бүхэлд нь устгах уу?')) {
      setFocus(null)
      setHistory([])
      clearAllData()
    }
  }

  const parents = data.parentLinks
    .filter((l) => l.childId === current && l.kind !== 'step')
    .map((l) => data.persons.find((p) => p.id === l.parentId))
  const hasParent = (sex: 'M' | 'F') => parents.some((p) => p?.sex === sex)
  const quickAdds: QuickAdd[] = [
    ...(hasParent('M') ? [] : (['father'] as const)),
    ...(hasParent('F') ? [] : (['mother'] as const)),
    'spouse',
    'son',
    'daughter',
    'sibling',
  ]

  return (
    <div className="app">
      <header className="toolbar">
        <h1>Ургийн мод</h1>
        <button type="button" className="btn" onClick={back} disabled={!history.length} title="Буцах">
          ← Буцах
        </button>
        {exists(home) && (
          <button type="button" className="btn" onClick={() => go(home)} disabled={current === home}>
            ★ Би
          </button>
        )}
        <button type="button" className="btn" onClick={() => setModal({ type: 'search' })} title="Хайх (⌘K эсвэл /)">
          Хайх
        </button>
        <span className="spacer" />
        <label className="depth">
          Дээш
          <select value={ancestorDepth} onChange={(e) => setAncestorDepth(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="depth">
          Доош
          <select value={descendantDepth} onChange={(e) => setDescendantDepth(Number(e.target.value))}>
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn subtle" onClick={() => setModal({ type: 'terms' })}>
          Нэр томьёо
        </button>
        <button type="button" className="btn subtle" onClick={() => setModal({ type: 'backup' })}>
          Нөөц
        </button>
        {sampleLoaded && (
          <button type="button" className="btn subtle" onClick={clearSample}>
            Жишээг арилгах
          </button>
        )}
      </header>

      {!sampleLoaded && !reminderHidden && backupDue(lastBackupAt ?? null, lastChangeAt ?? null, openedAt) && (
        <div className="reminder" role="status">
          <span>{lastBackupAt ? 'Сүүлийн нөөцөөс хойш өөрчлөлт орсон.' : 'Оруулсан мэдээллээ файл болгон нөөцлөөрэй.'}</span>
          <button type="button" className="btn" onClick={() => setModal({ type: 'backup' })}>
            Нөөцлөх
          </button>
          <button type="button" className="icon-btn" onClick={() => setReminderHidden(true)} aria-label="Дараа">
            ×
          </button>
        </div>
      )}

      <section className="focus-bar" aria-label="Сонгосон хүн">
        <span className="focus-name">{displayName(person)}</span>
        <span className="focus-years">{formatYears(person)}</span>
        <button type="button" className="btn" onClick={() => setModal({ type: 'edit', id: current })}>
          ✎ Засах
        </button>
        {current !== home && (
          <button type="button" className="btn subtle" onClick={() => saveSetting('homePersonId', current)}>
            Энэ бол би
          </button>
        )}
        <span className="quick-adds">
          {quickAdds.map((kind) => {
            const noParents = kind === 'sibling' && parents.length === 0
            return (
              <button
                key={kind}
                type="button"
                className="chip"
                disabled={noParents}
                title={noParents ? 'Ах, эгч, дүүг эцэг эхээр нь холбодог. Эхлээд аав эсвэл ээжийг нэмнэ үү.' : undefined}
                onClick={() => setModal({ type: 'add', id: current, kind })}
              >
                + {quickAddLabel(kind, person)}
              </button>
            )
          })}
        </span>
      </section>

      <TreeView
        data={data}
        terms={terms}
        focus={current}
        onFocus={go}
        onEdit={(id) => setModal({ type: 'edit', id })}
        ancestorDepth={ancestorDepth}
        descendantDepth={descendantDepth}
      />

      {modal?.type === 'edit' && <PersonEditor data={data} personId={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === 'add' && (
        <AddRelativeDialog data={data} anchorId={modal.id} kind={modal.kind} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'search' && (
        <PeopleSearch data={data} terms={terms} focus={current} onPick={go} onClose={() => setModal(null)} />
      )}
      {backupDialog}
      {modal?.type === 'terms' && <TermSettings overrides={termOverrides ?? {}} onClose={() => setModal(null)} />}
    </div>
  )
}
