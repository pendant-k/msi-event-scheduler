export class DomainError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_input"
      | "invalid_credentials"
      | "locked"
      | "duplicate_event"
      | "capacity_full"
      | "duplicate_reservation"
      | "event_closed"
      | "timeslot_closed"
      | "guardian_required"
      | "cancel_not_allowed"
      | "invalid_state"
      | "unauthorized",
    message: string
  ) {
    super(message);
  }
}
