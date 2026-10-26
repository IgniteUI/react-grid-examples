/** One run of the source text, flagged if the query matched it. */
export interface TextSegment {
  text: string;
  hit: boolean;
}

/** Whether a holding passes the toolbar filter: its ticker or company name contains the query. */
export function matchesAsset(row: { ticker: string; company: string }, query: string): boolean {
  const needle = query.trim().toLowerCase();
  return !needle || row.ticker.toLowerCase().includes(needle) || row.company.toLowerCase().includes(needle);
}

/**
 * Splits `text` into alternating plain and matching runs.
 *
 * Case-insensitive, and it walks the string rather than building a `RegExp`,
 * so a query like `C++` or `(` is matched literally instead of throwing.
 */
export function splitOnMatches(text: string, query: string): TextSegment[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return [{ text, hit: false }];
  }

  const haystack = text.toLowerCase();
  const segments: TextSegment[] = [];
  let cursor = 0;
  let match = haystack.indexOf(needle);

  while (match !== -1) {
    if (match > cursor) {
      segments.push({ text: text.slice(cursor, match), hit: false });
    }

    segments.push({ text: text.slice(match, match + needle.length), hit: true });
    cursor = match + needle.length;
    match = haystack.indexOf(needle, cursor);
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), hit: false });
  }

  return segments;
}
