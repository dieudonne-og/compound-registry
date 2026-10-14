import { useEffect } from 'react';

/** `g` followed by one of these keys jumps to a page. */
export const SEQUENCES: Record<string, string> = {
  d: '/',
  p: '/production',
  c: '/compounds',
  u: '/compounds/upload',
};
const PREFIX = 'g';
const WINDOW_MS = 1000;

export function shortcutFor(sequence: string[]): string | null {
  if (sequence.length !== 2 || sequence[0] !== PREFIX) return null;
  return SEQUENCES[sequence[1]!] ?? null;
}

/** Keys typed into a field are text, not shortcuts. */
export function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable ||
    // isContentEditable is missing outside browsers; an empty attribute value also means editable.
    (el.hasAttribute('contenteditable') && el.getAttribute('contenteditable') !== 'false')
  );
}

/** `?` opens help; `g` then a key (within a second) navigates. */
export function useShortcuts({
  openHelp,
  navigate,
}: {
  openHelp: () => void;
  navigate: (to: string) => void;
}) {
  useEffect(() => {
    let pending: { key: string; at: number } | null = null;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (e.key === '?') {
        e.preventDefault();
        openHelp();
        return;
      }
      const key = e.key.toLowerCase();
      if (pending && Date.now() - pending.at < WINDOW_MS) {
        const to = shortcutFor([pending.key, key]);
        pending = null;
        if (to) {
          e.preventDefault();
          navigate(to);
        }
        return;
      }
      pending = key === PREFIX ? { key, at: Date.now() } : null;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openHelp, navigate]);
}
