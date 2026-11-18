/**
 * Geologic time in plain language, for the deep-time ribbon and the glossary.
 *
 * Ages are in millions of years ago (Ma), rounded from the International
 * Chronostratigraphic Chart. Notes are one plain sentence; regional notes
 * name well-known Montana and Wyoming rocks.
 */

export type TimeLevel = 'eon' | 'era' | 'period' | 'epoch';

export interface TimeSpan {
  name: string;
  level: TimeLevel;
  /** Start, in millions of years ago (the older bound). */
  start: number;
  /** End, in millions of years ago (the younger bound). */
  end: number;
  note: string;
}

export const TIME_SPANS: TimeSpan[] = [
  { name: 'Hadean', level: 'eon', start: 4600, end: 4000, note: "Earth's earliest time; almost no rock survives from it." },
  { name: 'Archean', level: 'eon', start: 4000, end: 2500, note: 'The first continents formed and the first simple life appeared.' },
  { name: 'Proterozoic', level: 'eon', start: 2500, end: 539, note: 'Oxygen built up in the air and the first complex cells and many-celled life appeared.' },
  { name: 'Paleoproterozoic', level: 'era', start: 2500, end: 1600, note: 'Oxygen began to build up in the air.' },
  { name: 'Mesoproterozoic', level: 'era', start: 1600, end: 1000, note: 'The Belt basin of western Montana filled with thick layers of mud and sand.' },
  { name: 'Neoproterozoic', level: 'era', start: 1000, end: 539, note: 'Great ice ages, and the first many-celled animals.' },
  { name: 'Phanerozoic', level: 'eon', start: 539, end: 0, note: 'The time of visible life, from the first shelled animals to today.' },
  { name: 'Paleozoic', level: 'era', start: 539, end: 252, note: 'Life spread through the oceans, then onto land.' },
  { name: 'Cambrian', level: 'period', start: 539, end: 485, note: 'An explosion of animal life in shallow seas.' },
  { name: 'Ordovician', level: 'period', start: 485, end: 444, note: 'Seas full of shellfish, corals and early fish.' },
  { name: 'Silurian', level: 'period', start: 444, end: 419, note: 'The first small plants grew on land.' },
  { name: 'Devonian', level: 'period', start: 419, end: 359, note: 'The "age of fishes", and the first forests.' },
  { name: 'Mississippian', level: 'period', start: 359, end: 323, note: 'Warm, shallow seas laid down thick limestone, such as the Madison, across Montana and Wyoming.' },
  { name: 'Pennsylvanian', level: 'period', start: 323, end: 299, note: 'Coal swamps spread and the first reptiles appeared.' },
  { name: 'Permian', level: 'period', start: 299, end: 252, note: "It ended with the largest mass extinction in Earth's history." },
  { name: 'Mesozoic', level: 'era', start: 252, end: 66, note: 'The age of dinosaurs.' },
  { name: 'Triassic', level: 'period', start: 252, end: 201, note: 'The first dinosaurs and mammals appeared.' },
  { name: 'Jurassic', level: 'period', start: 201, end: 145, note: 'Giant dinosaurs, like those found in the Morrison Formation, roamed the region.' },
  { name: 'Cretaceous', level: 'period', start: 145, end: 66, note: 'A great inland sea split North America; it ended with the extinction of the dinosaurs.' },
  { name: 'Cenozoic', level: 'era', start: 66, end: 0, note: 'The age of mammals, and the rise of the Rocky Mountains.' },
  { name: 'Paleogene', level: 'period', start: 66, end: 23, note: 'Mammals spread after the dinosaurs died out.' },
  { name: 'Paleocene', level: 'epoch', start: 66, end: 56, note: 'Mammals spread into a world without dinosaurs.' },
  { name: 'Eocene', level: 'epoch', start: 56, end: 34, note: 'A warm world; volcanoes built the Absaroka Range.' },
  { name: 'Oligocene', level: 'epoch', start: 34, end: 23, note: 'The climate cooled and grasslands began to spread.' },
  { name: 'Neogene', level: 'period', start: 23, end: 2.6, note: 'Grasslands spread and the climate kept cooling.' },
  { name: 'Miocene', level: 'epoch', start: 23, end: 5.3, note: 'Grasslands spread widely; horses and camels lived in North America.' },
  { name: 'Pliocene', level: 'epoch', start: 5.3, end: 2.6, note: 'The climate cooled toward the ice ages.' },
  { name: 'Quaternary', level: 'period', start: 2.6, end: 0, note: 'The ice ages, and the time since.' },
  { name: 'Pleistocene', level: 'epoch', start: 2.6, end: 0.0117, note: "The ice ages; glaciers carved the region's mountain valleys." },
  { name: 'Holocene', level: 'epoch', start: 0.0117, end: 0, note: 'The time since the last ice age ended.' },
  { name: 'Tertiary', level: 'period', start: 66, end: 2.6, note: 'An older name for the Paleogene and Neogene together.' },
];

/** Events used to place an age in time, oldest first. */
export const MILESTONES: { age: number; event: string }[] = [
  { age: 3500, event: 'the earliest known life' },
  { age: 539, event: 'the first animals with shells' },
  { age: 375, event: 'the first animals walked on land' },
  { age: 230, event: 'the first dinosaurs' },
  { age: 66, event: 'the dinosaurs died out' },
  { age: 2.6, event: 'the ice ages began' },
  { age: 0.3, event: 'modern humans appeared' },
];

/** The four main divisions shown on the ribbon, oldest first. */
export const RIBBON_SEGMENTS: { name: string; start: number; end: number; color: string }[] = [
  { name: 'Precambrian', start: 4600, end: 539, color: '#c9b08a' },
  { name: 'Paleozoic', start: 539, end: 252, color: '#8fa6a1' },
  { name: 'Mesozoic', start: 252, end: 66, color: '#9fbf85' },
  { name: 'Cenozoic', start: 66, end: 0, color: '#e8c96a' },
];

/**
 * A plain sentence placing an age range among the milestones, e.g.
 * "After the dinosaurs died out, and before the ice ages began."
 */
export function placeInTime(minMa: number, maxMa: number): string | null {
  const middle = (minMa + maxMa) / 2;
  const before = [...MILESTONES].reverse().find((m) => m.age > middle);
  const after = MILESTONES.find((m) => m.age < middle);
  if (before && after) return `After ${before.event}, and before ${after.event}.`;
  if (before) return `After ${before.event}.`;
  if (after) return `Before ${after.event}.`;
  return null;
}

/** "45 million years ago", "1.4 billion years ago", "12,000 years ago". */
export function formatAgo(ma: number): string {
  if (ma >= 1000) return `${(ma / 1000).toFixed(1)} billion years ago`;
  if (ma >= 1) return `${Math.round(ma)} million years ago`;
  if (ma >= 0.01) return `${Math.round(ma * 1000).toLocaleString()} thousand years ago`;
  return `${Math.round(ma * 1_000_000).toLocaleString()} years ago`;
}
