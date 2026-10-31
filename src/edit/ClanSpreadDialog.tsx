import { useEffect, useMemo, useState } from 'react'
import { setClan } from '../db/edit'
import { db } from '../db/instance'
import { planClanChange } from '../kinship/clan'
import { FamilyGraph } from '../kinship/graph'
import { displayName } from '../model/format'
import type { FamilyData, ID } from '../model/types'
import { Dialog } from '../ui/Dialog'

export interface ClanChange {
  id: ID
  from?: string
  to: string
}

interface Props extends ClanChange {
  data: FamilyData
  onClose: () => void
}

/** After someone's clan changes: offer it to the children and grandchildren who carry it. */
export function ClanSpreadDialog({ data, id, from, to, onClose }: Props) {
  const graph = useMemo(() => new FamilyGraph(data), [data])
  const [include, setInclude] = useState<Set<ID>>(new Set())
  // Planned once from the data as it was when the dialog opened, so saving doesn't reshuffle it.
  const [initial] = useState(() => planClanChange(graph, id, from, to))
  const plan = planClanChange(graph, id, from, to, include)
  const nothing = !initial.apply.length && !initial.conflicts.length

  useEffect(() => {
    if (nothing) onClose()
  }, [nothing, onClose])
  if (nothing) return null

  const person = graph.person(id)
  const name = (pid: ID) => {
    const p = graph.person(pid)
    return p ? displayName(p) : '?'
  }
  const auto = plan.apply.filter((pid) => !plan.conflicts.some((c) => c.id === pid))
  const toggle = (pid: ID, on: boolean) => {
    const next = new Set(include)
    if (on) next.add(pid)
    else next.delete(pid)
    setInclude(next)
  }

  const apply = async () => {
    if (plan.apply.length) await setClan(db, plan.apply, to)
    onClose()
  }

  return (
    <Dialog title="Ургийн овгийг үр удамд өгөх үү?" onClose={onClose}>
      <div className="form">
        <p className="hint">
          <strong>{person && displayName(person)}</strong> — ургийн овог «{to}». Ургийн овог эцгээс хүүхдэд дамждаг (эцэг нь
          тодорхойгүй бол эхээс). Эхнэр, бэр нь өөрийн овгоо хадгална.
        </p>
        {auto.length > 0 && (
          <>
            <h3 className="section-title">«{to}» болох хүмүүс · {auto.length}</h3>
            <p className="chips">
              {auto.map((pid) => (
                <span key={pid} className="badge">
                  {name(pid)}
                </span>
              ))}
            </p>
          </>
        )}
        {plan.conflicts.length > 0 && (
          <>
            <h3 className="section-title">Өөр овогтой · {plan.conflicts.length}</h3>
            <p className="hint">Өргөмөл, эхийн овгоор явдаг гэх мэт шалтгаантай байж болно. Солих хүнээ сонгоно уу.</p>
            <ul className="rel-list">
              {plan.conflicts.map((c) => (
                <li key={c.id}>
                  <label className="check">
                    <input type="checkbox" checked={include.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                    {name(c.id)} <small>одоо «{c.clan}»</small>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Үгүй
          </button>
          <button type="button" className="btn primary" onClick={apply} disabled={!plan.apply.length}>
            {plan.apply.length} хүнд өгөх
          </button>
        </div>
      </div>
    </Dialog>
  )
}
