import { useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

interface IsolatedRootProps {
  /** The class of the element that hosts the root. */
  className?: string;
  children: ReactNode;
}

/**
 * Renders its children in a React root of their own, inside a host element.
 *
 * Strict Mode covers one root. Children in a root of their own are rendered once, with their
 * effects and ref callbacks run once, even when the rest of the page runs in Strict Mode in
 * development. The Spreadsheet needs that: it starts a size watcher when it is constructed, and
 * it re-attaches its charts' containers on every ref callback, so Strict Mode's second
 * construction leaves a watcher behind and its extra ref callbacks leave the charts empty.
 */
export default function IsolatedRoot({ className, children }: IsolatedRootProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<Root>(null);
  const unmountTimer = useRef<number>(undefined);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    // The ref outlives Strict Mode's unmount and remount, so the root is created only once.
    const root = (rootRef.current ??= createRoot(host));
    window.clearTimeout(unmountTimer.current);

    return () => {
      // A root cannot be unmounted while React is committing. Strict Mode's remount follows
      // straight away and cancels this.
      unmountTimer.current = window.setTimeout(() => root.unmount());
    };
  }, []);

  useEffect(() => {
    rootRef.current?.render(children);
  }, [children]);

  return <div ref={hostRef} className={className} />;
}
