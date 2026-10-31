# Family Tree App — V1 Spec

Status: approved direction, 2026-10-31. Language: Mongolian Cyrillic only (English/Japanese later).
Audience: me and my sons — understanding our family. ~100 people, may grow to a few hundred.

---

## 1. Approach

| Decision | Choice |
|---|---|
| Order of work | Data model + kinship engine first → tree UI → data entry → polish/deploy |
| Framework | React + TypeScript + Vite |
| Storage | IndexedDB via Dexie (local-first, offline) |
| App type | PWA — installable on Mac / iPhone / sons' devices |
| Hosting | Static (GitHub Pages or Netlify). Only app code is online; family data stays on the device |
| Sharing | Export / import a `.json` file (AirDrop, shared Drive folder) |
| Tree layout | Custom focus-centered layout using `d3-hierarchy` |
| i18n | All UI strings and kinship terms in locale files, so en/ja can be added later |

**Term rule:** prefer simple, commonly understood words. When no common word exists, describe the path ("Үеэлийн хүүхэд") instead of using a rare term. Every term is editable on a settings screen.

---

## 2. V1 features

### Data
- Person: given name, patronymic (эцгийн нэр), clan name (ургийн овог), sex, birth/death date, living/deceased, photo, notes.
- Approximate dates: exact, "about", "before", "after", decade.
- Manual birth order among siblings (needed for ах/эгч vs дүү when dates are unknown).
- Unions: any number per person, concurrent or sequential (multiple wives, divorce, widowhood), with order and dates.
- Children linked to a specific union → half-siblings resolve correctly.
- Parent link kind: birth, adopted, step.
- Anything else goes into notes.

### Tree view
- Hourglass: ancestors above, descendants below, focus person large in the center.
- Click any card → becomes focus; all relationship badges recompute; animated re-layout.
- Multiple spouses side by side, each union's children grouped under it.
- Card: photo/initials, name, years, **relationship badge** (main term) + small path hint on hover (e.g. "Ахын хүү").
- Paternal / maternal side tinted subtly.
- **Living vs deceased:** deceased = muted card, grayscale photo, thin dark corner band, years shown (1932–2010). No cross symbol.

### Data entry
- "Start with me" wizard: me → parents → grandparents → spouse(s) → children.
- Quick-add buttons on each card: `+Аав` `+Ээж` `+Эхнэр/Нөхөр` `+Хүү` `+Охин` `+Ах/Эгч/Дүү`.
- Smart linking: child added to a person with one union → linked to both partners; sibling added → same parents.
- Only the name is required.
- Latin → Cyrillic converter in every name field and in search (section 5).

### Other
- Search + people list.
- JSON export / import, with a backup reminder.
- Term settings screen (edit any kinship word).

### Not in V1
GEDCOM import, fan chart, timeline, map, sync, printing, AI text entry, English/Japanese.

---

## 3. Data model

```ts
type ID = string; // uuid

interface FuzzyDate {
  year?: number;
  month?: number;
  day?: number;
  qualifier: 'exact' | 'about' | 'before' | 'after' | 'decade';
}

interface Person {
  id: ID;
  givenName: string;          // Оргил
  patronymic?: string;        // Бат (shown as "Б. Оргил")
  clanName?: string;          // ургийн овог
  sex: 'M' | 'F' | 'U';
  birth?: FuzzyDate;
  death?: FuzzyDate;
  isLiving: boolean;
  birthOrder?: number;        // fallback when birth dates are missing
  photoId?: ID;               // blob stored in its own table
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

interface Union {
  id: ID;
  partnerIds: [ID, ID] | [ID];  // one partner may be unknown
  type: 'married' | 'partner';
  start?: FuzzyDate;
  end?: FuzzyDate;
  endReason?: 'divorce' | 'death' | 'separation';
  order?: number;               // 1st, 2nd wife… per person
  notes?: string;
}

interface ParentLink {
  id: ID;
  childId: ID;
  parentId: ID;
  unionId?: ID;                 // which union the child belongs to
  kind: 'birth' | 'adopted' | 'step';
}
```

Only direct edges are stored. Every other relationship is computed.

---

## 4. Kinship engine

1. From focus F and target P, find the nearest common ancestor over birth/adopted parent links → `up` (F to ancestor) and `down` (ancestor to P).
2. Record `lineage` = whether F's first step up went through father or mother.
3. Record `relativeAge` for siblings (birth year, else `birthOrder`, else unknown).
4. Record `half` (share only one parent) and `step`.
5. If no blood path: check affinal — P is a spouse of a blood relative, or a blood relative of F's spouse.
6. Map the descriptor to a term from the table below. If no entry, build a descriptive path with genitive forms: "Аавын үеэлийн хүү".

```ts
interface Kinship {
  up: number; down: number;
  targetSex: 'M' | 'F' | 'U';
  lineage?: 'paternal' | 'maternal';
  relativeAge?: 'older' | 'younger' | 'unknown';
  half: boolean; step: boolean;
  viaPartner: 'none' | 'focusSide' | 'targetSide';
  path: Step[];                 // for the hover hint and fallback text
}
```

### Mongolian terms (V1 defaults)

**Ancestors** (up = generations above)

| up | Male | Female |
|---|---|---|
| 1 | Аав | Ээж |
| 2 | Өвөө / Нагац өвөө (maternal) | Эмээ / Нагац эмээ |
| 3 | Элэнц өвөө | Элэнц эмээ |
| 4 | Хуланц өвөө | Хуланц эмээ |
| 5 | Өндөр өвөө | Өндөр эмээ |
| 6+ | descriptive: "6 дахь үеийн өвөө" | "6 дахь үеийн эмээ" |

**Descendants** (down = generations below)

| down | Through son | Through daughter |
|---|---|---|
| 1 | Хүү / Охин | |
| 2 | Ач хүү / Ач охин | Зээ хүү / Зээ охин |
| 3 | Жич | Зээнцэр |
| 4+ | descriptive: "Жичийн хүүхэд" | "Зээнцэрийн хүүхэд" |

**Siblings**

| Relation | Term |
|---|---|
| Older brother / older sister | Ах / Эгч |
| Younger brother / younger sister | Эрэгтэй дүү / Эмэгтэй дүү |
| Age unknown | Ах дүү |
| Half-sibling | Эцэг нэгт / Эх нэгт + term above |
| Sibling's child (brother's or sister's) | Ах дүүгийн хүүхэд (hint: "Ахын хүү", "Эгчийн охин") |

**Parents' siblings and cousins**

| Relation | Term |
|---|---|
| Father's brother / sister | Авга ах / Авга эгч |
| Mother's brother / sister | Нагац ах / Нагац эгч |
| Child of авга or нагац | Үеэл ах / Үеэл эгч / Үеэл дүү |
| Cousin's child and below | descriptive: "Үеэлийн хүүхэд" |

**In-laws**

| Relation | Term |
|---|---|
| Husband / Wife | Нөхөр / Эхнэр |
| Spouse's parents | Хадам аав / Хадам ээж |
| Spouse's siblings | Хадам ах / Хадам эгч / Хадам дүү |
| Older brother's wife | Бэргэн эгч |
| Younger brother's wife | Бэр |
| Older / younger sister's husband | Хүргэн ах / Хүргэн дүү |
| Son's wife / Daughter's husband | Бэр / Хүргэн |
| Wife's sister's husband | Баз |
| Step-parent / adoptive parent | Хойт аав, ээж / Өргөмөл аав, ээж |
| Anything else | descriptive path |

### Test cases (must pass)
- Focus = me: my father → Аав. Focus = my son: same person → Өвөө.
- Focus = my son: my mother's father → Элэнц өвөө.
- Father's younger brother → Авга ах; mother's sister → Нагац эгч.
- My son's son → Ач хүү; my daughter's daughter → Зээ охин; daughter's daughter's child → Зээнцэр.
- Younger sister → Эмэгтэй дүү; sibling with no dates and no order → Ах дүү.
- Child of father's 2nd wife → Эцэг нэгт + ах/эгч/дүү.
- Brother's daughter → Ах дүүгийн хүүхэд (hint "Ахын охин").
- Wife's sister's husband → Баз.
- Father's cousin's son → descriptive "Аавын үеэлийн хүү".

---

## 5. Latin → Cyrillic converter

Longest match first, live as you type, case of the first letter preserved.

| Latin | Cyr | Latin | Cyr | Latin | Cyr |
|---|---|---|---|---|---|
| a | а | k | к | u | у |
| b | б | l | л | w, u' | ү |
| v | в | m | м | f | ф |
| g | г | n | н | h | х |
| d | д | o | о | c | ц |
| ye | е | q, o' | ө | ch | ч |
| yo | ё | p | п | sh | ш |
| j | ж | r | р | y | ы |
| z | з | s | с | `"` | ъ |
| i | и | t | т | `'` | ь |
| e | э | yu | ю | ya | я |

Special: after а, о, у, ү, и, э, the letter `i` → й (ai → ай, oi → ой).
Escape: a separator key between letters prevents a digraph (s|h → сх).

Examples: `Bat-Erdene` → Бат-Эрдэнэ, `Tqmqr` → Төмөр, `Anhbayar` → Анхбаяр, `Dorj` → Дорж.

---

## 6. Style

- Warm "heirloom album": off-white paper background, deep ink text, one accent color; dark mode.
- Fonts: Noto Sans (Cyrillic), Noto Serif for headings.
- Paternal side cool tint, maternal side warm tint.
- Deceased: muted, grayscale photo, dark corner band.
- Smooth re-layout animation when focus changes.

---

## 7. Milestones

1. **M0** Project setup (Vite + React + TS + Dexie), data model.
2. **M1** Kinship engine + converter, with unit tests (section 4 cases).
3. **M2** Tree view with focus switching and badges.
4. **M3** Wizard, quick-add, person editor, term settings.
5. **M4** Search, export/import, PWA install, deploy.
