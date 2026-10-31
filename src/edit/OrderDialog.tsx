import { useState } from 'react'
import { setBirthOrder } from '../db/edit'
import { db, usePhotos } from '../db/instance'
import { displayName, formatYears } from '../model/format'
import type { FamilyData, ID } from '../model/types'
import { Avatar } from '../ui/Avatar'
import { Dialog } from '../ui/Dialog'
import { childrenOf } from './order'

interface Props {
  data: FamilyData
  /** Orders all children of these parents (birth and adopted) together. */
  parentIds: ID[]
  /** Shown highlighted, e.g. the person the dialog was opened from. */
  highlight?: ID
  onClose: () => void
}

/** Oldest to youngest, moved with arrows; saved as birth order 1, 2, 3… */
export function OrderDialog({ data, parentIds, highlight, onClose }: Props) {
  const photos = usePhotos()
  const [order, setOrder] = useState(() => childrenOf(data, parentIds))
  const parents = data.persons.filter((p) => parentIds.includes(p.id))
  const withYears = order.filter((p) => p.birth?.year != null).length

  const move = (i: number, step: -1 | 1) => {
    const next = [...order]
    ;[next[i], next[i + step]] = [next[i + step], next[i]]
    setOrder(next)
  }

  const save = async () => {
    await setBirthOrder(db, order.map((p) => p.id))
    onClose()
  }

  return (
    <Dialog title={`${parents.map((p) => p.givenName).join(', ')} — хүүхдүүдийн дараалал`} onClose={onClose}>
      <div className="form">
        <p className="hint">Хамгийн томоос нь бага руу. Сумаар зөөнө.</p>
        <ol className="order-list">
          {order.map((p, i) => (
            <li key={p.id} className={p.id === highlight ? 'on' : undefined}>
              <span className="order-n">{i + 1}</span>
              <Avatar person={p} url={p.photoId ? photos.get(p.photoId) : undefined} />
              <span className="who">
                {displayName(p)} <small>{formatYears(p)}</small>
              </span>
              <button type="button" className="icon-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`${p.givenName}: дээш`}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                aria-label={`${p.givenName}: доош`}
              >
                ↓
              </button>
            </li>
          ))}
        </ol>
        {withYears >= 2 && (
          <p className="hint">Төрсөн он нь бичигдсэн хүмүүсийг хооронд нь он нь шийднэ; дараалал нь он мэдэгдэхгүй хүмүүст хэрэглэгдэнэ.</p>
        )}
        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>
            Болих
          </button>
          <button type="button" className="btn primary" onClick={save}>
            Хадгалах
          </button>
        </div>
      </div>
    </Dialog>
  )
}
