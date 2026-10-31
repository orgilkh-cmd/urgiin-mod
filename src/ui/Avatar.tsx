import type { Person } from '../model/types'

/** Round photo, or the first letter of the name when there is none. */
export function Avatar({ person, url, className = 'avatar' }: { person: Person; url?: string; className?: string }) {
  return (
    <span className={className} aria-hidden>
      {url ? <img src={url} alt="" draggable={false} /> : person.givenName.charAt(0)}
    </span>
  )
}
