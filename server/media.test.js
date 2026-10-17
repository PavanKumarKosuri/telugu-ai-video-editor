import test from 'node:test';
import assert from 'node:assert/strict';
import { clampInterval, createSrt, formatSrtTimestamp, getHighlightWindow } from './media.js';

test('formats subtitle timestamps with millisecond precision', () => {
  assert.equal(formatSrtTimestamp(3661.234), '01:01:01,234');
});

test('creates numbered SRT cues and sanitizes the cue separator', () => {
  assert.equal(
    createSrt([
      { start: 0, end: 1.25, text: 'నమస్కారం --> అందరికీ' },
      { start: 2, end: 3, text: 'Hello' },
    ]),
    '1\n00:00:00,000 --> 00:00:01,250\nనమస్కారం —> అందరికీ\n\n2\n00:00:02,000 --> 00:00:03,000\nHello',
  );
});

test('clamps model-generated timestamps to the actual clip duration', () => {
  assert.deepEqual(clampInterval({ start: -3, end: 40 }, 12), { start: 0, end: 12 });
  assert.deepEqual(clampInterval({ start: 8, end: 3 }, 12), { start: 8, end: 8 });
});

test('centers reels around the detected highlight without exceeding the timeline', () => {
  assert.deepEqual(getHighlightWindow({ start: 40, end: 44 }, 15, 100), { start: 34.5, end: 49.5 });
  assert.deepEqual(getHighlightWindow({ start: 1, end: 4 }, 15, 100), { start: 0, end: 15 });
  assert.deepEqual(getHighlightWindow({ start: 1, end: 4 }, 60, 20), { start: 0, end: 20 });
});
