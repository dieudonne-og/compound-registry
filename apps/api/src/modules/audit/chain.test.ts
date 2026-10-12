import { describe, expect, it } from 'vitest';
import {
  diffCritical,
  GENESIS_HASH,
  nextEvent,
  verifyChain,
  type CriticalSnapshot,
  type StoredEvent,
} from './chain';

const SECRET = 'a'.repeat(32);
const original: CriticalSnapshot = {
  productionCode: 'PRD-2026-000001',
  tagNumber: 'T-1',
  weightKg: '320.300',
  mineralTypeId: 1,
};
const actor = { actorId: 1, actorLabel: 'Alice Uwase (admin)' };

function buildChain(): { events: StoredEvent[]; current: CriticalSnapshot } {
  const e1 = nextEvent(SECRET, null, {
    productionId: 1,
    eventType: 'CREATE',
    changes: diffCritical(null, original),
    reason: null,
    occurredAt: '2026-10-01T08:00:00.000Z',
    ...actor,
  });
  const afterWeight = { ...original, weightKg: '318.500' };
  const e2 = nextEvent(SECRET, e1, {
    productionId: 1,
    eventType: 'UPDATE',
    changes: diffCritical(original, afterWeight),
    reason: 'Re-weighed at warehouse',
    occurredAt: '2026-10-02T08:00:00.000Z',
    ...actor,
  });
  const afterTag = { ...afterWeight, tagNumber: 'T-1A' };
  const e3 = nextEvent(SECRET, e2, {
    productionId: 1,
    eventType: 'UPDATE',
    changes: diffCritical(afterWeight, afterTag),
    reason: 'Tag replaced',
    occurredAt: '2026-10-03T08:00:00.000Z',
    ...actor,
  });
  return { events: [e1, e2, e3], current: afterTag };
}

describe('diffCritical', () => {
  it('records every field on creation', () => {
    expect(diffCritical(null, original).map((c) => c.field)).toEqual([
      'productionCode',
      'tagNumber',
      'weightKg',
      'mineralTypeId',
    ]);
  });
  it('records only changed fields with from and to', () => {
    expect(diffCritical(original, { ...original, mineralTypeId: 2 })).toEqual([
      { field: 'mineralTypeId', from: 1, to: 2 },
    ]);
  });
});

describe('verifyChain', () => {
  it('links events and reports an intact chain', () => {
    const { events, current } = buildChain();
    expect(events[0]!.prevHash).toBe(GENESIS_HASH);
    expect(events[1]!.prevHash).toBe(events[0]!.hash);
    expect(verifyChain(SECRET, events, current)).toEqual({ status: 'intact', eventsChecked: 3 });
  });

  it('detects an edited event', () => {
    const { events, current } = buildChain();
    events[1] = { ...events[1]!, reason: 'Nothing to see here' };
    expect(verifyChain(SECRET, events, current).failure).toMatchObject({ seq: 2, reason: 'HASH_MISMATCH' });
  });

  it('detects an event deleted from the middle', () => {
    const { events, current } = buildChain();
    expect(verifyChain(SECRET, [events[0]!, events[2]!], current).failure).toMatchObject({
      seq: 3,
      reason: 'SEQUENCE_GAP',
    });
  });

  it('detects the latest event being deleted', () => {
    const { events, current } = buildChain();
    expect(verifyChain(SECRET, events.slice(0, 2), current).failure).toMatchObject({
      reason: 'STATE_MISMATCH',
    });
  });

  it('detects the record being changed outside the application', () => {
    const { events, current } = buildChain();
    expect(verifyChain(SECRET, events, { ...current, weightKg: '500.000' }).failure).toMatchObject({
      seq: null,
      reason: 'STATE_MISMATCH',
    });
  });

  it('detects a chain rebuilt without the secret', () => {
    const { events, current } = buildChain();
    expect(verifyChain('b'.repeat(32), events, current).failure).toMatchObject({
      seq: 1,
      reason: 'HASH_MISMATCH',
    });
  });

  it('detects missing history', () => {
    expect(verifyChain(SECRET, [], original).failure?.reason).toBe('NO_EVENTS');
    const { events, current } = buildChain();
    expect(verifyChain(SECRET, events.slice(1), current).failure?.reason).toBe('MISSING_CREATE');
  });
});
