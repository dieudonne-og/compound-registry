import { useCallback, useEffect, useRef } from 'react';
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { TOUR_VERSION } from '@cr/contracts';
import { useT } from '@/i18n/i18n';
import { useCan, usePreferences, useSession } from '@/features/auth/session';
import { buildTour } from './tour';

const SEEN_KEY = `tour-seen-v${TOUR_VERSION}`;
/** Set the moment the tour closes, so a page change before the account is updated does not start it again. */
const seenHere = () => {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

/** One tour at a time, even if the shell remounts while it is open. */
let running = false;

const isVisible = (target: string) => {
  const el = document.querySelector(`[data-tour="${target}"]`);
  return !!el && el.getClientRects().length > 0;
};

/** The role-aware guided tour; starts once for users who have not completed the current version. */
export function useTour() {
  const t = useT();
  const can = useCan();
  const { user, mustChangePassword, preferences } = useSession();
  const { update } = usePreferences();
  const started = useRef(false);
  // Read through a ref so `start` stays stable; `can` is a new function on every render.
  const latest = useRef({ can, t, update });
  useEffect(() => {
    latest.current = { can, t, update };
  });

  const start = useCallback(() => {
    if (running) return;
    running = true;
    const { can, t, update } = latest.current;
    const steps = buildTour((a) => can(a), isVisible);
    const tour = driver({
      showProgress: true,
      progressText: t('tour.progress', { current: '{{current}}', total: '{{total}}' }),
      nextBtnText: t('tour.next'),
      prevBtnText: t('tour.prev'),
      doneBtnText: t('tour.done'),
      popoverClass: 'app-tour',
      steps: steps.map((s) => ({
        element: s.target ? `[data-tour="${s.target}"]` : undefined,
        popover: { title: t(`tour.${s.id}.title`), description: t(`tour.${s.id}.body`) },
      })),
      onPopoverRender: (popover) => {
        // Expose the popover to assistive technology as a labelled dialog.
        popover.wrapper.setAttribute('role', 'dialog');
        popover.title.id = 'tour-title';
        popover.wrapper.setAttribute('aria-labelledby', 'tour-title');
      },
      // Runs on Escape, the close button and Done alike, including before the first step has settled.
      onDestroyStarted: () => {
        try {
          localStorage.setItem(SEEN_KEY, '1');
        } catch {
          /* the account preference below still records it */
        }
        update({ tour: { version: TOUR_VERSION, completedAt: new Date().toISOString() } }).catch(
          () => undefined,
        );
        tour.destroy();
      },
      onDestroyed: () => {
        running = false;
      },
    });
    tour.drive();
  }, []);

  const done = preferences.tour?.version === TOUR_VERSION;
  useEffect(() => {
    if (!user || mustChangePassword || done || started.current || seenHere()) return;
    // Wait for the shell to render; the flag is set inside the timer so a StrictMode re-run still starts it once.
    const timer = setTimeout(() => {
      if (seenHere()) return;
      started.current = true;
      start();
    }, 600);
    return () => clearTimeout(timer);
  }, [user, mustChangePassword, done, start]);

  return { start };
}
