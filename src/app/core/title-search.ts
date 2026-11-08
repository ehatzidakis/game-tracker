/** "Marvel's Spider-Man 2" → "marvels spider man 2"; "Ragnarök" → "ragnarok". */
export function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * A title test for what you typed: every word has to be in the title ("god ragnarok" finds
 * God of War Ragnarök), ignoring case, accents and punctuation. Null when nothing's typed.
 */
export function titleMatcher(query: string): ((title: string) => boolean) | null {
  const words = searchable(query).split(' ').filter(Boolean);
  if (!words.length) return null;
  return (title) => {
    const name = searchable(title);
    return words.every((w) => name.includes(w));
  };
}
