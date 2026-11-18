import { useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { define, GLOSSARY_PATTERN } from '../data/glossary';

interface GlossaryTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

/**
 * Text with geology words underlined; tapping one shows a plain definition.
 * Only the first use of each word in the block is underlined, so a dense
 * description doesn't turn into a wall of links.
 */
export default function GlossaryText({ children, style, numberOfLines }: GlossaryTextProps) {
  const insets = useSafeAreaInsets();
  const [entry, setEntry] = useState<{ term: string; definition: string } | null>(null);

  const parts: ReactNode[] = [];
  const seen = new Set<string>();
  let last = 0;
  for (const match of children.matchAll(GLOSSARY_PATTERN)) {
    const word = match[0];
    const definition = define(word);
    const key = word.toLowerCase().replace(/s$/, '');
    if (!definition || seen.has(key)) continue;
    seen.add(key);
    const start = match.index ?? 0;
    if (start > last) parts.push(children.slice(last, start));
    parts.push(
      <Text
        key={`${start}-${word}`}
        style={styles.term}
        onPress={() => setEntry({ term: word, definition })}
        accessibilityRole="button"
        accessibilityHint="Shows what this word means"
      >
        {word}
      </Text>,
    );
    last = start + word.length;
  }
  if (last < children.length) parts.push(children.slice(last));

  return (
    <>
      <Text style={style} numberOfLines={numberOfLines}>
        {parts}
      </Text>
      <Modal visible={entry != null} transparent animationType="fade" onRequestClose={() => setEntry(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEntry(null)} accessibilityLabel="Close definition">
          <Pressable style={[styles.card, { marginBottom: insets.bottom + 16 }]} onPress={() => undefined}>
            <Text style={styles.cardTerm}>{entry?.term}</Text>
            <Text style={styles.cardBody}>{entry?.definition}</Text>
            <Pressable onPress={() => setEntry(null)} style={styles.close} hitSlop={8} accessibilityRole="button">
              <Text style={styles.closeText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  term: {
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
    textDecorationColor: '#6b4f2a',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  cardTerm: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1b16',
    textTransform: 'capitalize',
  },
  cardBody: {
    fontSize: 16,
    lineHeight: 23,
    color: '#3a372f',
  },
  close: {
    alignSelf: 'flex-end',
    minHeight: 48,
    justifyContent: 'center',
  },
  closeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b4f2a',
  },
});
