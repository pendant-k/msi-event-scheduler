export const reservationStatusLabels = {
  RESERVED: "예약 완료",
  LATE_RESERVED: "현장 예약",
  CHECKED_IN: "체크인 완료",
  CANCELLED: "취소됨",
  NO_SHOW: "노쇼"
} as const;

export type ReservationStatus = keyof typeof reservationStatusLabels;

export function getReservationStatusLabel(status: string) {
  return reservationStatusLabels[status as ReservationStatus] ?? status;
}

export function getReservationStatusTone(status: string) {
  if (status === "CHECKED_IN") return "checked-in";
  if (status === "CANCELLED") return "cancelled";
  if (status === "NO_SHOW") return "no-show";
  if (status === "LATE_RESERVED") return "late";
  return "reserved";
}

export function isActiveReservationStatus(status: string) {
  return status === "RESERVED" || status === "LATE_RESERVED";
}
