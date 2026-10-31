import type { Person } from '../model/types'

export type QuickAdd = 'father' | 'mother' | 'spouse' | 'son' | 'daughter' | 'sibling'

export function quickAddLabel(kind: QuickAdd, anchor: Person): string {
  switch (kind) {
    case 'father':
      return 'Аав'
    case 'mother':
      return 'Ээж'
    case 'spouse':
      return anchor.sex === 'M' ? 'Эхнэр' : anchor.sex === 'F' ? 'Нөхөр' : 'Эхнэр/нөхөр'
    case 'son':
      return 'Хүү'
    case 'daughter':
      return 'Охин'
    case 'sibling':
      return 'Ах/Эгч/Дүү'
  }
}
