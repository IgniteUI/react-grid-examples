import { memo, useMemo } from "react";
import { IgrList, IgrListItem } from "igniteui-react";
import { useDesk } from "../services/desk";
import { ChoiceSelect, type Choice } from "../util/choice-select";
import { since } from "../util/finance";
import { useStore } from "../util/use-store";

/** The select's entry for "no symbol filter"; the workspace stores that as an empty filter. */
const ALL_SYMBOLS = "all";

/**
 * The news wire, as a docked pane. Alerts are separate — they live in the
 * command bar's dialog, being read on arrival rather than browsed.
 */
function NewsPanel() {
  const { notifications, workspace } = useDesk();

  /**
   * Shared rather than local: clicking a watchlist row narrows the wire too, so
   * the filter has to be reachable from outside this pane — and a reset has to
   * be able to clear it.
   */
  const symbolFilter = useStore(workspace, (state) => state.newsFilter);
  const now = useStore(notifications, (state) => state.now);
  const news = useStore(notifications, (state) => state.news);

  /**
   * Only the symbols the wire is actually carrying, so the list can never offer
   * a filter that would empty the pane.
   */
  const wireSymbols = useMemo(() => {
    const symbols = new Set<string>();
    for (const article of news) {
      if (article.symbol) {
        symbols.add(article.symbol);
      }
    }
    // A symbol focused from another pane may have nothing on the wire yet, and
    // without an option for it the select would render an empty box.
    if (symbolFilter) {
      symbols.add(symbolFilter);
    }
    return [...symbols].sort();
  }, [news, symbolFilter]);

  const filterChoices = useMemo<readonly Choice[]>(
    () => [
      { value: ALL_SYMBOLS, label: "All symbols" },
      ...wireSymbols.map((symbol) => ({ value: symbol, label: symbol })),
    ],
    [wireSymbols],
  );

  // `newsFor` keeps the untagged macro wire alongside the instrument — a
  // filtered desk still wants to see the Fed headline.
  const articles = useMemo(
    () => (symbolFilter ? notifications.newsFor(symbolFilter) : news),
    [notifications, news, symbolFilter],
  );

  /** Jumps the desk to the instrument a headline is about. */
  const selectSymbol = (symbol: string | null) => {
    if (symbol) {
      workspace.selectSymbol(symbol);
    }
  };

  return (
    <div className="desk-pane news-pane">
      <div className="panel-body">
        <div className="panel-actions">
          <ChoiceSelect
            className="news-filter"
            ariaLabel="Filter the wire by symbol"
            prefixIcon="filter_alt"
            value={symbolFilter || ALL_SYMBOLS}
            choices={filterChoices}
            onChoose={(value) => workspace.setNewsFilter(value === ALL_SYMBOLS ? "" : value)}
          />
        </div>

        <IgrList className="item-list">
          {articles.map((article) => (
            <IgrListItem key={article.id} className="news-list-item">
              <div className="news-item">
                <button
                  type="button"
                  className="news-headline"
                  disabled={!article.symbol}
                  onClick={() => selectSymbol(article.symbol)}
                >
                  {article.headline}
                </button>
                <div className="news-meta">
                  {article.symbol && <span className="news-symbol">{article.symbol}</span>}
                  <span>{article.source}</span>
                  <span aria-hidden="true">·</span>
                  <time>{since(article.at, now)}</time>
                </div>
              </div>
            </IgrListItem>
          ))}
          {articles.length === 0 && (
            <p className="list-empty">Nothing on the wire{symbolFilter ? ` for ${symbolFilter}` : ""} yet.</p>
          )}
        </IgrList>
      </div>
    </div>
  );
}

export default memo(NewsPanel);
