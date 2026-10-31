import { useEffect, useRef, type ReactNode } from 'react'
import './ui.css'

interface Props {
  title: ReactNode
  onClose: () => void
  /** Extra controls in the header, right of the title. */
  actions?: ReactNode
  wide?: boolean
  children: ReactNode
}

/** Modal built on <dialog>: Esc and the backdrop close it. */
export function Dialog({ title, onClose, actions, wide, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el && !el.open) el.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' wide' : ''}`}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onMouseDown={(e) => e.target === ref.current && onClose()}
    >
      <header className="dialog-head">
        <h2>{title}</h2>
        {actions}
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Хаах">
          ×
        </button>
      </header>
      <div className="dialog-body">{children}</div>
    </dialog>
  )
}
