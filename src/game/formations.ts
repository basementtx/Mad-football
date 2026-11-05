/**
 * Team formations. Keyed by match size (3v3 / 4v4 / 5v5); each lists the outfield
 * players in lineup order (lineup slot 1 = first entry, slot 0 is always the keeper).
 * Spots are in normalized pitch coords: u = attack axis (-1 own goal .. +1 their goal),
 * w = lateral (-1 .. +1). The first formation of each size is the classic default.
 */
import type { Role } from './entities';

export interface Formation {
  id: string;
  roles: Role[];
  spots: [number, number][];
  name: { tr: string; en: string };
  desc: { tr: string; en: string };
}

export const FORMATIONS: Record<number, Formation[]> = {
  3: [
    { id: '1-1', roles: ['DEF', 'FWD'], spots: [[-0.42, -0.2], [0.12, 0.3]],
      name: { tr: 'Dengeli', en: 'Balanced' }, desc: { tr: 'Bir defans, bir forvet.', en: 'One at the back, one up top.' } },
    { id: '0-2', roles: ['MID', 'FWD'], spots: [[-0.12, -0.35], [0.18, 0.35]],
      name: { tr: 'Tam Hücum', en: 'All-out Attack' }, desc: { tr: 'İkisi de ileride; arka boş kalır.', en: 'Both push up; the back is left open.' } },
    { id: '2-0', roles: ['DEF', 'DEF'], spots: [[-0.48, -0.35], [-0.44, 0.35]],
      name: { tr: 'Otobüs', en: 'Park the Bus' }, desc: { tr: 'İkisi de geride; kontra bekle.', en: 'Both sit deep; wait for the counter.' } },
  ],
  4: [
    { id: '1-1-1', roles: ['DEF', 'MID', 'FWD'], spots: [[-0.48, 0], [-0.05, -0.5], [0.12, 0.5]],
      name: { tr: 'Dengeli', en: 'Balanced' }, desc: { tr: 'Her hatta bir oyuncu.', en: 'One player in every line.' } },
    { id: '2-1', roles: ['DEF', 'DEF', 'FWD'], spots: [[-0.5, -0.4], [-0.5, 0.4], [0.12, 0]],
      name: { tr: 'Sağlam', en: 'Solid' }, desc: { tr: 'İki stoper, tek forvet.', en: 'Two centre-backs, a lone striker.' } },
    { id: '1-0-2', roles: ['DEF', 'FWD', 'FWD'], spots: [[-0.48, 0], [0.1, -0.45], [0.1, 0.45]],
      name: { tr: 'İkili Forvet', en: 'Twin Strikers' }, desc: { tr: 'İki forvet, tek defans.', en: 'Two strikers, one defender.' } },
    { id: '1-2-0', roles: ['DEF', 'MID', 'MID'], spots: [[-0.5, 0], [-0.08, -0.45], [-0.08, 0.45]],
      name: { tr: 'Kontrol', en: 'Control' }, desc: { tr: 'Orta saha hakimiyeti.', en: 'Own the middle of the pitch.' } },
  ],
  5: [
    { id: '2-1-1', roles: ['DEF', 'DEF', 'MID', 'FWD'], spots: [[-0.52, -0.38], [-0.5, 0.38], [-0.02, -0.15], [0.26, 0.3]],
      name: { tr: 'Klasik', en: 'Classic' }, desc: { tr: 'İki defans, orta saha, forvet.', en: 'Two at the back, a midfielder, a striker.' } },
    { id: '1-2-1', roles: ['DEF', 'MID', 'MID', 'FWD'], spots: [[-0.52, 0], [-0.14, -0.5], [-0.14, 0.5], [0.26, 0]],
      name: { tr: 'Elmas', en: 'Diamond' }, desc: { tr: 'Kanatlarda iki orta saha.', en: 'Two midfielders on the flanks.' } },
    { id: '2-2', roles: ['DEF', 'DEF', 'FWD', 'FWD'], spots: [[-0.52, -0.38], [-0.52, 0.38], [0.16, -0.38], [0.16, 0.38]],
      name: { tr: 'Kutu', en: 'Box' }, desc: { tr: 'İki defans, iki forvet.', en: 'Two defenders, two strikers.' } },
    { id: '3-1', roles: ['DEF', 'DEF', 'DEF', 'FWD'], spots: [[-0.52, -0.5], [-0.58, 0], [-0.52, 0.5], [0.15, 0]],
      name: { tr: 'Kale', en: 'Fortress' }, desc: { tr: 'Üç defans, tek forvet.', en: 'Three at the back, one up top.' } },
    { id: '1-1-2', roles: ['DEF', 'MID', 'FWD', 'FWD'], spots: [[-0.5, 0], [-0.1, 0], [0.22, -0.42], [0.22, 0.42]],
      name: { tr: 'Saldırı', en: 'Attack' }, desc: { tr: 'Önde iki forvet, arkada tek defans.', en: 'Two strikers, a single defender.' } },
  ],
};

/** The formation `id` for a match size (falls back to the classic one). */
export function formationFor(size: number, id?: string | null): Formation {
  const list = FORMATIONS[size] ?? FORMATIONS[4];
  return list.find((f) => f.id === id) ?? list[0];
}

/** A fixed formation per AI club, so each rival has its own style. */
export function aiFormation(size: number, teamId: string): Formation {
  const list = FORMATIONS[size] ?? FORMATIONS[4];
  let h = 0;
  for (let i = 0; i < teamId.length; i++) h = (h * 31 + teamId.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}
