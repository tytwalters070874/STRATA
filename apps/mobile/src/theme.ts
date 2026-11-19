/**
 * STRATA's field-guide look: paper and ink, a serif for reading, a condensed
 * sans for labels, and one rust accent. Inspired by printed geology field
 * guides without copying any one series.
 */
export const colors = {
  /** The page behind everything. */
  paper: '#f4efe4',
  /** Cards and sheets laid on the paper. */
  card: '#fbf8f1',
  ink: '#1e1b16',
  /** Secondary text; 4.5:1 or better on paper and card. */
  inkSoft: '#3b352b',
  muted: '#5c5447',
  rule: '#d9cfbd',
  accent: '#8e3b17',
  accentPressed: '#6b2a0f',
  /** Protected-land note. */
  noticeBg: '#f6eadb',
  noticeBorder: '#b07a4a',
  noticeInk: '#4a2a10',
  danger: '#b3261e',
} as const;

/** Font family names as registered by useFonts in App.tsx. */
export const fonts = {
  serif: 'SourceSerif4_400Regular',
  serifItalic: 'SourceSerif4_400Regular_Italic',
  serifSemiBold: 'SourceSerif4_600SemiBold',
  sans: 'Barlow_500Medium',
  sansSemiBold: 'Barlow_600SemiBold',
  label: 'BarlowCondensed_600SemiBold',
  labelBold: 'BarlowCondensed_700Bold',
} as const;

/** Small-caps section label, like a guidebook running head. */
export const labelStyle = {
  fontFamily: fonts.labelBold,
  fontSize: 14,
  letterSpacing: 2,
  textTransform: 'uppercase' as const,
  color: colors.ink,
};
