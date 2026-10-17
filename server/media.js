export function formatSrtTimestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(remainder).padStart(3, '0')}`;
}

export function createSrt(captions) {
  return captions
    .map((caption, index) => `${index + 1}\n${formatSrtTimestamp(caption.start)} --> ${formatSrtTimestamp(caption.end)}\n${caption.text.replaceAll('-->', '—>')}`)
    .join('\n\n');
}

export function clampInterval(interval, duration) {
  const start = Math.max(0, Math.min(Number(interval.start) || 0, duration));
  const end = Math.max(start, Math.min(Number(interval.end) || 0, duration));

  return { ...interval, start, end };
}
