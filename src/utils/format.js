function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDuration(durationInSeconds) {
  if (typeof durationInSeconds !== 'number' || Number.isNaN(durationInSeconds)) {
    return 'Unknown';
  }
  if (!Number.isFinite(durationInSeconds) || durationInSeconds <= 0) {
    return 'Live';
  }
  const hours = Math.floor(durationInSeconds / 3600);
  const minutes = Math.floor((durationInSeconds % 3600) / 60);
  const seconds = Math.floor(durationInSeconds % 60);
  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minutes}:${pad(seconds)}`;
}

function formatProgress(position, total) {
  const safePos = typeof position === 'number' && Number.isFinite(position) ? position : 0;
  const safeTotal = typeof total === 'number' && Number.isFinite(total) ? total : 0;
  return `${formatDuration(safePos)} / ${formatDuration(safeTotal)}`;
}

function parseTimestamp(input) {
  if (!input) return NaN;
  const safe = String(input).trim();
  if (!safe.length) return NaN;
  if (/^\d+$/.test(safe)) {
    return Number(safe);
  }
  const parts = safe.split(':').map((part) => Number(part));
  if (parts.some((value) => Number.isNaN(value))) {
    return NaN;
  }
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes * 60) + seconds;
  }
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (hours * 3600) + (minutes * 60) + seconds;
  }
  return NaN;
}

module.exports = {
  formatDuration,
  formatProgress,
  parseTimestamp,
};
