/**
 * Display forms of the formation table's names, which come straight from the
 * state geologic map compilation and are written for geologists.
 */

/**
 * "Absaroka Volcanic Supergroup: Washburn Group" → title "Washburn Group",
 * parent "Absaroka Volcanic Supergroup". Names with a sub-unit after " - "
 * ("…: Sunlight Group - Wapiti Formation") title the most specific unit.
 * Names without a colon are returned whole as the title.
 */
export function splitFormationName(name: string): { title: string; parent: string | null } {
  const colon = name.indexOf(': ');
  if (colon < 0) return { title: name, parent: null };
  const parent = name.slice(0, colon).trim();
  const rest = name.slice(colon + 2).trim();
  // A lower-case start means the colon introduced a note, not a sub-unit
  // ("Alaska Bench Formation: locally includes …"): keep the first part.
  if (/^[a-z]/.test(rest)) return { title: parent, parent: null };
  const dash = rest.lastIndexOf(' - ');
  return { title: dash >= 0 ? rest.slice(dash + 3).trim() : rest, parent };
}

const UNIT_WORD = /\b(Formation|Group|Supergroup|Limestone|Shale|Sandstone|Dolomite|Quartzite|Member)s?\b/;

/**
 * A short label for a formation in a list: its title, and for names that list
 * several formations ("Madison Group, Darby Formation, Three Forks and
 * Jefferson Formations") the first one "and related formations".
 */
export function shortFormationName(name: string): string {
  const { title } = splitFormationName(name);
  if (title.includes(',') && UNIT_WORD.test(title)) {
    return `${title.split(',')[0].trim()} and related formations`;
  }
  return title;
}

// Map-compilation rock words a lay reader wouldn't know, in plain terms.
const PLAIN_ROCK: Record<string, string> = {
  unconsolidated: 'Gravel, sand and mud',
  'unconsolidated deposits': 'Gravel, sand and mud',
  alluvium: 'River gravel and sand',
  colluvium: 'Slope debris',
  'medium-grained mixed clastic': 'Mixed sandstone and shale',
};

/** ["Limestone", "Dolostone"] → "Limestone, dolostone"; ["Unconsolidated"] → "Gravel, sand and mud". */
export function plainRockTypes(rockTypes: string[] | null | undefined): string {
  const words = (rockTypes ?? []).map((rock) => PLAIN_ROCK[rock.toLowerCase()] ?? rock);
  if (words.length === 0) return 'Rock';
  const joined = [...new Set(words)].join(', ');
  return joined.charAt(0).toUpperCase() + joined.slice(1).toLowerCase();
}
