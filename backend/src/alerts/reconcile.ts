import type { AlertType } from '../../../shared/types';
import type { Breach } from '../thresholds/evaluate';

/** Minimal shape of an already-open alert (only the type matters for diffing). */
export interface OpenAlertRef {
  type: AlertType;
}

/** The decision produced by reconciling current breaches against open alerts. */
export interface Reconciliation {
  /** Breaches with no matching open alert → new alerts to insert. */
  toOpen: Breach[];
  /** Open alerts whose breach has cleared → alerts to resolve. */
  toResolve: AlertType[];
}

/**
 * Pure diff between "what is breached right now" and "what alerts are already
 * open". Keeping this separate from the database makes the open/resolve rules
 * trivial to unit-test and easy to explain: one active alert per type, opened
 * when a breach appears and resolved when it disappears.
 */
export function reconcile(breaches: Breach[], openAlerts: OpenAlertRef[]): Reconciliation {
  const breachedTypes = new Set(breaches.map((b) => b.type));
  const openTypes = new Set(openAlerts.map((a) => a.type));

  const toOpen = breaches.filter((b) => !openTypes.has(b.type));
  const toResolve = [...openTypes].filter((t) => !breachedTypes.has(t));

  return { toOpen, toResolve };
}
