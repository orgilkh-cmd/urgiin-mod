import { useLayoutEffect, useRef, type InputHTMLAttributes } from 'react'
import { convertTyping } from '../translit/latinToCyrillic'

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  onChange: (value: string) => void
  /** Convert typed Latin letters to Cyrillic as you type. */
  convert: boolean
}

export function NameInput({ value, onChange, convert, ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)

  useLayoutEffect(() => {
    if (caret.current !== null && ref.current === document.activeElement) {
      ref.current?.setSelectionRange(caret.current, caret.current)
    }
    caret.current = null
  }, [value])

  return (
    <input
      ref={ref}
      {...rest}
      value={value}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => {
        const next = e.target.value
        const native = e.nativeEvent as InputEvent
        const result = convert && !native.isComposing ? convertTyping(value, next) : null
        if (result) caret.current = result.caret
        onChange(result ? result.value : next)
      }}
    />
  )
}

/** Header toggle for the converter. */
export function ConvertToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="convert-toggle" title="Латин үсгээр бичихэд кирилл болгоно: sh → ш, o' / q → ө, u' / w → ү">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      ABC → АБВ
    </label>
  )
}
