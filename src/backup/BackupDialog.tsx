import { useEffect, useRef, useState } from 'react'
import { createBackup, parseBackup, restoreBackup } from '../db/backup'
import { db } from '../db/instance'
import { Dialog } from '../ui/Dialog'

interface Props {
  people: number
  lastBackupAt: string | null
  onRestored: () => void
  onClose: () => void
}

function download(file: File) {
  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = file.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const canShareFiles = () => {
  try {
    return !!navigator.canShare?.({ files: [new File(['{}'], 'x.json', { type: 'application/json' })] })
  } catch {
    return false
  }
}

/** "2026-10-31 17:22" — browsers have no reliable Mongolian date format. */
function formatDate(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function BackupDialog({ people, lastBackupAt, onRestored, onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  const save = async (share: boolean) => {
    setError('')
    const file = await createBackup(db)
    if (share) {
      try {
        await navigator.share({ files: [file], title: 'Ургийн мод' })
      } catch (err) {
        // Closing the share sheet is not an error.
        if (!(err instanceof DOMException && err.name === 'AbortError')) setError(String(err))
        return
      }
    } else {
      download(file)
    }
    setMessage(`Хадгаллаа: ${file.name}`)
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setMessage('')
    try {
      const backup = parseBackup(await file.text())
      const incoming = backup.data.persons.length
      const question = people
        ? `Энэ төхөөрөмж дээрх ${people} хүний мэдээллийг файлын ${incoming} хүнээр солих уу? Одоогийн мэдээлэл устна.`
        : `Файлаас ${incoming} хүн оруулах уу?`
      if (!window.confirm(question)) return
      await restoreBackup(db, backup)
      onRestored()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <Dialog title="Нөөцлөх ба сэргээх" onClose={onClose}>
      <div className="form">
        <p className="hint">
          Мэдээлэл зөвхөн энэ төхөөрөмж дээр хадгалагддаг, интернэтэд гардаггүй. Төхөөрөмж солигдох, хөтчийн өгөгдөл
          цэвэрлэгдэхэд алга болохоос сэргийлж үе үе файл болгон хадгалаарай. Тэр файлаа хүүхдүүддээ AirDrop эсвэл Drive-аар
          өгвөл тэд өөрсдийн төхөөрөмж дээр сэргээж харна.
        </p>
        <p className="hint">
          Сүүлд нөөцөлсөн: <strong>{lastBackupAt ? formatDate(lastBackupAt) : 'хэзээ ч'}</strong>
          {persisted === false && ' · Хөтөч зай багасахад өгөгдлийг устгаж болзошгүй. Апп болгон суулгавал илүү найдвартай.'}
        </p>

        <div className="form-actions backup-actions">
          <button type="button" className="btn primary" onClick={() => save(false)} disabled={!people}>
            Файл болгон хадгалах
          </button>
          {canShareFiles() && (
            <button type="button" className="btn" onClick={() => save(true)} disabled={!people}>
              Хуваалцах…
            </button>
          )}
          <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
            Файлаас сэргээх…
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => restore(e.target.files?.[0])}
          />
        </div>
        {message && <p className="hint">{message}</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </Dialog>
  )
}
