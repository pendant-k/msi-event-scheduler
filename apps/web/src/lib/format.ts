const seoulOffsetMs = 9 * 60 * 60 * 1000;

function seoulDate(value: string) {
  return new Date(new Date(value).getTime() + seoulOffsetMs);
}

function timeText(hours: number, minutes: number) {
  const period = hours < 12 ? "오전" : "오후";
  const hour12 = hours % 12 || 12;
  return `${period} ${String(hour12).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatDateTime(value: string) {
  const date = seoulDate(value);
  return `${date.getUTCMonth() + 1}. ${date.getUTCDate()}. ${timeText(date.getUTCHours(), date.getUTCMinutes())}`;
}

export function formatTime(value: string) {
  const date = seoulDate(value);
  return timeText(date.getUTCHours(), date.getUTCMinutes());
}

export function formatClockTime(value: string) {
  const date = seoulDate(value);
  return `${timeText(date.getUTCHours(), date.getUTCMinutes())}:${String(date.getUTCSeconds()).padStart(2, "0").slice(-2)}`;
}
