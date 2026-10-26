import { useMemo } from "react";
import { useFinanceView } from "../finance-view-context";
import { splitOnMatches } from "../services/text-matches";

/**
 * Text with every occurrence of the toolbar filter marked.
 *
 * The grid's own search highlights default cell templates only, and every
 * column here renders through a template; its matches are also kept per column
 * field, so it could never mark the company name, which the Asset column
 * renders without binding to it. Marking the segments here keeps the highlight
 * and the filter driven by exactly the same comparison, so what lights up is
 * precisely what kept the row on screen.
 */
export default function HighlightedText({ text }: { text: string }) {
  const { query } = useFinanceView();
  const segments = useMemo(() => splitOnMatches(text, query), [text, query]);

  return segments.map((segment, index) =>
    segment.hit ? (
      <mark key={index} className="search-hit">
        {segment.text}
      </mark>
    ) : (
      <span key={index}>{segment.text}</span>
    )
  );
}
