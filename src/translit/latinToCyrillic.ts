// Latin → Mongolian Cyrillic, following the krilleer.blogspot.com keyboard rules.

const DIGRAPHS: Record<string, string> = {
  ch: 'ч',
  sh: 'ш',
  ye: 'е',
  yo: 'ё',
  yu: 'ю',
  ya: 'я',
  "o'": 'ө',
  "u'": 'ү',
}

const SINGLE: Record<string, string> = {
  a: 'а', b: 'б', v: 'в', g: 'г', d: 'д', e: 'э', j: 'ж', z: 'з', i: 'и',
  k: 'к', l: 'л', m: 'м', n: 'н', o: 'о', q: 'ө', p: 'п', r: 'р', s: 'с',
  t: 'т', u: 'у', w: 'ү', f: 'ф', h: 'х', c: 'ц', y: 'ы', '"': 'ъ', "'": 'ь',
}

/** `i` after one of these becomes й: ai → ай, oi → ой. */
const SHORT_I_AFTER = new Set(['а', 'о', 'у', 'ү', 'и', 'э'])

/** Typed between two letters to stop a digraph: s|h → сх. */
export const SEPARATOR = '|'

const isUpper = (ch: string) => ch !== ch.toLowerCase()

/**
 * Converts Latin letters; anything else (Cyrillic, digits, spaces, "-") passes through.
 * `before` is the text already in front of `input`, for the ai → ай rule.
 */
export function latinToCyrillic(input: string, before = ''): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === SEPARATOR) {
      i++
      continue
    }
    const lower = ch.toLowerCase()
    const pair = input.slice(i, i + 2).toLowerCase()
    let cyr: string | undefined
    let length = 1
    if (DIGRAPHS[pair]) {
      cyr = DIGRAPHS[pair]
      length = 2
    } else if (lower === 'i' && SHORT_I_AFTER.has((out || before).at(-1)?.toLowerCase() ?? '')) {
      cyr = 'й'
    } else {
      cyr = SINGLE[lower]
    }
    if (cyr === undefined) {
      out += ch
      i++
      continue
    }
    out += isUpper(ch) ? cyr.toUpperCase() : cyr
    i += length
  }
  return out
}

/** Cyrillic letters that may still become a digraph: с + h → ш, ы + a → я, о + ' → ө. */
const DIGRAPH_START: Record<string, string> = { ц: 'c', с: 's', ы: 'y', о: 'o', у: 'u' }

const LATIN = /[a-z'"|]/i

/**
 * Live conversion for a text field. Given the field's value before and after an edit,
 * converts only the inserted text and returns the new value and caret position,
 * or null when nothing needs converting (deletions, Cyrillic typing).
 *
 * Typing letter by letter still forms digraphs: "s" → "с", then "h" turns it into "ш".
 * A typed "|" stays visible until the next letter so that letter won't combine.
 */
export function convertTyping(prev: string, next: string): { value: string; caret: number } | null {
  let start = 0
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++
  let end = 0
  while (
    end < prev.length - start &&
    end < next.length - start &&
    prev[prev.length - 1 - end] === next[next.length - 1 - end]
  ) end++
  const inserted = next.slice(start, next.length - end)
  if (!inserted || !LATIN.test(inserted) || inserted === SEPARATOR) return null

  let before = next.slice(0, start)
  const after = next.slice(next.length - end)
  let input = inserted
  const last = before.at(-1) ?? ''
  if (last === SEPARATOR) {
    before = before.slice(0, -1)
  } else {
    const back = DIGRAPH_START[last.toLowerCase()]
    if (back) {
      before = before.slice(0, -1)
      input = (isUpper(last) ? back.toUpperCase() : back) + input
    }
  }
  const converted = latinToCyrillic(input, before)
  return { value: before + converted + after, caret: before.length + converted.length }
}

/** Final clean-up of a converted field: drops leftover separators and outer spaces. */
export function cleanName(value: string): string {
  return value.replaceAll(SEPARATOR, '').trim()
}

/** Lower-case Cyrillic form for name search, so "bat" finds "Бат". */
export const searchKey = (s: string) => latinToCyrillic(s).toLowerCase().trim()
