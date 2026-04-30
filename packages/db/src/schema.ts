import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const events = sqliteTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] }).notNull(),
  reservationCloseAfterMinutes: integer("reservation_close_after_minutes").notNull().default(20),
  allowLateReservation: integer("allow_late_reservation", { mode: "boolean" }).notNull().default(true),
  allowMultipleBooking: integer("allow_multiple_booking", { mode: "boolean" }).notNull().default(false),
  allowParticipantCancellation: integer("allow_participant_cancellation", { mode: "boolean" }).notNull().default(true),
  participantCancelUntilMinutesBeforeStart: integer("participant_cancel_until_minutes_before_start").notNull().default(0),
  enableTournament: integer("enable_tournament", { mode: "boolean" }).notNull().default(true),
  tournamentCapacity: integer("tournament_capacity").notNull().default(32),
  minGuardianRequiredGrade: integer("min_guardian_required_grade").notNull().default(1),
  maxGuardianRequiredGrade: integer("max_guardian_required_grade").notNull().default(4),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull()
});

export const eventDays = sqliteTable(
  "event_days",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventDate: text("event_date").notNull(),
    label: text("label"),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    eventDateIdx: index("idx_event_days_event_date").on(table.eventId, table.eventDate),
    uniqueEventDate: uniqueIndex("event_days_event_date_unique").on(table.eventId, table.eventDate)
  })
);

export const eventAdmins = sqliteTable(
  "event_admins",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id").notNull(),
    role: text("role", { enum: ["OWNER", "MANAGER", "STAFF"] }).notNull(),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    uniqueAdmin: uniqueIndex("event_admins_event_admin_unique").on(table.eventId, table.adminUserId)
  })
);

export const participantAccesses = sqliteTable(
  "participant_accesses",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    phoneLast4: text("phone_last4").notNull(),
    passwordHash: text("password_hash").notNull(),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: text("locked_until"),
    lastLoginAt: text("last_login_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    uniquePhone: uniqueIndex("participant_accesses_event_phone_unique").on(table.eventId, table.phoneNumber),
    phoneLast4Idx: index("idx_participant_accesses_event_phone_last4").on(table.eventId, table.phoneLast4)
  })
);

export const participantSessions = sqliteTable(
  "participant_sessions",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    accessId: text("access_id").notNull().references(() => participantAccesses.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
    lastSeenAt: text("last_seen_at")
  },
  (table) => ({
    tokenUnique: uniqueIndex("participant_sessions_token_unique").on(table.sessionTokenHash),
    accessExpiresIdx: index("idx_participant_sessions_access_expires").on(table.accessId, table.expiresAt)
  })
);

export const participants = sqliteTable(
  "participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    accessId: text("access_id").notNull().references(() => participantAccesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    school: text("school").notNull(),
    grade: integer("grade").notNull(),
    guardianRequired: integer("guardian_required", { mode: "boolean" }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    uniqueParticipant: uniqueIndex("participants_event_identity_unique").on(
      table.eventId,
      table.accessId,
      table.name,
      table.school,
      table.grade
    ),
    nameIdx: index("idx_participants_event_name").on(table.eventId, table.name),
    schoolIdx: index("idx_participants_event_school").on(table.eventId, table.school)
  })
);

export const timeslots = sqliteTable(
  "timeslots",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventDayId: text("event_day_id").notNull().references(() => eventDays.id, { onDelete: "cascade" }),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    capacity: integer("capacity").notNull(),
    reservedCount: integer("reserved_count").notNull().default(0),
    status: text("status", { enum: ["OPEN", "CLOSED", "HIDDEN"] }).notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull()
  },
  (table) => ({
    eventDayStartsIdx: index("idx_timeslots_event_day_starts").on(table.eventId, table.eventDayId, table.startsAt)
  })
);

export const reservations = sqliteTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    timeslotId: text("timeslot_id").notNull().references(() => timeslots.id),
    accessId: text("access_id").notNull().references(() => participantAccesses.id),
    participantId: text("participant_id").notNull().references(() => participants.id),
    status: text("status", { enum: ["RESERVED", "LATE_RESERVED", "CHECKED_IN", "CANCELLED", "NO_SHOW"] }).notNull(),
    tournament: integer("tournament", { mode: "boolean" }).notNull().default(false),
    duplicateKey: text("duplicate_key"),
    reservationCode: text("reservation_code").notNull(),
    checkInCode: text("check_in_code").notNull(),
    isOverbooked: integer("is_overbooked", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    checkedInAt: text("checked_in_at"),
    cancelledAt: text("cancelled_at"),
    cancelledBy: text("cancelled_by", { enum: ["PARTICIPANT", "ADMIN"] }),
    cancellationReason: text("cancellation_reason")
  },
  (table) => ({
    reservationCodeUnique: uniqueIndex("reservations_event_reservation_code_unique").on(table.eventId, table.reservationCode),
    checkInCodeUnique: uniqueIndex("reservations_event_check_in_code_unique").on(table.eventId, table.checkInCode),
    timeslotStatusIdx: index("idx_reservations_event_timeslot_status").on(table.eventId, table.timeslotId, table.status),
    activeDuplicateKeyUnique: uniqueIndex("idx_reservations_active_duplicate_key_unique")
      .on(table.eventId, table.duplicateKey)
      .where(sql`duplicate_key is not null and status in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN')`)
  })
);

export const adminLogs = sqliteTable("admin_logs", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  adminUserId: text("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  reason: text("reason"),
  metadata: text("metadata").notNull().default("{}"),
  createdAt: text("created_at").notNull()
});

export type Event = typeof events.$inferSelect;
export type EventDay = typeof eventDays.$inferSelect;
export type Timeslot = typeof timeslots.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type ParticipantAccess = typeof participantAccesses.$inferSelect;
export type Participant = typeof participants.$inferSelect;
