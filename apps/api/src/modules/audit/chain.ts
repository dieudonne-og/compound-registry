import { createHmac } from 'node:crypto';
import { CRITICAL_FIELDS, type CriticalField, type FieldChange, type VerifyResult } from '@cr/contracts';
import { canonicalJson } from './canonical';

export const GENESIS_HASH = '0'.repeat(64);

export type CriticalSnapshot = {
  productionCode: string;
  tagNumber: string;
  weightKg: string;
  mineralTypeId: number;
};

export type ChainEvent = {
  productionId: number;
  seq: number;
  eventType: 'CREATE' | 'UPDATE';
  changes: FieldChange[];
  reason: string | null;
  actorId: number;
  actorLabel: string;
  occurredAt: string;
  prevHash: string;
};
export type StoredEvent = ChainEvent & { hash: string };

const LABELS: Record<CriticalField, string> = {
  productionCode: 'production ID',
  tagNumber: 'tag number',
  weightKg: 'weight',
  mineralTypeId: 'mineral type',
};

export function computeEventHash(secret: string, event: ChainEvent): string {
  const { productionId, seq, eventType, changes, reason, actorId, actorLabel, occurredAt, prevHash } = event;
  return createHmac('sha256', secret)
    .update(
      canonicalJson({
        productionId,
        seq,
        eventType,
        changes,
        reason,
        actorId,
        actorLabel,
        occurredAt,
        prevHash,
      }),
    )
    .digest('hex');
}

export function nextEvent(
  secret: string,
  last: StoredEvent | null,
  data: Omit<ChainEvent, 'seq' | 'prevHash'>,
): StoredEvent {
  const event: ChainEvent = { ...data, seq: (last?.seq ?? 0) + 1, prevHash: last?.hash ?? GENESIS_HASH };
  return { ...event, hash: computeEventHash(secret, event) };
}

export function diffCritical(before: CriticalSnapshot | null, after: CriticalSnapshot): FieldChange[] {
  return CRITICAL_FIELDS.filter((f) => !before || before[f] !== after[f]).map((field) => ({
    field,
    from: before ? before[field] : null,
    to: after[field],
  }));
}

export function verifyChain(secret: string, events: StoredEvent[], current: CriticalSnapshot): VerifyResult {
  let checked = 0;
  const tampered = (
    seq: number | null,
    reason: NonNullable<VerifyResult['failure']>['reason'],
    message: string,
    params?: Record<string, string | number>,
  ): VerifyResult => ({
    status: 'tampered',
    eventsChecked: checked,
    failure: { seq, reason, message, ...(params && { params }) },
  });

  if (!events.length) return tampered(null, 'NO_EVENTS', 'No audit history exists for this record.');
  if (events[0]!.eventType !== 'CREATE' || events[0]!.seq !== 1) {
    return tampered(events[0]!.seq, 'MISSING_CREATE', 'The original registration event is missing.');
  }

  const state: Partial<Record<CriticalField, string | number>> = {};
  let prevHash = GENESIS_HASH;
  for (const [i, event] of events.entries()) {
    checked = i + 1;
    if (event.seq !== i + 1) {
      return tampered(
        event.seq,
        'SEQUENCE_GAP',
        `Event #${i + 1} is missing; the history jumps to #${event.seq}.`,
        { expected: i + 1, seq: event.seq },
      );
    }
    if (event.prevHash !== prevHash) {
      return tampered(
        event.seq,
        'PREV_HASH_MISMATCH',
        `Event #${event.seq} is not linked to the event before it.`,
        { seq: event.seq },
      );
    }
    if (computeEventHash(secret, event) !== event.hash) {
      return tampered(event.seq, 'HASH_MISMATCH', `Event #${event.seq} was altered after it was recorded.`, {
        seq: event.seq,
      });
    }
    for (const change of event.changes) state[change.field] = change.to;
    prevHash = event.hash;
  }

  for (const field of CRITICAL_FIELDS) {
    if (String(state[field]) !== String(current[field])) {
      return tampered(
        null,
        'STATE_MISMATCH',
        `The current ${LABELS[field]} (${current[field]}) differs from the audited value (${state[field]}). ` +
          'The record was changed outside the application or recent history was removed.',
        { field, current: String(current[field]), audited: String(state[field]) },
      );
    }
  }
  return { status: 'intact', eventsChecked: events.length };
}
