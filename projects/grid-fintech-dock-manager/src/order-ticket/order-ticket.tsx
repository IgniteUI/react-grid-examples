import { memo, useEffect, useRef, useState, type FormEvent } from "react";
import {
  IgrButton,
  IgrButtonGroup,
  IgrIcon,
  IgrInput,
  IgrSnackbar,
  IgrToggleButton,
} from "igniteui-react";
import { ORDER_TYPES, TIME_IN_FORCE, type OrderSide, type OrderType, type TimeInForce } from "../models/stock.model";
import { useDesk } from "../services/desk";
import { COMMISSION_PER_SHARE, commissionFor, heldQuantity } from "../services/trading.service";
import { money, price, round2 } from "../util/finance";
import { ChoiceSelect, type Choice } from "../util/choice-select";
import { ICONS } from "../util/icons";
import { useStore } from "../util/use-store";

/** Order types that rest on a limit price. */
const LIMIT_TYPES: readonly OrderType[] = ["Limit", "Stop Limit"];
/** Order types that need a stop price or trail amount. */
const STOP_TYPES: readonly OrderType[] = ["Stop", "Stop Limit", "Trailing Stop"];

const QUICK_QUANTITIES = [25, 50, 100, 500] as const;

const ORDER_TYPE_CHOICES: readonly Choice[] = ORDER_TYPES.map((type) => ({ value: type, label: type }));
const TIME_IN_FORCE_CHOICES: readonly Choice[] = TIME_IN_FORCE.map((tif) => ({ value: tif, label: tif }));

/** One segment of the quick-size group. */
interface QuickSize {
  label: string;
  quantity: number;
  disabled: boolean;
  hint?: string;
}

/** The two sides, in the order the toggle renders them. */
const SIDE_OPTIONS: readonly { value: OrderSide; label: string }[] = [
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
];

/**
 * The ticket's fields as they read on screen. A number field keeps the text as
 * it was typed: parsing it and writing the number back would turn "100.0" into
 * "100" under the trader's cursor, and the next digit would land in the wrong
 * place. An empty number field is the empty string.
 */
interface TicketFields {
  quantity: string;
  type: OrderType;
  limitPrice: string;
  stopPrice: string;
  timeInForce: TimeInForce;
}

/** The same fields with the number fields parsed; an empty number field is `null`. */
interface TicketValues {
  quantity: number | null;
  type: OrderType;
  limitPrice: number | null;
  stopPrice: number | null;
  timeInForce: TimeInForce;
}

const INITIAL_FIELDS: TicketFields = {
  quantity: "100",
  type: "Limit",
  limitPrice: "",
  stopPrice: "",
  timeInForce: "Day",
};

/** A number field's text as a number, the way a number input reports it. */
const parseNumber = (text: string): number | null => (text.trim() === "" ? null : parseFloat(text));

/** A number as the text of a number field; `null` leaves it empty. */
const fieldText = (value: number | null | undefined): string =>
  value === null || value === undefined || Number.isNaN(value) ? "" : String(value);

const valuesOf = (fields: TicketFields): TicketValues => ({
  ...fields,
  quantity: parseNumber(fields.quantity),
  limitPrice: parseNumber(fields.limitPrice),
  stopPrice: parseNumber(fields.stopPrice),
});

/**
 * Whether the fields the chosen order type uses hold acceptable values: a
 * quantity of at least one, and any price at least a cent. A price field may be
 * left empty here — the engine then rejects the order and says why.
 */
function fieldsAreValid(values: TicketValues): boolean {
  const priceOk = (value: number | null) => value === null || (!Number.isNaN(value) && value >= 0.01);
  if (values.quantity === null || Number.isNaN(values.quantity) || values.quantity < 1) {
    return false;
  }
  if (LIMIT_TYPES.includes(values.type) && !priceOk(values.limitPrice)) {
    return false;
  }
  return !STOP_TYPES.includes(values.type) || priceOk(values.stopPrice);
}

/** The number fields, by the name of the field they edit. */
type NumberField = "quantity" | "limitPrice" | "stopPrice";

const NO_FIELDS: ReadonlySet<NumberField> = new Set();

function OrderTicket() {
  const { market, trading, workspace } = useDesk();
  const snackbarRef = useRef<IgrSnackbar>(null);

  // Both driven by the workspace, so any pane can point the ticket at a trade.
  const symbol = useStore(workspace, (state) => state.selectedSymbol);
  const side = useStore(workspace, (state) => state.ticketSide);

  // The ticket re-renders on every tick and reads the live quote as it stands.
  useStore(market, (state) => state.tick);
  const quote = market.quoteOf(symbol);
  const heldShares = useStore(trading, (state) => heldQuantity(state.lots, symbol));
  const buyingPower = useStore(trading, (state) => state.account.buyingPower);

  /** The fields as they read on screen. */
  const [fields, setFields] = useState<TicketFields>(INITIAL_FIELDS);
  /**
   * The fields as of the trader's last edit — what the estimate and the
   * quick-size highlight read. Re-seeding the price fields for a new symbol
   * changes what the fields show without counting as an edit, so the estimate
   * keeps working from the last price the trader actually chose.
   */
  const [edited, setEdited] = useState<TicketFields>(INITIAL_FIELDS);
  /**
   * The number fields changed since they last had focus. Such a field shows its
   * focus border in the success colour; a field marks an unacceptable value
   * itself.
   */
  const [changed, setChanged] = useState(NO_FIELDS);
  const markChanged = (field: NumberField) =>
    setChanged((current) => (current.has(field) ? current : new Set(current).add(field)));
  const clearChanged = (field: NumberField) =>
    setChanged((current) => {
      const next = new Set(current);
      return next.delete(field) ? next : current;
    });
  const numberFieldClass = (field: NumberField) => `form-field${changed.has(field) ? " field-changed" : ""}`;
  /** Rejection returned by the engine, cleared as soon as the ticket is edited. */
  const [rejection, setRejection] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ text: string; id: number } | null>(null);

  // Following the selected symbol means re-seeding the price fields, otherwise
  // a limit left over from the previous instrument would be nonsense. Done as
  // the new symbol renders, so it never shows with the old prices.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seededFor !== symbol) {
    setSeededFor(symbol);
    if (quote) {
      setFields((current) => ({ ...current, limitPrice: fieldText(quote.lastPrice), stopPrice: "" }));
      setRejection(null);
    }
  }

  const edit = (patch: Partial<TicketFields>) => {
    const next = { ...fields, ...patch };
    setFields(next);
    // A price field the order type was not using when the edit happened is
    // inactive, and drops out of the snapshot.
    setEdited({
      ...next,
      limitPrice: LIMIT_TYPES.includes(fields.type) ? next.limitPrice : "",
      stopPrice: STOP_TYPES.includes(fields.type) ? next.stopPrice : "",
    });
    setRejection(null);
  };

  // The order confirmation: the snackbar shows once its text has rendered. A
  // confirmation that arrives while the previous one is still up replaces its
  // text and gets its own full display time.
  useEffect(() => {
    const snackbar = snackbarRef.current;
    if (!notice || !snackbar) {
      return;
    }
    if (snackbar.open) {
      // `show()` on an open snackbar does nothing, so the auto-hide timer would
      // keep running from the previous notice. Any change of `keepOpen` restarts
      // it; both writes land in the one update.
      snackbar.keepOpen = true;
      snackbar.keepOpen = false;
    } else {
      void snackbar.show();
    }
  }, [notice]);

  const editedValues = valuesOf(edited);
  const orderType = edited.type;
  const needsLimitPrice = LIMIT_TYPES.includes(orderType);
  const needsStopPrice = STOP_TYPES.includes(orderType);
  const isTrailing = orderType === "Trailing Stop";

  /** The price this order would work against right now. */
  const referencePrice = (() => {
    if (!quote) {
      return null;
    }
    if (needsLimitPrice && editedValues.limitPrice) {
      return editedValues.limitPrice;
    }
    return side === "BUY" ? quote.ask : quote.bid;
  })();

  const estimateQuantity = editedValues.quantity ?? 0;
  const notional = round2(estimateQuantity * (referencePrice ?? 0));
  const commission = estimateQuantity > 0 ? commissionFor(estimateQuantity) : 0;
  const total = round2(notional + commission);

  /** Largest size the account can support for the current side. */
  const maxQuantity = (() => {
    if (side === "SELL") {
      return heldShares;
    }
    // Commission is priced in, so "Max" is always a size the engine accepts.
    return referencePrice && referencePrice > 0 ? Math.floor(buyingPower / (referencePrice + COMMISSION_PER_SHARE)) : 0;
  })();

  /**
   * The quick sizes, in the order the group renders them. `Max` carries a live
   * size, and it is last so the fixed sizes keep their positions as it changes.
   */
  const quickSizes: readonly QuickSize[] = [
    ...QUICK_QUANTITIES.map((quantity) => ({ label: `${quantity}`, quantity, disabled: false })),
    {
      label: "Max",
      quantity: maxQuantity,
      disabled: maxQuantity < 1,
      // The only one whose size is not on its face, so it is the only one that needs saying.
      hint: `Maximum size for this side: ${maxQuantity}`,
    },
  ];

  /**
   * Which quick size the field currently holds, or -1 for none of them. A size
   * typed by hand belongs to none; and where `Max` lands on a fixed size, the
   * fixed size — whose meaning does not move — wins.
   */
  const selectedQuickSize = quickSizes.findIndex((size) => !size.disabled && size.quantity === estimateQuantity);

  const canSubmit = fieldsAreValid(valuesOf(fields)) && quote !== undefined;
  const submitLabel = `${side === "BUY" ? "Buy" : "Sell"} ${symbol}`;

  /** Places the order the given fields describe: the ones on screen unless a caller says otherwise. */
  const submit = (source: TicketFields = fields) => {
    const values = valuesOf(source);
    if (!fieldsAreValid(values) || quote === undefined) {
      return;
    }

    const result = trading.submitOrder({
      symbol,
      side,
      quantity: values.quantity ?? 0,
      type: values.type,
      limitPrice: LIMIT_TYPES.includes(values.type) ? values.limitPrice : null,
      stopPrice: STOP_TYPES.includes(values.type) ? values.stopPrice : null,
      timeInForce: values.timeInForce,
    });

    if (!result.accepted) {
      setRejection(result.reason);
      return;
    }

    const { order } = result;
    const outcome = order.status === "Filled"
      ? `filled at ${order.fillPrice?.toFixed(2)}`
      : `working (${order.timeInForce})`;
    setNotice({ text: `${order.id} · ${order.side} ${order.quantity} ${order.symbol} — ${outcome}`, id: Date.now() });
  };

  /**
   * The quick sizes are the form's submit buttons, so choosing one sets the
   * quantity and places the order at once.
   */
  const placeQuickSize = (size: QuickSize) => {
    if (size.disabled) {
      return;
    }
    const quantity = fieldText(size.quantity);
    edit({ quantity });
    submit({ ...fields, quantity });
  };

  /**
   * Enter in a field submits the form, and a native form's implicit submission
   * is a click on its first submit button: the first quick size. (The fields
   * request the submission themselves; the place button is a plain button.)
   */
  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    placeQuickSize(quickSizes[0]);
  };

  /** Clicking the bid or ask pulls that price into the limit field. */
  const takePrice = (value: number | undefined) => {
    if (value !== undefined && needsLimitPrice) {
      edit({ limitPrice: fieldText(value) });
    }
  };

  return (
    <div className="desk-pane ticket-pane">
      <div className="ticket">
        <header className="ticket-header">
          <div className="ticket-id">
            <span className="ticket-symbol">{symbol}</span>
            <span className="ticket-name">{quote?.name}</span>
          </div>
          {heldShares > 0 && (
            <div className="held-badge" aria-label={`${heldShares} shares currently held`}>
              {`${heldShares} held`}
            </div>
          )}
        </header>

        <div className="ladder" role="group" aria-label="Market prices">
          <button type="button" className="ladder-cell bid" disabled={!needsLimitPrice} onClick={() => takePrice(quote?.bid)}>
            <span className="ladder-label">Bid</span>
            <span className="ladder-value mono">{price(quote?.bid)}</span>
          </button>
          <div className="ladder-cell last">
            <span className="ladder-label">Last</span>
            <span className={`ladder-value mono${quote ? (quote.positive ? " pos" : " neg") : ""}`}>
              {price(quote?.lastPrice)}
            </span>
          </div>
          <button type="button" className="ladder-cell ask" disabled={!needsLimitPrice} onClick={() => takePrice(quote?.ask)}>
            <span className="ladder-label">Ask</span>
            <span className="ladder-value mono">{price(quote?.ask)}</span>
          </button>
        </div>

        {/* A single-choice group, not two toggles: the ticket always has a side,
            and the group gives it radio semantics and arrow-key navigation. */}
        <IgrButtonGroup
          className="bs-toggle"
          selection="single-required"
          aria-label="Order side"
          onSelect={(event) => {
            const option = SIDE_OPTIONS.find((entry) => entry.value === event.detail);
            if (option) {
              workspace.setTicketSide(option.value);
            }
          }}
        >
          {SIDE_OPTIONS.map((option) => (
            <IgrToggleButton
              key={option.value}
              value={option.value}
              className={`bs-btn ${option.value === "BUY" ? "bs-buy" : "bs-sell"}`}
              selected={side === option.value}
            >
              {option.label}
            </IgrToggleButton>
          ))}
        </IgrButtonGroup>

        <form className="ticket-form" noValidate onSubmit={onFormSubmit}>
          <div className="inline-row">
            <div className="form-row">
              <IgrInput
                className={numberFieldClass("quantity")}
                label="Quantity"
                type="number"
                min={1}
                step={1}
                value={fields.quantity}
                onInput={(event) => {
                  markChanged("quantity");
                  edit({ quantity: event.detail });
                }}
                onBlur={() => clearChanged("quantity")}
              />
            </div>

            <div className="form-row">
              <ChoiceSelect
                className="form-field"
                label="Order type"
                placeholder="Select type"
                value={fields.type}
                choices={ORDER_TYPE_CHOICES}
                onChoose={(value) => {
                  const type = ORDER_TYPES.find((entry) => entry === value);
                  if (type) {
                    edit({ type });
                  }
                }}
              />
            </div>
          </div>

          {/* The group shows which size the field holds. `single` rather than the
              side toggle's `single-required` — a hand-typed size belongs to none
              of these and leaves every button unlit. */}
          <IgrButtonGroup
            className="quick-qty"
            selection="single"
            aria-label="Quick quantities"
            onSelect={(event) => {
              const size = quickSizes.find((entry) => entry.label === event.detail);
              if (size && !size.disabled) {
                edit({ quantity: fieldText(size.quantity) });
              }
            }}
          >
            {quickSizes.map((size, index) => (
              <IgrToggleButton
                key={size.label}
                value={size.label}
                className={`qty-chip${size.label === "Max" ? " qty-max" : ""}`}
                disabled={size.disabled}
                selected={selectedQuickSize === index}
                title={size.hint}
                onClick={() => placeQuickSize(size)}
              >
                <span>{size.label}</span>
              </IgrToggleButton>
            ))}
          </IgrButtonGroup>

          <div className="inline-row">
            {needsLimitPrice && (
              <div className="form-row">
                <IgrInput
                  className={numberFieldClass("limitPrice")}
                  label="Limit price"
                  type="number"
                  step={0.01}
                  min={0.01}
                  value={fields.limitPrice}
                  onInput={(event) => {
                    markChanged("limitPrice");
                    edit({ limitPrice: event.detail });
                  }}
                  onBlur={() => clearChanged("limitPrice")}
                >
                  <span slot="prefix" className="field-prefix">$</span>
                </IgrInput>
              </div>
            )}

            {needsStopPrice && (
              <div className="form-row">
                <IgrInput
                  className={numberFieldClass("stopPrice")}
                  label={isTrailing ? "Trail amount" : "Stop price"}
                  type="number"
                  step={0.01}
                  min={0.01}
                  value={fields.stopPrice}
                  onInput={(event) => {
                    markChanged("stopPrice");
                    edit({ stopPrice: event.detail });
                  }}
                  onBlur={() => clearChanged("stopPrice")}
                >
                  <span slot="prefix" className="field-prefix">$</span>
                </IgrInput>
              </div>
            )}

            <div className="form-row tif-row">
              <ChoiceSelect
                className="form-field"
                label="Time in force"
                placeholder="TIF"
                value={fields.timeInForce}
                choices={TIME_IN_FORCE_CHOICES}
                onChoose={(value) => {
                  const timeInForce = TIME_IN_FORCE.find((entry) => entry === value);
                  if (timeInForce) {
                    edit({ timeInForce });
                  }
                }}
              />
            </div>
          </div>

          <dl className="estimate">
            <div className="estimate-row">
              <dt>Notional</dt>
              <dd className="mono">{money(notional)}</dd>
            </div>
            <div className="estimate-row">
              <dt>Commission</dt>
              <dd className="mono">{money(commission)}</dd>
            </div>
            <div className="estimate-row total">
              <dt>Est. total</dt>
              <dd className="mono">{money(total)}</dd>
            </div>
            <div className="estimate-row muted">
              <dt>Buying power</dt>
              <dd className="mono">{money(buyingPower)}</dd>
            </div>
          </dl>

          {rejection && (
            <p className="ticket-error" role="alert">
              <IgrIcon name="error_outline" collection={ICONS} aria-hidden="true" />
              {rejection}
            </p>
          )}

          <IgrButton
            variant="contained"
            type="button"
            className={`place-btn ${side === "BUY" ? "buy-action" : "sell-action"}`}
            disabled={!canSubmit}
            onClick={() => submit()}
          >
            {submitLabel}
          </IgrButton>
        </form>

        <IgrSnackbar ref={snackbarRef} displayTime={3200}>
          {notice?.text}
        </IgrSnackbar>
      </div>
    </div>
  );
}

export default memo(OrderTicket);
