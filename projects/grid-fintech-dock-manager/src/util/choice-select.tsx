import { useLayoutEffect, useRef } from "react";
import { IgrIcon, IgrSelect, IgrSelectItem } from "igniteui-react";
import { ICONS } from "./icons";

/** One entry of a {@link ChoiceSelect}: the value it stands for and the text it shows. */
export interface Choice {
  value: string;
  label: string;
}

interface ChoiceSelectProps {
  className?: string;
  label?: string;
  placeholder?: string;
  /** The accessible name of a select that has no visible label. */
  ariaLabel?: string;
  /** A glyph from the app's icon collection, shown before the value. */
  prefixIcon?: string;
  /** The chosen value; the select follows it. */
  value: string;
  choices: readonly Choice[];
  onChoose: (value: string) => void;
}

/**
 * A single-choice drop-down that keeps its keyboard position while the desk
 * re-renders around it.
 *
 * The select's `value` setter selects and highlights its item even when the
 * value is the one it already holds, and a wrapper prop is assigned again on
 * every render. The ticket and the news pane render on every tick, so a `value`
 * prop would send the highlight of an open list back to the chosen item within
 * a second, and a trader moving through the list with the arrow keys could
 * never get past the first step. The value is therefore applied here, and only
 * when it differs from the select's own, which is already the case for a pick
 * the user has just made.
 */
export function ChoiceSelect({
  className,
  label,
  placeholder,
  ariaLabel,
  prefixIcon,
  value,
  choices,
  onChoose,
}: ChoiceSelectProps) {
  const selectRef = useRef<IgrSelect>(null);

  // No dependency list: the comparison is cheaper than working out when it is needed.
  useLayoutEffect(() => {
    const select = selectRef.current;
    if (select && select.value !== value) {
      select.value = value;
    }
  });

  return (
    <IgrSelect
      ref={selectRef}
      className={className}
      label={label}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => {
        const chosen = event.detail?.value;
        if (chosen !== undefined) {
          onChoose(chosen);
        }
      }}
    >
      {prefixIcon && <IgrIcon slot="prefix" name={prefixIcon} collection={ICONS} aria-hidden="true" />}
      {choices.map((choice) => (
        <IgrSelectItem key={choice.value} value={choice.value}>
          {choice.label}
        </IgrSelectItem>
      ))}
    </IgrSelect>
  );
}
