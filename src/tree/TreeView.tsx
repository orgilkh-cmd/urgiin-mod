import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { FamilyGraph } from '../kinship/graph'
import { Kinship } from '../kinship/kinship'
import type { Terms } from '../kinship/terms.mn'
import type { FamilyData, ID } from '../model/types'
import { CARD_H, CARD_W, layoutTree } from './layout'
import { PersonCard } from './PersonCard'
import './tree.css'

interface Props {
  data: FamilyData
  terms: Terms
  focus: ID
  onFocus: (id: ID) => void
  /** Double-click on a card. */
  onEdit?: (id: ID) => void
  ancestorDepth: number
  descendantDepth: number
}

interface View {
  x: number
  y: number
  zoom: number
}

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2
const clamp = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))
/** Pointer travel before a press counts as a drag rather than a click. */
const DRAG_THRESHOLD = 5

export function TreeView({ data, terms, focus, onFocus, onEdit, ancestorDepth, descendantDepth }: Props) {
  const graph = useMemo(() => new FamilyGraph(data), [data])
  const kinship = useMemo(() => new Kinship(graph, terms), [graph, terms])
  const layout = useMemo(
    () => layoutTree(graph, focus, { ancestorDepth, descendantDepth }),
    [graph, focus, ancestorDepth, descendantDepth],
  )
  const people = useMemo(() => new Map(data.persons.map((p) => [p.id, p])), [data])

  const viewportRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 0, zoom: 1 })
  // Animate the canvas only for focus changes, not while the user pans or zooms.
  const [animate, setAnimate] = useState(false)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)

  const focusCard = layout.cards.find((c) => c.id === focus)
  const focusX = focusCard?.x
  const focusY = focusCard?.y

  // Keep the focus person centered whenever the focus or layout changes.
  const mounted = useRef(false)
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el || focusX === undefined || focusY === undefined) return
    setAnimate(mounted.current)
    mounted.current = true
    setView((v) => ({
      ...v,
      x: el.clientWidth / 2 - (focusX + CARD_W / 2) * v.zoom,
      y: el.clientHeight * 0.45 - (focusY + CARD_H / 2) * v.zoom,
    }))
  }, [focus, focusX, focusY])

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setAnimate(false)
    setView((v) => {
      const zoom = clamp(v.zoom * factor)
      return { zoom, x: px - (px - v.x) * (zoom / v.zoom), y: py - (py - v.y) * (zoom / v.zoom) }
    })
  }, [])

  const zoomCenter = (factor: number) => {
    const el = viewportRef.current
    if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor)
  }

  const fit = () => {
    const el = viewportRef.current
    if (!el) return
    const { minX, minY, maxX, maxY } = layout.bounds
    const pad = 32
    const zoom = clamp(Math.min((el.clientWidth - pad * 2) / (maxX - minX), (el.clientHeight - pad * 2) / (maxY - minY), 1))
    setAnimate(true)
    setView({
      zoom,
      x: (el.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (el.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom,
    })
  }

  // Wheel pans; pinch (ctrl+wheel) zooms. Registered natively so it can preventDefault.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey) {
        const rect = el.getBoundingClientRect()
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, Math.exp(-e.deltaY * 0.01))
      } else {
        setAnimate(false)
        setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.pointerId !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      d.moved = true
      setDragging(true)
      setAnimate(false)
      // Capture only once it is a drag, so plain clicks still reach the cards.
      viewportRef.current?.setPointerCapture(e.pointerId)
    }
    d.x = e.clientX
    d.y = e.clientY
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  const onPointerUp = () => {
    suppressClick.current = drag.current?.moved ?? false
    drag.current = null
    setDragging(false)
  }

  const select = (id: ID) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    onFocus(id)
  }

  return (
    <div
      ref={viewportRef}
      className={`viewport${dragging ? ' dragging' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className={`canvas${animate ? ' animate' : ''}`}
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg className="tree-lines" key={`${focus}|${ancestorDepth}|${descendantDepth}`} aria-hidden>
          {layout.lines.map((pts, i) => (
            <polyline key={i} points={pts.map((p) => p.join(',')).join(' ')} />
          ))}
        </svg>
        {layout.cards.map((c) => {
          const person = people.get(c.id)
          return (
            person && (
              <PersonCard key={c.id} card={c} person={person} relation={kinship.relate(focus, c.id)} onSelect={select} onEdit={onEdit} />
            )
          )
        })}
      </div>

      <div className="zoom-controls" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => zoomCenter(1 / 1.2)} aria-label="Жижигрүүлэх">
          −
        </button>
        <span>{Math.round(view.zoom * 100)}%</span>
        <button type="button" onClick={() => zoomCenter(1.2)} aria-label="Томруулах">
          +
        </button>
        <button type="button" onClick={fit} title="Бүгдийг харах">
          ⤢
        </button>
      </div>

      <div className="legend" aria-hidden>
        <span><i className="swatch paternal" />Аавын тал</span>
        <span><i className="swatch maternal" />Ээжийн тал</span>
        <span><i className="swatch deceased" />Нас барсан</span>
      </div>
    </div>
  )
}
