import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

const timestamptz = (name: string) => timestamp(name, { mode: "string", withTimezone: true });

export const events = pgTable("events", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  timezone: text("timezone").notNull().default("Asia/Seoul"),
  status: text("status", { enum: ["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"] }).notNull(),
  reservationCloseAfterMinutes: integer("reservation_close_after_minutes").notNull().default(20),
  allowLateReservation: boolean("allow_late_reservation").notNull().default(true),
  allowMultipleBooking: boolean("allow_multiple_booking").notNull().default(false),
  allowParticipantCancellation: boolean("allow_participant_cancellation").notNull().default(true),
  participantCancelUntilMinutesBeforeStart: integer("participant_cancel_until_minutes_before_start").notNull().default(0),
  enableTournament: boolean("enable_tournament").notNull().default(true),
  tournamentCapacity: integer("tournament_capacity").notNull().default(32),
  minGuardianRequiredGrade: integer("min_guardian_required_grade").notNull().default(1),
  maxGuardianRequiredGrade: integer("max_guardian_required_grade").notNull().default(4),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at").notNull().defaultNow()
});

export const eventDays = pgTable(
  "event_days",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventDate: text("event_date").notNull(),
    label: text("label"),
    startsAt: timestamptz("starts_at"),
    endsAt: timestamptz("ends_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow()
  },
  (table) => ({
    eventDateIdx: index("idx_event_days_event_date").on(table.eventId, table.eventDate),
    uniqueEventDate: uniqueIndex("event_days_event_date_unique").on(table.eventId, table.eventDate)
  })
);

export const eventAdmins = pgTable(
  "event_admins",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    adminUserId: text("admin_user_id").notNull(),
    role: text("role", { enum: ["OWNER", "MANAGER", "STAFF"] }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow()
  },
  (table) => ({
    uniqueAdmin: uniqueIndex("event_admins_event_admin_unique").on(table.eventId, table.adminUserId)
  })
);

export const participantAccesses = pgTable(
  "participant_accesses",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    phoneNumber: text("phone_number").notNull(),
    phoneLast4: text("phone_last4").notNull(),
    passwordHash: text("password_hash").notNull(),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamptz("locked_until"),
    lastLoginAt: timestamptz("last_login_at"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow()
  },
  (table) => ({
    uniquePhone: uniqueIndex("participant_accesses_event_phone_unique").on(table.eventId, table.phoneNumber),
    phoneLast4Idx: index("idx_participant_accesses_event_phone_last4").on(table.eventId, table.phoneLast4)
  })
);

export const participantSessions = pgTable(
  "participant_sessions",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    accessId: text("access_id").notNull().references(() => participantAccesses.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    lastSeenAt: timestamptz("last_seen_at")
  },
  (table) => ({
    tokenUnique: uniqueIndex("participant_sessions_token_unique").on(table.sessionTokenHash),
    accessExpiresIdx: index("idx_participant_sessions_access_expires").on(table.accessId, table.expiresAt)
  })
);

export const participants = pgTable(
  "participants",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    accessId: text("access_id").notNull().references(() => participantAccesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    school: text("school").notNull(),
    grade: integer("grade").notNull(),
    guardianRequired: boolean("guardian_required").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow()
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

export const timeslots = pgTable(
  "timeslots",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    eventDayId: text("event_day_id").notNull().references(() => eventDays.id, { onDelete: "cascade" }),
    startsAt: timestamptz("starts_at").notNull(),
    endsAt: timestamptz("ends_at").notNull(),
    capacity: integer("capacity").notNull(),
    reservedCount: integer("reserved_count").notNull().default(0),
    status: text("status", { enum: ["OPEN", "CLOSED", "HIDDEN"] }).notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow()
  },
  (table) => ({
    eventDayStartsIdx: index("idx_timeslots_event_day_starts").on(table.eventId, table.eventDayId, table.startsAt)
  })
);

export const reservations = pgTable(
  "reservations",
  {
    id: text("id").primaryKey(),
    eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    timeslotId: text("timeslot_id").notNull().references(() => timeslots.id),
    accessId: text("access_id").notNull().references(() => participantAccesses.id),
    participantId: text("participant_id").notNull().references(() => participants.id),
    status: text("status", { enum: ["RESERVED", "LATE_RESERVED", "CHECKED_IN", "CANCELLED", "NO_SHOW"] }).notNull(),
    tournament: boolean("tournament").notNull().default(false),
    duplicateKey: text("duplicate_key"),
    reservationCode: text("reservation_code").notNull(),
    checkInCode: text("check_in_code").notNull(),
    isOverbooked: boolean("is_overbooked").notNull().default(false),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at").notNull().defaultNow(),
    checkedInAt: timestamptz("checked_in_at"),
    cancelledAt: timestamptz("cancelled_at"),
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

export const adminLogs = pgTable("admin_logs", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  adminUserId: text("admin_user_id").notNull(),
  action: text("action").notNull(),
  targetType: text("target_type").notNull(),
  targetId: text("target_id"),
  reason: text("reason"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamptz("created_at").notNull().defaultNow()
});

export type Event = typeof events.$inferSelect;
export type EventDay = typeof eventDays.$inferSelect;
export type Timeslot = typeof timeslots.$inferSelect;
export type Reservation = typeof reservations.$inferSelect;
export type ParticipantAccess = typeof participantAccesses.$inferSelect;
export type Participant = typeof participants.$inferSelect;
