import { useEffect, useRef, useState } from "react";
import { IgrSelect, IgrSelectItem } from "igniteui-react";
import type { IgrCellTemplateContext } from "igniteui-react-grids";

interface OptionEditorProps {
  cell: IgrCellTemplateContext["cell"];
  options: readonly string[];
}

/**
 * The editor for a column with a fixed set of values: a select over the
 * options, which takes focus as soon as the cell enters edit mode.
 */
export function OptionEditor({ cell, options }: OptionEditorProps) {
  const select = useRef<IgrSelect>(null);
  // What the select holds, kept here so that its name and the selected item
  // follow every pick, whichever key or click made it.
  const [value, setValue] = useState(cell.editValue as string);

  useEffect(() => {
    const element = select.current;
    if (!element) return;

    // Focus is given here rather than through the `autofocus` attribute, which
    // the browser reports as ignored because the cell already holds focus.
    let mounted = true;
    void element.updateComplete.then(() => {
      if (mounted) element.focus();
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const element = select.current;
    if (!element) return;

    // The keys that act on the open list must not also act on the cell:
    // - Enter picks the highlighted item and closes the list, Escape only
    //   closes it; neither may commit or cancel the edit. The select closes its
    //   list before the event gets back to its host, so whether the list was
    //   open is noted on the way in, and the key is stopped on the way out. (A
    //   React handler is too late: React listens at the root, after the cell's
    //   own handler has run.)
    // - Space picks the highlighted item too; the select only opens its list.
    // - Tab leaves the cell with the value the select holds, not the highlighted
    //   item, so the list is closed before the select can pick that item on
    //   the way out.
    let wasOpen = false;
    const noteOpen = (event: KeyboardEvent) => {
      wasOpen = element.open;
      if (wasOpen && event.key === "Tab") void element.hide();
    };
    const keepKeyInList = (event: KeyboardEvent) => {
      if (!wasOpen) return;
      if (event.key === "Enter" || event.key === "Escape") {
        event.stopPropagation();
      } else if (event.key === " ") {
        event.stopPropagation();
        const highlighted = element.items.find((item) => item.active);
        if (highlighted) {
          element.select(highlighted.value);
          cell.editValue = highlighted.value;
          setValue(highlighted.value);
        }
        void element.hide();
        element.focus();
      }
    };
    element.addEventListener("keydown", noteOpen, true);
    element.addEventListener("keydown", keepKeyInList);

    return () => {
      element.removeEventListener("keydown", noteOpen, true);
      element.removeEventListener("keydown", keepKeyInList);
    };
  }, [cell]);

  // The value is also the placeholder, which names the combobox for assistive
  // technology (the select has no label of its own) and never shows while the
  // select holds a value. The items do not say which one is selected, so each
  // one does (as a string: React writes a boolean on a custom element as an
  // empty attribute).
  return (
    <IgrSelect
      ref={select}
      value={value}
      placeholder={value}
      onChange={(event) => {
        if (!event.detail) return;
        cell.editValue = event.detail.value;
        setValue(event.detail.value);
      }}
    >
      {options.map((option) => (
        <IgrSelectItem
          key={option}
          value={option}
          aria-selected={option === value ? "true" : "false"}
        >
          {option}
        </IgrSelectItem>
      ))}
    </IgrSelect>
  );
}
