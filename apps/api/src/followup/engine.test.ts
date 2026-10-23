import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextFollowUp, daysToDeadline, messageKindFor } from './engine.ts';
import { DEFAULT_SETTINGS } from '../store/types.ts';

const settings = { ...DEFAULT_SETTINGS, dropoffDeadline: '2026-12-12' };

test('deadline math', () => {
  assert.equal(daysToDeadline(settings, new Date('2026-12-02T12:00:00')), 10);
  assert.equal(daysToDeadline(settings, new Date('2026-12-12T12:00:00')), 0);
  assert.equal(daysToDeadline(settings, new Date('2026-12-13T12:00:00')), -1);
});

test('claimed asks to confirm after 48h', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(nextFollowUp('Claimed', settings, now)!.toISOString(), '2026-11-22T12:00:00.000Z');
});

test('shopping reminders land at deadline-7/-3/-1', () => {
  const now = new Date('2026-11-20T12:00:00');
  const n = nextFollowUp('Shopping', settings, now)!;
  assert.equal(daysToDeadline(settings, n), 7);
  const n2 = nextFollowUp('Shopping', settings, new Date('2026-12-06T12:00:00'))!;
  assert.equal(daysToDeadline(settings, n2), 3);
});

test('terminal steps schedule nothing', () => {
  assert.equal(nextFollowUp('Delivered', settings), null);
  assert.equal(nextFollowUp('Released', settings), null);
});

test('message kind follows the step and the deadline', () => {
  const base: any = { status: 'Confirmed' };
  assert.equal(messageKindFor(base, settings, new Date('2026-11-01T12:00:00')), 'shopping_checkin');
  assert.equal(messageKindFor(base, settings, new Date('2026-12-10T12:00:00')), 'deadline_reminder');
  assert.equal(messageKindFor({ status: 'Claimed' } as any, settings), 'confirm_nudge');
  assert.equal(messageKindFor({ status: 'Delivered' } as any, settings), null);
});
