import type { FuzzyDate } from '../model/types'

const QUALIFIERS: [FuzzyDate['qualifier'], string][] = [
  ['exact', 'Яг'],
  ['about', 'Ойролцоогоор'],
  ['before', 'Өмнө'],
  ['after', 'Хойш'],
  ['decade', '-аад он'],
]

const toNumber = (s: string) => (s.trim() === '' || !Number.isFinite(Number(s)) ? undefined : Number(s))

/** Year (+ optional month/day) with how sure we are. Empty year → undefined. */
export function DateInput({ value, onChange, label }: { value?: FuzzyDate; onChange: (d?: FuzzyDate) => void; label: string }) {
  const set = (patch: Partial<FuzzyDate>) => {
    const next = { qualifier: 'exact' as const, ...value, ...patch }
    onChange(next.year == null ? undefined : next)
  }
  return (
    <fieldset className="date-input">
      <legend>{label}</legend>
      <input
        type="number"
        inputMode="numeric"
        placeholder="Он"
        aria-label={`${label}: он`}
        className="year"
        value={value?.year ?? ''}
        onChange={(e) => set({ year: toNumber(e.target.value) })}
      />
      <input
        type="number"
        inputMode="numeric"
        placeholder="Сар"
        aria-label={`${label}: сар`}
        min={1}
        max={12}
        value={value?.month ?? ''}
        disabled={value?.year == null}
        onChange={(e) => set({ month: toNumber(e.target.value) })}
      />
      <input
        type="number"
        inputMode="numeric"
        placeholder="Өдөр"
        aria-label={`${label}: өдөр`}
        min={1}
        max={31}
        value={value?.day ?? ''}
        disabled={value?.year == null}
        onChange={(e) => set({ day: toNumber(e.target.value) })}
      />
      <select
        aria-label={`${label}: нарийвчлал`}
        value={value?.qualifier ?? 'exact'}
        disabled={value?.year == null}
        onChange={(e) => set({ qualifier: e.target.value as FuzzyDate['qualifier'] })}
      >
        {QUALIFIERS.map(([q, text]) => (
          <option key={q} value={q}>
            {text}
          </option>
        ))}
      </select>
    </fieldset>
  )
}

/** Just the year, for quick entry. */
export function YearInput({ value, onChange, placeholder = 'Төрсөн он' }: { value?: FuzzyDate; onChange: (d?: FuzzyDate) => void; placeholder?: string }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      className="year"
      placeholder={placeholder}
      aria-label={placeholder}
      value={value?.year ?? ''}
      onChange={(e) => {
        const year = toNumber(e.target.value)
        onChange(year == null ? undefined : { ...value, qualifier: value?.qualifier ?? 'exact', year })
      }}
    />
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === value}
          className={v === value ? 'on' : ''}
          onClick={() => onChange(v)}
        >
          {text}
        </button>
      ))}
    </div>
  )
}
