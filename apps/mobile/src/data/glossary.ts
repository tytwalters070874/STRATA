import { formatAgo, TIME_SPANS } from './geologicTime';

/**
 * Plain definitions for geology words that appear in formation descriptions
 * and identification results. Keys are lower case; matching ignores case and
 * a trailing plural "s". Period and epoch names come from the time table, so
 * their dates are written once.
 *
 * Hand-written for a reader with no geology background: one or two short
 * sentences, no other jargon where it can be avoided.
 */
const WORDS: Record<string, string> = {
  // Units of time
  ma: 'Short for "mega-annum": millions of years ago. 50 Ma means 50 million years ago.',

  // The three rock families
  igneous: 'Rock that formed from molten rock (magma or lava) as it cooled.',
  sedimentary: 'Rock made of layers of sand, mud, shells or other pieces that settled and hardened over time.',
  metamorphic: 'Rock changed by heat and pressure deep underground, without melting.',

  // Igneous
  volcanic: 'Formed from lava or ash erupted at the surface by volcanoes.',
  intrusive: 'Formed from magma that cooled underground, inside other rock.',
  extrusive: 'Formed from lava that erupted onto the surface.',
  plutonic: 'Formed from magma that cooled slowly, deep underground.',
  magma: 'Molten rock underground. Once it erupts at the surface, it is called lava.',
  lava: 'Molten rock that has erupted onto the surface.',
  ash: 'Fine bits of rock and glass blasted out by a volcanic eruption.',
  granite: 'A light-colored, coarse-grained igneous rock that cooled slowly underground. Common in mountain cores.',
  granodiorite: 'A rock like granite, with less of the pink feldspar and a slightly darker look.',
  diorite: 'A coarse-grained igneous rock, usually speckled black and white.',
  gabbro: 'A dark, coarse-grained igneous rock; the underground version of basalt.',
  anorthosite: 'A light-colored igneous rock made almost entirely of one feldspar mineral.',
  basalt: 'A dark, fine-grained volcanic rock from runny lava. The most common rock on Earth\'s surface.',
  andesite: 'A gray volcanic rock between basalt and rhyolite in makeup. Common in chains of volcanoes.',
  dacite: 'A light-gray volcanic rock, richer in silica than andesite. Often from explosive eruptions.',
  rhyolite: 'A light-colored volcanic rock, the erupted version of granite.',
  tuff: 'Rock made of volcanic ash that settled and hardened.',
  breccia: 'Rock made of broken, sharp-edged fragments cemented together.',
  volcaniclastic: 'Made of broken volcanic material, like ash and rock fragments, that was moved and laid down in layers.',

  // Sedimentary
  clastic: 'Made of pieces (grains) of older rock that were worn away, carried and laid down.',
  carbonate: 'Made mostly of calcium carbonate, often from shells and coral. Limestone is a carbonate rock.',
  conglomerate: 'Rock made of rounded pebbles and cobbles cemented together, like natural concrete.',
  sandstone: 'Rock made of sand grains cemented together.',
  arkose: 'Sandstone with a lot of feldspar, often pinkish, from quickly eroded granite.',
  arkosic: 'Rich in feldspar grains, often from quickly eroded granite.',
  siltstone: 'Rock made of silt, grains finer than sand but coarser than mud.',
  mudstone: 'Rock made of hardened mud.',
  claystone: 'Rock made of hardened clay, the finest kind of grain.',
  shale: 'Hardened mud that splits into thin layers.',
  limestone: 'Rock made of calcium carbonate, usually from shells and corals in ancient seas.',
  dolomite: 'A rock like limestone, with magnesium in it. Also the name of the mineral it is made of.',
  marl: 'A soft mix of clay and lime mud.',
  marlstone: 'Hardened marl: a mix of clay and lime mud.',
  chert: 'A hard, fine-grained rock made of silica, like flint.',
  coal: 'Rock formed from the buried remains of swamp plants.',
  evaporite: 'Rock left behind when salty water evaporated, such as rock salt or gypsum.',
  gypsum: 'A soft mineral left behind by evaporating seawater, used to make plaster.',
  fossiliferous: 'Containing fossils.',

  // Metamorphic
  quartzite: 'Sandstone hardened by heat and pressure until the grains fused. Very hard.',
  marble: 'Limestone changed by heat and pressure into interlocking crystals.',
  slate: 'Shale changed by heat and pressure into rock that splits into flat sheets.',
  phyllite: 'A shiny, finely layered rock between slate and schist.',
  schist: 'A metamorphic rock with flaky, sparkly mica minerals lined up in layers.',
  gneiss: 'A metamorphic rock with light and dark bands, formed under great heat and pressure.',
  amphibolite: 'A dark metamorphic rock made mostly of the mineral amphibole.',

  // Loose deposits and settings
  unconsolidated: 'Loose material like sand, gravel or mud that has not hardened into rock.',
  alluvium: 'Sand, gravel and mud laid down by rivers and streams.',
  alluvial: 'Laid down by rivers and streams.',
  'alluvial fan': 'A fan-shaped pile of gravel and sand where a stream leaves a mountain front.',
  colluvium: 'Loose rock and soil that has slid or washed down a slope.',
  till: 'A jumbled mix of clay, sand and boulders left behind by a glacier.',
  glacial: 'Made or moved by glaciers.',
  moraine: 'A ridge of rock and gravel pushed up or left behind by a glacier.',
  loess: 'Fine, wind-blown dust that settled in thick layers.',
  landslide: 'Rock and soil that slid down a slope in one event.',
  sediment: 'Loose grains of sand, mud or shell that settle out of water, wind or ice.',
  fluvial: 'Laid down by rivers.',
  floodplain: 'The flat land beside a river that floods, where fine mud settles.',
  lacustrine: 'Laid down in a lake.',
  palustrine: 'Laid down in a marsh or swamp.',
  deltaic: 'Laid down where a river empties into a lake or sea.',
  eolian: 'Laid down by wind, such as in sand dunes.',
  marine: 'Formed in the sea.',
  'non-marine': 'Formed on land or in fresh water, not in the sea.',
  'debris flow': 'A fast-moving slurry of mud, rocks and water that pours downhill.',

  // How geologists name and map rock
  formation: 'A named body of rock layers that geologists can recognize and map across a region.',
  group: 'A set of related formations, named together.',
  supergroup: 'A set of related groups, often very thick and spanning a long time.',
  member: 'A named part of a formation.',
  'map unit': 'An area on a geologic map shown with one color and code, like "Jm" for a Jurassic formation.',
  stratigraphy: 'The study of rock layers: their order, age and how they formed.',
  bedding: 'The layering in sedimentary rock, one layer laid down on another.',
  outcrop: 'A place where bedrock shows at the surface, not covered by soil or plants.',
  bedrock: 'The solid rock under soil and loose gravel.',
  contact: 'The boundary where one rock unit meets another.',
  fault: 'A crack in the Earth where rock on either side has moved.',
  fold: 'A bend in rock layers, caused by squeezing over long periods.',
  uplift: 'The rising of land, often over millions of years, as when mountains form.',
  erosion: 'The wearing away of rock and soil by water, wind or ice.',
  weathering: 'The slow breaking down of rock at the surface by rain, frost and plants.',
  lithology: 'The type and makeup of a rock: what it is made of and what it looks like.',
  undifferentiated: 'Several rock types mapped together, because they were not mapped separately.',

  // Minerals
  mineral: 'A naturally formed solid with a set chemical makeup and crystal shape, such as quartz.',
  quartz: 'A hard, glassy mineral, often clear or white. Common in sand and granite.',
  feldspar: 'The most common mineral group in Earth\'s crust, often pink or white with flat faces.',
  mica: 'A mineral that peels into thin, shiny sheets.',
  calcite: 'The mineral that makes up limestone and marble. It fizzes in weak acid.',
  olivine: 'A green mineral common in basalt.',
  hornblende: 'A dark, rod-shaped mineral common in andesite and diorite.',
  pyroxene: 'A dark mineral common in basalt and gabbro.',
  crystal: 'A solid whose atoms are arranged in a repeating pattern, giving flat faces.',
  fossil: 'The preserved remains or traces of ancient life, such as shells, bones or footprints.',
};

function timeDefinition(name: string): string {
  const span = TIME_SPANS.find((s) => s.name === name)!;
  const range =
    span.end === 0
      ? `from ${formatAgo(span.start)} to today`
      : `from ${formatAgo(span.start)} to ${formatAgo(span.end)}`;
  return `A span of geologic time, ${range}. ${span.note}`;
}

export const GLOSSARY: Record<string, string> = {
  ...WORDS,
  ...Object.fromEntries(TIME_SPANS.map((span) => [span.name.toLowerCase(), timeDefinition(span.name)])),
};

/**
 * Everyday words that only carry their geology meaning in a name, where they
 * are capitalized ("Washburn Group"). In running text ("a group of rocks")
 * the geology definition would mislead, so they are not linked there.
 */
const NAME_ONLY = new Set(['group', 'member', 'contact', 'fold']);

/** The definition for a word as it appears in text, or null. */
export function define(word: string): string | null {
  const key = word.toLowerCase();
  const base = GLOSSARY[key] != null ? key : key.endsWith('s') ? key.slice(0, -1) : key;
  if (NAME_ONLY.has(base) && word[0] === word[0].toLowerCase()) return null;
  return GLOSSARY[base] ?? null;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Matches glossary terms in running text: longest terms first so "alluvial
 * fan" wins over "alluvial", whole words only, optional plural "s".
 */
export const GLOSSARY_PATTERN = new RegExp(
  `\\b(${Object.keys(GLOSSARY)
    .sort((a, b) => b.length - a.length)
    .map(escape)
    .join('|')})s?\\b`,
  'gi',
);
