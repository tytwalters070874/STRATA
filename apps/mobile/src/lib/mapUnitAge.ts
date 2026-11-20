/**
 * A sanity check between two sources that can disagree.
 *
 * The formation under the user comes from the state geologic map, whose map
 * unit symbols start with an age code ("Qt" is Quaternary terrace gravel,
 * "Kf" a Cretaceous formation). Ages and descriptions come from Macrostrat at
 * the same point, but Macrostrat may match a different unit from a different
 * map: near Cody it pairs young gravel ("Qt") with 2.6-billion-year-old
 * granite. When the two ages can't both be true, the Macrostrat unit is about
 * some other rock, so the sheet should not show its age or description.
 */

export interface AgeRangeMa {
  /** Youngest age, millions of years ago. */
  min: number;
  /** Oldest age, millions of years ago. */
  max: number;
}

/**
 * The age range a map unit symbol's leading age code implies, or null when
 * the symbol has no recognisable age code (then nothing is ruled out).
 *
 * Symbols on USGS-style state maps begin with a period code in capitals,
 * sometimes two periods joined ("TKi" spans Tertiary to Cretaceous), followed
 * by lower-case letters naming the unit.
 */
export function ageRangeFromSymbol(symbol: string): AgeRangeMa | null {
  const ranges: AgeRangeMa[] = [];
  let at = 0;
  while (at < symbol.length) {
    const match = AGE_CODES.find(([code]) => symbol.startsWith(code, at));
    if (!match) break;
    ranges.push(match[1]);
    at += match[0].length;
  }
  if (ranges.length === 0) return null;
  // "QT" or "TK": the unit may sit anywhere across the joined periods.
  return {
    min: Math.min(...ranges.map((r) => r.min)),
    max: Math.max(...ranges.map((r) => r.max)),
  };
}

/**
 * Age codes in the order they are tried: longer codes first, so "TRc" reads
 * as Triassic rather than Tertiary, and "Mz" as Mesozoic rather than
 * Mississippian. Boundaries follow the 2023 ICS chart, rounded.
 */
const AGE_CODES: [string, AgeRangeMa][] = [
  ['pC', { min: 539, max: 4000 }], // Precambrian
  ['TR', { min: 201, max: 252 }], // Triassic
  ['IP', { min: 299, max: 323 }], // Pennsylvanian
  ['Cz', { min: 0, max: 66 }], // Cenozoic
  ['Mz', { min: 66, max: 252 }], // Mesozoic
  ['Pz', { min: 252, max: 539 }], // Paleozoic
  ['Q', { min: 0, max: 2.6 }], // Quaternary
  ['N', { min: 2.6, max: 23 }], // Neogene
  ['T', { min: 2.6, max: 66 }], // Tertiary
  ['K', { min: 66, max: 145 }], // Cretaceous
  ['J', { min: 145, max: 201 }], // Jurassic
  ['P', { min: 252, max: 299 }], // Permian
  // The state maps were typed with the USGS geologic-age font, whose special
  // glyphs come through as ordinary characters: "J@" is Jurassic–Triassic,
  // "P&M" Permian–Pennsylvanian–Mississippian, "MDO^" ends in the Cambrian.
  ['@', { min: 201, max: 252 }], // Triassic
  ['&', { min: 299, max: 323 }], // Pennsylvanian
  ['*', { min: 299, max: 323 }], // Pennsylvanian
  ['^', { min: 485, max: 539 }], // Cambrian
  ['_', { min: 485, max: 539 }], // Cambrian
  ['M', { min: 323, max: 359 }], // Mississippian
  ['D', { min: 359, max: 419 }], // Devonian
  ['S', { min: 419, max: 444 }], // Silurian
  ['O', { min: 444, max: 485 }], // Ordovician
  ['C', { min: 485, max: 539 }], // Cambrian
  ['Z', { min: 539, max: 1000 }], // Neoproterozoic
  ['Y', { min: 1000, max: 1600 }], // Mesoproterozoic, e.g. the Belt Supergroup
  ['X', { min: 1600, max: 2500 }], // Paleoproterozoic
  ['W', { min: 2500, max: 4000 }], // Archean
  ['A', { min: 2500, max: 4000 }], // Archean
];

/**
 * Whether Macrostrat's age can describe the same rock as the map unit. Allows
 * some slack at period boundaries, since the two sources date units
 * differently.
 */
export function macrostratAgeFits(symbol: string | null | undefined, age: AgeRangeMa): boolean {
  if (!symbol) return true;
  const expected = ageRangeFromSymbol(symbol.trim());
  if (!expected) return true;
  const slack = Math.max(5, expected.max * 0.1);
  return age.min <= expected.max + slack && age.max >= expected.min - slack;
}
