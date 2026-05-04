import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import type { SchedulerDb, TournamentEntrant, TournamentMatch } from "@scheduler/db";
import {
  adminLogs,
  events,
  participantAccesses,
  participants,
  reservations,
  timeslots,
  tournamentCheckins,
  tournamentEntrants,
  tournamentMatches,
  tournaments
} from "@scheduler/db";
import { assertEventAdmin } from "./admin";
import { DomainError } from "./errors";
import { id, maskPhone, nowIso } from "./utils";

type TournamentDb = SchedulerDb;
type BracketSize = 4 | 8 | 16 | 32 | 64;
type SeedingMode = "MANUAL" | "CHECK_IN_ORDER" | "RANDOM";

const activeReservationStatusSql = sql`${reservations.status} in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN')`;
const bracketSizes = new Set([4, 8, 16, 32, 64]);

function assertBracketSize(value: number): BracketSize {
  if (!bracketSizes.has(value)) throw new DomainError("invalid_input", "대진 규모가 올바르지 않습니다.");
  return value as BracketSize;
}

function finalRound(bracketSize: number) {
  return Math.log2(bracketSize);
}

function matchStatus(match: Pick<TournamentMatch, "entrantAId" | "entrantBId" | "winnerEntrantId">) {
  if (match.winnerEntrantId) return "COMPLETED" as const;
  if (match.entrantAId || match.entrantBId) return "READY" as const;
  return "PENDING" as const;
}

function autoWinner(entrantAId: string | null, entrantBId: string | null) {
  if (entrantAId && !entrantBId) return entrantAId;
  if (!entrantAId && entrantBId) return entrantBId;
  return null;
}

function loser(match: Pick<TournamentMatch, "entrantAId" | "entrantBId" | "winnerEntrantId">) {
  if (!match.winnerEntrantId || !match.entrantAId || !match.entrantBId) return null;
  return match.winnerEntrantId === match.entrantAId ? match.entrantBId : match.entrantAId;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index]!;
    copy[index] = copy[swapIndex]!;
    copy[swapIndex] = current;
  }
  return copy;
}

async function logTournamentAction(
  db: TournamentDb,
  input: { eventId: string; adminUserId: string; action: string; targetId?: string; metadata?: Record<string, unknown> }
) {
  await db.insert(adminLogs).values({
    id: id("log"),
    eventId: input.eventId,
    adminUserId: input.adminUserId,
    action: input.action,
    targetType: "tournament",
    targetId: input.targetId ?? null,
    reason: null,
    metadata: input.metadata ?? {},
    createdAt: nowIso()
  });
}

async function getTournamentOrThrow(db: TournamentDb, tournamentId: string, adminUserId: string) {
  const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!tournament) throw new DomainError("not_found", "대회 대진표를 찾을 수 없습니다.");
  await assertEventAdmin(db, tournament.eventId, adminUserId);
  return tournament;
}

async function refreshTournamentCompletion(db: TournamentDb, tournamentId: string) {
  const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, tournamentId) });
  if (!tournament || tournament.status === "DRAFT") return;
  const final = await db.query.tournamentMatches.findFirst({
    where: and(eq(tournamentMatches.tournamentId, tournamentId), eq(tournamentMatches.kind, "MAIN"), eq(tournamentMatches.round, finalRound(tournament.bracketSize)))
  });
  const thirdPlace = tournament.includeThirdPlace
    ? await db.query.tournamentMatches.findFirst({
        where: and(eq(tournamentMatches.tournamentId, tournamentId), eq(tournamentMatches.kind, "THIRD_PLACE"))
      })
    : null;
  const completed = Boolean(final?.winnerEntrantId && (!tournament.includeThirdPlace || thirdPlace?.winnerEntrantId));
  await db
    .update(tournaments)
    .set({ status: completed ? "COMPLETED" : "STARTED", completedAt: completed ? nowIso() : null, updatedAt: nowIso() })
    .where(eq(tournaments.id, tournamentId));
}

async function updateMatchAndPropagate(
  db: TournamentDb,
  input: {
    tournamentId: string;
    kind: "MAIN" | "THIRD_PLACE";
    round: number;
    matchIndex: number;
    entrantAId?: string | null;
    entrantBId?: string | null;
    winnerEntrantId?: string | null;
  }
) {
  const current = await db.query.tournamentMatches.findFirst({
    where: and(
      eq(tournamentMatches.tournamentId, input.tournamentId),
      eq(tournamentMatches.kind, input.kind),
      eq(tournamentMatches.round, input.round),
      eq(tournamentMatches.matchIndex, input.matchIndex)
    )
  });
  if (!current) return;

  const entrantAId = input.entrantAId === undefined ? current.entrantAId : input.entrantAId;
  const entrantBId = input.entrantBId === undefined ? current.entrantBId : input.entrantBId;
  const requestedWinner = input.winnerEntrantId === undefined ? current.winnerEntrantId : input.winnerEntrantId;
  const winnerEntrantId = requestedWinner && (requestedWinner === entrantAId || requestedWinner === entrantBId) ? requestedWinner : autoWinner(entrantAId, entrantBId);

  await db
    .update(tournamentMatches)
    .set({ entrantAId, entrantBId, winnerEntrantId, status: matchStatus({ entrantAId, entrantBId, winnerEntrantId }), updatedAt: nowIso() })
    .where(eq(tournamentMatches.id, current.id));

  const updated = { ...current, entrantAId, entrantBId, winnerEntrantId };
  const tournament = await db.query.tournaments.findFirst({ where: eq(tournaments.id, input.tournamentId) });
  if (!tournament) return;

  if (updated.kind === "MAIN" && updated.round < finalRound(tournament.bracketSize)) {
    const nextRound = updated.round + 1;
    const nextMatchIndex = Math.ceil(updated.matchIndex / 2);
    const nextPatch = updated.matchIndex % 2 === 1 ? { entrantAId: updated.winnerEntrantId, winnerEntrantId: null } : { entrantBId: updated.winnerEntrantId, winnerEntrantId: null };
    await updateMatchAndPropagate(db, {
      tournamentId: updated.tournamentId,
      kind: "MAIN",
      round: nextRound,
      matchIndex: nextMatchIndex,
      ...nextPatch
    });
  }

  if (updated.kind === "MAIN" && tournament.includeThirdPlace && updated.round === finalRound(tournament.bracketSize) - 1) {
    const thirdPatch = updated.matchIndex === 1 ? { entrantAId: loser(updated), winnerEntrantId: null } : { entrantBId: loser(updated), winnerEntrantId: null };
    await updateMatchAndPropagate(db, {
      tournamentId: updated.tournamentId,
      kind: "THIRD_PLACE",
      round: 1,
      matchIndex: 1,
      ...thirdPatch
    });
  }

  await refreshTournamentCompletion(db, updated.tournamentId);
}

async function activeTournamentCheckinRows(db: TournamentDb, eventId: string) {
  return db
    .select({
      reservationId: reservations.id,
      reservationCode: reservations.reservationCode,
      reservationStatus: reservations.status,
      participantName: participants.name,
      school: participants.school,
      grade: participants.grade,
      maskedPhone: participantAccesses.phoneNumber,
      startsAt: timeslots.startsAt,
      checkedInAt: tournamentCheckins.checkedInAt
    })
    .from(tournamentCheckins)
    .innerJoin(reservations, eq(reservations.id, tournamentCheckins.reservationId))
    .innerJoin(participants, eq(participants.id, reservations.participantId))
    .innerJoin(participantAccesses, eq(participantAccesses.id, reservations.accessId))
    .innerJoin(timeslots, eq(timeslots.id, reservations.timeslotId))
    .where(and(eq(tournamentCheckins.eventId, eventId), sql`${tournamentCheckins.cancelledAt} is null`))
    .orderBy(asc(tournamentCheckins.checkedInAt));
}

async function assertTournamentReadyReservation(db: TournamentDb, eventId: string, reservationId: string) {
  const row = await db
    .select({
      reservationId: reservations.id,
      tournament: reservations.tournament,
      status: reservations.status,
      checkinId: tournamentCheckins.id,
      cancelledAt: tournamentCheckins.cancelledAt
    })
    .from(reservations)
    .leftJoin(tournamentCheckins, eq(tournamentCheckins.reservationId, reservations.id))
    .where(and(eq(reservations.id, reservationId), eq(reservations.eventId, eventId)))
    .limit(1);
  const reservation = row[0];
  if (!reservation || !reservation.tournament) throw new DomainError("invalid_input", "대회 신청 예약이 아닙니다.");
  if (!reservation.checkinId || reservation.cancelledAt) throw new DomainError("invalid_state", "대회 체크인이 필요합니다.");
  return reservation;
}

export async function getTournamentDashboard(db: SchedulerDb, eventId: string, adminUserId: string) {
  await assertEventAdmin(db, eventId, adminUserId);
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) throw new DomainError("not_found", "행사를 찾을 수 없습니다.");

  const applicants = await db
    .select({
      reservationId: reservations.id,
      reservationCode: reservations.reservationCode,
      reservationStatus: reservations.status,
      participantName: participants.name,
      school: participants.school,
      grade: participants.grade,
      phoneNumber: participantAccesses.phoneNumber,
      startsAt: timeslots.startsAt,
      tournamentCheckinId: tournamentCheckins.id,
      tournamentCheckedInAt: tournamentCheckins.checkedInAt,
      tournamentCheckinCancelledAt: tournamentCheckins.cancelledAt
    })
    .from(reservations)
    .innerJoin(participants, eq(participants.id, reservations.participantId))
    .innerJoin(participantAccesses, eq(participantAccesses.id, reservations.accessId))
    .innerJoin(timeslots, eq(timeslots.id, reservations.timeslotId))
    .leftJoin(tournamentCheckins, eq(tournamentCheckins.reservationId, reservations.id))
    .where(and(eq(reservations.eventId, eventId), eq(reservations.tournament, true), activeReservationStatusSql))
    .orderBy(asc(timeslots.startsAt), asc(participants.name));

  const tournament = await db.query.tournaments.findFirst({
    where: eq(tournaments.eventId, eventId),
    orderBy: desc(tournaments.createdAt)
  });
  const entrants = tournament
    ? await db
        .select({
          id: tournamentEntrants.id,
          tournamentId: tournamentEntrants.tournamentId,
          reservationId: tournamentEntrants.reservationId,
          seed: tournamentEntrants.seed,
          participantName: participants.name,
          school: participants.school,
          grade: participants.grade,
          reservationCode: reservations.reservationCode
        })
        .from(tournamentEntrants)
        .innerJoin(reservations, eq(reservations.id, tournamentEntrants.reservationId))
        .innerJoin(participants, eq(participants.id, reservations.participantId))
        .where(eq(tournamentEntrants.tournamentId, tournament.id))
        .orderBy(asc(tournamentEntrants.seed))
    : [];
  const matches = tournament
    ? await db.query.tournamentMatches.findMany({
        where: eq(tournamentMatches.tournamentId, tournament.id),
        orderBy: [asc(tournamentMatches.kind), asc(tournamentMatches.round), asc(tournamentMatches.matchIndex)]
      })
    : [];

  return {
    event,
    applicants: applicants.map((row) => ({
      ...row,
      maskedPhone: maskPhone(row.phoneNumber),
      phoneNumber: undefined,
      tournamentCheckedIn: Boolean(row.tournamentCheckinId && !row.tournamentCheckinCancelledAt)
    })),
    tournament,
    entrants,
    matches
  };
}

export async function checkInTournamentEntrant(db: SchedulerDb, input: { eventId: string; reservationId: string; adminUserId: string }) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const reservation = await db.query.reservations.findFirst({
    where: and(eq(reservations.id, input.reservationId), eq(reservations.eventId, input.eventId))
  });
  if (!reservation || !reservation.tournament) throw new DomainError("invalid_input", "대회 신청 예약이 아닙니다.");
  if (reservation.status === "CANCELLED" || reservation.status === "NO_SHOW") {
    throw new DomainError("invalid_state", "취소/노쇼 예약은 대회 체크인할 수 없습니다.");
  }
  const timestamp = nowIso();
  await db
    .insert(tournamentCheckins)
    .values({
      id: id("tournament_checkin"),
      eventId: input.eventId,
      reservationId: input.reservationId,
      checkedInAt: timestamp,
      checkedInBy: input.adminUserId,
      cancelledAt: null,
      cancelledBy: null,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    .onConflictDoUpdate({
      target: tournamentCheckins.reservationId,
      set: {
        checkedInAt: timestamp,
        checkedInBy: input.adminUserId,
        cancelledAt: null,
        cancelledBy: null,
        updatedAt: timestamp
      }
    });
  await logTournamentAction(db, { eventId: input.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_CHECK_IN", targetId: input.reservationId });
}

export async function cancelTournamentCheckIn(db: SchedulerDb, input: { eventId: string; reservationId: string; adminUserId: string }) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const checkin = await db.query.tournamentCheckins.findFirst({
    where: and(eq(tournamentCheckins.eventId, input.eventId), eq(tournamentCheckins.reservationId, input.reservationId))
  });
  if (!checkin || checkin.cancelledAt) return;
  const timestamp = nowIso();
  await db.transaction(async (tx) => {
    await tx
      .update(tournamentCheckins)
      .set({ cancelledAt: timestamp, cancelledBy: input.adminUserId, updatedAt: timestamp })
      .where(eq(tournamentCheckins.id, checkin.id));

    const tournament = await tx.query.tournaments.findFirst({ where: eq(tournaments.eventId, input.eventId) });
    if (tournament) {
      const entrantRows = await tx.query.tournamentEntrants.findMany({
        where: and(eq(tournamentEntrants.tournamentId, tournament.id), eq(tournamentEntrants.reservationId, input.reservationId))
      });
      for (const entrant of entrantRows) {
        const affectedMatches = await tx.query.tournamentMatches.findMany({
          where: and(
            eq(tournamentMatches.tournamentId, tournament.id),
            or(
              eq(tournamentMatches.entrantAId, entrant.id),
              eq(tournamentMatches.entrantBId, entrant.id),
              eq(tournamentMatches.winnerEntrantId, entrant.id)
            )
          )
        });
        await tx.delete(tournamentEntrants).where(eq(tournamentEntrants.id, entrant.id));
        for (const match of affectedMatches) {
          await updateMatchAndPropagate(tx, {
            tournamentId: tournament.id,
            kind: match.kind,
            round: match.round,
            matchIndex: match.matchIndex,
            entrantAId: match.entrantAId === entrant.id ? null : match.entrantAId,
            entrantBId: match.entrantBId === entrant.id ? null : match.entrantBId,
            winnerEntrantId: null
          });
        }
      }
    }
    await logTournamentAction(tx, { eventId: input.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_CHECK_IN_CANCEL", targetId: input.reservationId });
  });
}

export async function createTournamentDraft(
  db: SchedulerDb,
  input: { eventId: string; adminUserId: string; bracketSize: number; reservationIds: string[]; seedingMode: SeedingMode }
) {
  await assertEventAdmin(db, input.eventId, input.adminUserId);
  const event = await db.query.events.findFirst({ where: eq(events.id, input.eventId) });
  if (!event || !event.enableTournament) throw new DomainError("invalid_state", "대회 기능이 꺼져 있습니다.");
  const bracketSize = assertBracketSize(Number(input.bracketSize));
  const uniqueReservationIds = [...new Set(input.reservationIds.filter(Boolean))];
  if (uniqueReservationIds.length > bracketSize) throw new DomainError("invalid_input", "대진 규모보다 참가자가 많습니다.");

  const checkedInRows = await activeTournamentCheckinRows(db, input.eventId);
  const checkedInReservationIds = new Set(checkedInRows.map((row) => row.reservationId));
  for (const reservationId of uniqueReservationIds) {
    if (!checkedInReservationIds.has(reservationId)) throw new DomainError("invalid_input", "대회 체크인 완료자만 대진표에 넣을 수 있습니다.");
  }
  const orderedReservationIds =
    input.seedingMode === "RANDOM"
      ? shuffle(uniqueReservationIds)
      : uniqueReservationIds.length > 0
        ? uniqueReservationIds
        : checkedInRows.slice(0, bracketSize).map((row) => row.reservationId);

  return db.transaction(async (tx) => {
    await tx.delete(tournaments).where(eq(tournaments.eventId, input.eventId));
    const timestamp = nowIso();
    const tournamentId = id("tournament");
    await tx.insert(tournaments).values({
      id: tournamentId,
      eventId: input.eventId,
      status: "DRAFT",
      bracketSize,
      includeThirdPlace: true,
      seedingMode: input.seedingMode,
      createdAt: timestamp,
      updatedAt: timestamp,
      startedAt: null,
      completedAt: null
    });
    const entrantValues = orderedReservationIds.slice(0, bracketSize).map((reservationId, index) => ({
      id: id("entrant"),
      tournamentId,
      reservationId,
      seed: index + 1,
      createdAt: timestamp
    }));
    if (entrantValues.length > 0) await tx.insert(tournamentEntrants).values(entrantValues);

    const entrantBySeed = new Map(entrantValues.map((entrant) => [entrant.seed, entrant.id]));
    const matchValues = [];
    for (let round = 1; round <= finalRound(bracketSize); round += 1) {
      const matchCount = bracketSize / 2 ** round;
      for (let matchIndex = 1; matchIndex <= matchCount; matchIndex += 1) {
        const entrantAId = round === 1 ? entrantBySeed.get((matchIndex - 1) * 2 + 1) ?? null : null;
        const entrantBId = round === 1 ? entrantBySeed.get((matchIndex - 1) * 2 + 2) ?? null : null;
        const winnerEntrantId = round === 1 ? autoWinner(entrantAId, entrantBId) : null;
        matchValues.push({
          id: id("match"),
          tournamentId,
          kind: "MAIN" as const,
          round,
          matchIndex,
          entrantAId,
          entrantBId,
          winnerEntrantId,
          status: matchStatus({ entrantAId, entrantBId, winnerEntrantId }),
          createdAt: timestamp,
          updatedAt: timestamp
        });
      }
    }
    matchValues.push({
      id: id("match"),
      tournamentId,
      kind: "THIRD_PLACE" as const,
      round: 1,
      matchIndex: 1,
      entrantAId: null,
      entrantBId: null,
      winnerEntrantId: null,
      status: "PENDING" as const,
      createdAt: timestamp,
      updatedAt: timestamp
    });
    await tx.insert(tournamentMatches).values(matchValues);
    for (const match of matchValues.filter((match) => match.round === 1 && match.winnerEntrantId)) {
      await updateMatchAndPropagate(tx, match);
    }
    await logTournamentAction(tx, { eventId: input.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_CREATE", targetId: tournamentId });
    return { tournamentId };
  });
}

export async function updateTournamentSeed(
  db: SchedulerDb,
  input: { tournamentId: string; seed: number; reservationId?: string | null; adminUserId: string }
) {
  const tournament = await getTournamentOrThrow(db, input.tournamentId, input.adminUserId);
  if (input.seed < 1 || input.seed > tournament.bracketSize) throw new DomainError("invalid_input", "출전 자리 위치가 올바르지 않습니다.");
  if (input.reservationId) await assertTournamentReadyReservation(db, tournament.eventId, input.reservationId);
  await db.transaction(async (tx) => {
    const affectedSeeds = new Set<number>([input.seed]);
    const current = await tx.query.tournamentEntrants.findFirst({
      where: and(eq(tournamentEntrants.tournamentId, tournament.id), eq(tournamentEntrants.seed, input.seed))
    });
    if (!input.reservationId) {
      if (current) await tx.delete(tournamentEntrants).where(eq(tournamentEntrants.id, current.id));
    } else {
      const existingForReservation = await tx.query.tournamentEntrants.findFirst({
        where: and(eq(tournamentEntrants.tournamentId, tournament.id), eq(tournamentEntrants.reservationId, input.reservationId))
      });
      if (existingForReservation && existingForReservation.seed !== input.seed) {
        affectedSeeds.add(existingForReservation.seed);
      }
      if (current && existingForReservation && current.id !== existingForReservation.id) {
        await tx.delete(tournamentEntrants).where(eq(tournamentEntrants.id, current.id));
      }
      if (existingForReservation) {
        await tx.update(tournamentEntrants).set({ seed: input.seed }).where(eq(tournamentEntrants.id, existingForReservation.id));
      } else if (current) {
        await tx.update(tournamentEntrants).set({ reservationId: input.reservationId }).where(eq(tournamentEntrants.id, current.id));
      } else {
        await tx.insert(tournamentEntrants).values({
          id: id("entrant"),
          tournamentId: tournament.id,
          reservationId: input.reservationId,
          seed: input.seed,
          createdAt: nowIso()
        });
      }
    }
    for (const affectedSeed of affectedSeeds) {
      const entrant = await tx.query.tournamentEntrants.findFirst({
        where: and(eq(tournamentEntrants.tournamentId, tournament.id), eq(tournamentEntrants.seed, affectedSeed))
      });
      const matchIndex = Math.ceil(affectedSeed / 2);
      await updateMatchAndPropagate(tx, {
        tournamentId: tournament.id,
        kind: "MAIN",
        round: 1,
        matchIndex,
        entrantAId: affectedSeed % 2 === 1 ? entrant?.id ?? null : undefined,
        entrantBId: affectedSeed % 2 === 0 ? entrant?.id ?? null : undefined,
        winnerEntrantId: null
      });
    }
    await logTournamentAction(tx, { eventId: tournament.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_SEED_UPDATE", targetId: tournament.id });
  });
}

export async function startTournament(db: SchedulerDb, input: { tournamentId: string; adminUserId: string }) {
  const tournament = await getTournamentOrThrow(db, input.tournamentId, input.adminUserId);
  await db
    .update(tournaments)
    .set({ status: "STARTED", startedAt: tournament.startedAt ?? nowIso(), updatedAt: nowIso() })
    .where(eq(tournaments.id, tournament.id));
  await refreshTournamentCompletion(db, tournament.id);
  await logTournamentAction(db, { eventId: tournament.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_START", targetId: tournament.id });
}

export async function recordMatchWinner(
  db: SchedulerDb,
  input: { tournamentId: string; matchId: string; winnerEntrantId: string; adminUserId: string }
) {
  const tournament = await getTournamentOrThrow(db, input.tournamentId, input.adminUserId);
  const match = await db.query.tournamentMatches.findFirst({
    where: and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, tournament.id))
  });
  if (!match) throw new DomainError("not_found", "경기를 찾을 수 없습니다.");
  if (input.winnerEntrantId !== match.entrantAId && input.winnerEntrantId !== match.entrantBId) {
    throw new DomainError("invalid_input", "경기 참가자만 승자로 선택할 수 있습니다.");
  }
  await updateMatchAndPropagate(db, {
    tournamentId: tournament.id,
    kind: match.kind,
    round: match.round,
    matchIndex: match.matchIndex,
    winnerEntrantId: input.winnerEntrantId
  });
  await logTournamentAction(db, { eventId: tournament.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_WINNER_UPDATE", targetId: match.id });
}

export async function replaceMatchEntrant(
  db: SchedulerDb,
  input: { tournamentId: string; matchId: string; side: "A" | "B"; entrantId?: string | null; adminUserId: string }
) {
  const tournament = await getTournamentOrThrow(db, input.tournamentId, input.adminUserId);
  const match = await db.query.tournamentMatches.findFirst({
    where: and(eq(tournamentMatches.id, input.matchId), eq(tournamentMatches.tournamentId, tournament.id))
  });
  if (!match) throw new DomainError("not_found", "경기를 찾을 수 없습니다.");
  if (input.entrantId) {
    const entrant = await db.query.tournamentEntrants.findFirst({
      where: and(eq(tournamentEntrants.id, input.entrantId), eq(tournamentEntrants.tournamentId, tournament.id))
    });
    if (!entrant) throw new DomainError("invalid_input", "대진표 참가자를 찾을 수 없습니다.");
  }
  await updateMatchAndPropagate(db, {
    tournamentId: tournament.id,
    kind: match.kind,
    round: match.round,
    matchIndex: match.matchIndex,
    entrantAId: input.side === "A" ? input.entrantId ?? null : undefined,
    entrantBId: input.side === "B" ? input.entrantId ?? null : undefined,
    winnerEntrantId: null
  });
  await logTournamentAction(db, { eventId: tournament.eventId, adminUserId: input.adminUserId, action: "TOURNAMENT_MATCH_ENTRANT_UPDATE", targetId: match.id });
}
