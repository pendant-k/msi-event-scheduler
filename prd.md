# Event Reservation System PRD

## 0. Document Control

| Item | Value |
| --- | --- |
| Version | 1.3 |
| Last Updated | 2026-04-30 |
| Target Stack | Next.js App Router, Vercel, TailwindCSS, DaisyUI, Drizzle ORM, SQLite local prototype, Supabase Auth, Supabase Postgres, TanStack Table |
| Product Type | Event booth and program reservation system |
| Primary Goal | 행사 단위로 재사용 가능한 타임슬롯 기반 예약 운영 플랫폼 구축 |

## 1. Product Overview

### 1.1 Background

행사 현장에서는 특정 시간대에 참가자가 집중되거나, 정원 초과로 운영자가 수기 조정해야 하는 상황이 자주 발생한다. 이 시스템은 행사별 예약 페이지, 타임슬롯 정원 관리, 현장 체크인을 하나의 흐름으로 제공하여 현장 혼잡과 운영 리스크를 줄인다.

### 1.2 Product Objectives

- 행사별 설정만 변경하여 동일한 예약 시스템을 반복 사용할 수 있다.
- 참가자는 QR을 통해 모바일에서 빠르게 예약하고, 전화번호와 행사별 비밀번호로 해당 행사 예약 내역에 접근할 수 있다.
- 운영자는 TanStack Table 기반 대시보드에서 행사, 타임슬롯, 예약, 참가자, 체크인 상태를 검색/필터/정렬/export할 수 있다.
- 동시 예약 상황에서도 정원 초과가 발생하지 않도록 Supabase Postgres transaction 또는 RPC 기반으로 예약을 처리한다.
- v1에서는 결제, 외부 알림, 자동 브래킷 생성 없이 현장 운영에 필요한 핵심 예약 흐름을 완성한다.
- 로컬 프로토타입은 SQLite와 Drizzle ORM으로 빠르게 개발하고, 운영 환경은 Supabase Postgres로 전환한다.

### 1.3 Success Metrics

| Metric | Target |
| --- | --- |
| 예약 생성 성공률 | 99% 이상 |
| 예약 처리 응답 시간 | p95 2초 이내 |
| 정원 초과 예약 | 일반 예약 기준 0건 |
| 관리자 체크인 처리 시간 | 체크인 대시보드 검색 후 5초 이내 |
| 모바일 예약 완료율 | 예약 페이지 진입 대비 70% 이상 |
| CSV 다운로드 정확도 | 화면 예약 수와 다운로드 행 수 100% 일치 |

## 2. Users and Roles

### 2.1 Participant

행사에 참여하는 학생 또는 보호자. QR을 통해 예약 페이지에 진입하고, 전화번호와 행사별 비밀번호로 해당 행사 내 예약 정보에 접근한다. 전역 사용자 계정으로 관리하지 않는다.

### 2.2 Admin

행사 운영 담당자. Supabase Auth 기반 관리자 계정으로 로그인하고, 이벤트와 타임슬롯 설정, 예약 현황 확인, 체크인, 취소, 노쇼, CSV export를 수행한다.

### 2.3 Super Admin

여러 행사를 관리하는 내부 관리자. 초기 super admin은 seed로 생성하고, Supabase Auth 사용자와 `event_admins` 권한 테이블로 이벤트별 접근 권한을 관리한다.

## 3. Scope

### 3.1 In Scope

- 이벤트 생성 및 기본 설정 관리
- 이벤트 날짜 관리
- 타임슬롯 생성, 수정, 정원 설정
- 전체 행사 시간표 보기
- QR 기반 행사 예약 페이지 접근
- 참가자 예약 생성
- 참가자 예약 조회 및 취소
- 학년 기준 보호자 동행 정책 적용
- 부가 프로그램 신청 옵션 제공
- 대회 참가 신청 여부 집계
- 실시간 잔여 좌석 표시
- 관리자 예약 검색, 체크인, 취소, 노쇼 처리
- 예약 목록 CSV export
- Supabase Auth 기반 관리자 인증
- 행사별 참가자 접근 정보 관리
- Supabase Postgres transaction 또는 RPC 기반 정원 차감
- TanStack Table 기반 관리자 테이블
- Drizzle ORM 기반 SQLite 로컬 프로토타입

### 3.2 Out of Scope for v1

- SMS, 카카오톡, 이메일 알림
- 결제 기능
- 외부 캘린더 연동
- 자동 대회 브래킷 생성
- 예약자 셀프 수정
- 참가자 비밀번호 셀프 재설정
- 대기자 자동 승격
- 다국어 지원
- 고급 통계 대시보드

### 3.3 Application Structure

Use a monorepo. Turborepo is the default recommendation for this project unless Nx-specific generators become necessary.

Initial app/package structure:

```text
apps/web
packages/db
packages/domain
packages/ui
packages/config
```

MVP should use one Next.js app with route groups:

```text
apps/web/app/(public)/event/[eventId]
apps/web/app/(public)/event/[eventId]/schedule
apps/web/app/(public)/privacy
apps/web/app/(participant)/event/[eventId]/reservations
apps/web/app/(admin)/admin
apps/web/app/(admin)/admin/events/[eventId]
apps/web/app/(admin)/admin/events/[eventId]/check-in
```

Admin and participant experiences should be separated by routes, layouts, permissions, and navigation, not by separate deployed apps in v1.

## 4. Product Assumptions

- 한 이벤트는 하나 이상의 행사 날짜와 타임슬롯을 가진다.
- v1의 기본 운영 단위는 단일 이벤트이지만 데이터 모델은 멀티 이벤트를 지원한다.
- 행사는 보통 하루 단위로 운영되며 예약도 당일 현장 예약을 기본으로 한다.
- 데이터 모델은 `event_days`를 사용해 멀티데이 행사를 확장 가능하게 유지한다.
- 참가자는 전역 사용자로 만들지 않고, 행사별 `participant_accesses` 레코드로 접근을 관리한다.
- 참가자 접근은 전화번호와 최초 설정한 행사별 비밀번호를 사용한다.
- 참가자 접근 성공 후에는 단순 httpOnly cookie session을 사용한다.
- 참가자 비밀번호는 본인 인증 수단이 아니라 해당 행사 예약 내역에 접근하기 위한 예약 접근 수단이다.
- 참가자 비밀번호 분실은 v1에서 현장 관리자 문의로만 처리하며, 비밀번호 설정/입력 화면에 해당 안내를 명확히 표시한다.
- 중복 예약 방지는 이벤트, 전화번호, 이름, 학교, 학년 기준으로 1차 검증한다.
- 현장 운영자는 관리자 계정으로 로그인한다.
- 관리자는 Supabase Auth email/password로 로그인하며, 소셜 로그인, magic link, OTP는 v1 범위에서 제외한다.
- QR은 행사 페이지 URL을 포함하며, 별도 동적 QR 생성 기능은 v1에서 관리자 편의 기능으로만 제공한다.
- 예약 완료 화면은 현장 확인에 사용할 수 있는 예약 ID를 표시한다. 체크인 QR은 v1에서 필수 수단이 아니라 보조 수단으로 둔다.
- 개인정보는 국룰 수준의 최소 수집, 목적 고지, 행사 종료 후 보관 기간, 삭제/익명화 정책을 제공한다.

## 5. Functional Requirements

### 5.1 Event Management

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| EVT-001 | 관리자는 이벤트명, 설명, 행사 날짜, 운영 상태를 설정할 수 있다. | Must | 이벤트 생성 후 공개 URL이 발급된다. |
| EVT-002 | 관리자는 예약 마감 정책을 이벤트 단위로 설정할 수 있다. | Must | `reservationCloseAfterMinutes` 값에 따라 예약 가능 여부가 결정된다. |
| EVT-003 | 관리자는 중복 예약 허용 여부를 설정할 수 있다. | Must | `allowMultipleBooking=false`인 경우 동일 참가자 정보로 같은 이벤트에 추가 예약할 수 없다. |
| EVT-004 | 관리자는 부가 프로그램 옵션을 설정할 수 있다. | Should | 예약 폼에 옵션명이 노출되고 예약 문서에 선택 값이 저장된다. |
| EVT-005 | 관리자는 이벤트를 공개, 비공개, 종료 상태로 변경할 수 있다. | Should | 비공개 또는 종료 이벤트는 참가자 예약 접근이 차단된다. |
| EVT-006 | 관리자는 이벤트 날짜를 `event_days` 단위로 설정할 수 있다. | Should | 기본은 하루 행사로 생성되며, 필요 시 여러 event day를 추가할 수 있다. |
| EVT-007 | 관리자는 참가자 취소 정책을 설정할 수 있다. | Should | 기본값은 타임슬롯 시작 전까지 참가자 취소 허용이다. |

Recommended event settings:

```json
{
  "reservationCloseAfterMinutes": 20,
  "allowLateReservation": true,
  "allowMultipleBooking": false,
  "allowParticipantCancellation": true,
  "participantCancelUntilMinutesBeforeStart": 0,
  "enableTournament": true,
  "minGuardianRequiredGrade": 1,
  "maxGuardianRequiredGrade": 4
}
```

### 5.2 Timeslot Management

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| TMS-001 | 관리자는 시작 시간, 종료 시간, 정원을 가진 타임슬롯을 생성할 수 있다. | Must | 생성된 타임슬롯이 예약 페이지와 관리자 화면에 표시된다. |
| TMS-002 | 타임슬롯은 `reserved_count < capacity`일 때만 일반 예약 가능 상태가 된다. | Must | 정원이 찬 타임슬롯은 선택할 수 없고 예약 불가 사유가 표시된다. |
| TMS-003 | 타임슬롯 시작 후 예약은 정책에 따라 허용하거나 차단한다. | Must | 허용 시 상태가 `LATE_RESERVED`로 저장되고, 차단 시 예약 버튼이 비활성화된다. |
| TMS-004 | 운영 중 타임슬롯 정원 변경 시 기존 예약 수보다 낮게 설정할 수 없다. | Should | 기존 예약 수보다 작은 값 입력 시 validation error가 표시된다. |
| TMS-005 | 잔여 좌석은 참가자 화면과 관리자 화면에서 실시간에 가깝게 갱신된다. | Should | 동일 슬롯 예약 완료 후 다른 클라이언트의 잔여 좌석이 갱신된다. |
| TMS-006 | 참가자와 관리자는 전체 행사 시간표를 볼 수 있다. | Must | 같은 시간표 컴포넌트를 기반으로 참가자용 CTA와 관리자용 운영 지표가 다르게 표시된다. |

Timeslot fields:

```json
{
  "id": "timeslotId",
  "eventId": "eventId",
  "startTime": "2026-05-01T10:00:00+09:00",
  "endTime": "2026-05-01T10:30:00+09:00",
  "capacity": 20,
  "reserved_count": 12,
  "status": "OPEN"
}
```

### 5.3 Reservation Flow

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| RSV-001 | 참가자는 QR 또는 URL로 이벤트 예약 페이지에 진입할 수 있다. | Must | 유효한 이벤트 URL에서 타임슬롯 목록이 표시된다. |
| RSV-002 | 참가자는 전화번호와 행사별 비밀번호로 예약 접근 정보를 생성하거나 기존 접근 정보로 진입할 수 있다. | Must | 최초 접근 시 비밀번호 설정, 기존 접근 시 비밀번호 입력 화면이 표시된다. |
| RSV-003 | 초등학교 1~4학년은 보호자 동행 확인이 필수다. | Must | 해당 학년 선택 시 보호자 동행 확인을 체크하지 않으면 제출할 수 없다. |
| RSV-004 | 동일 이벤트에서 1인 1예약 정책을 적용한다. | Must | 중복 예약 시 기존 예약 안내 또는 예약 불가 메시지가 표시된다. |
| RSV-005 | 예약 완료 시 고유 예약 ID가 발급된다. | Must | 완료 화면에서 예약 ID, 타임, 참가자명이 표시된다. |
| RSV-006 | 다자녀 또는 복수 참가자는 개별 예약을 원칙으로 한다. | Must | 완료 화면에서 추가 예약 CTA를 제공하되 같은 예약 문서에 여러 참가자를 저장하지 않는다. |
| RSV-007 | 예약 실패 시 실패 원인을 사용자가 이해할 수 있게 안내한다. | Must | 정원 마감, 시간 마감, 네트워크 오류, 중복 예약이 구분되어 표시된다. |
| RSV-008 | 참가자는 전화번호와 비밀번호로 해당 행사 예약 목록을 확인할 수 있다. | Should | 접근 성공 시 해당 `participant_accesses` row에 연결된 예약만 표시된다. |
| RSV-009 | 참가자 접근 성공 후 httpOnly cookie session을 발급한다. | Must | 같은 브라우저에서는 세션 만료 전 전화번호/비밀번호 재입력 없이 내 예약을 볼 수 있다. |
| RSV-010 | 참가자는 예약을 취소할 수 있다. | Should | 취소 가능 시간 내 예약 상세에서 취소 처리되며 `reserved_count`가 복구된다. |
| RSV-011 | 참가자는 예약 전 개인정보 수집 및 이용 안내에 동의해야 한다. | Must | 동의하지 않으면 예약 제출 버튼이 활성화되지 않는다. |

Reservation input fields:

- Phone number
- Event-scoped password
- Participant name
- School
- Grade
- Guardian attendance confirmation
- Additional program option, for example tournament participation

Participant access policy:

- 전화번호는 행사별 접근 ID로 사용하되 전역 사용자 계정으로 취급하지 않는다.
- 동일 행사에서 같은 전화번호는 하나의 `participant_accesses` row를 가진다.
- 동일 전화번호에 여러 participant와 reservation을 연결할 수 있어 다자녀 예약을 허용한다.
- 비밀번호는 `password_hash`만 저장하며 평문 비밀번호는 저장하지 않는다.
- 전화번호 소유 확인을 하지 않으므로 "본인 인증"이라고 표현하지 않는다.
- 비밀번호 분실은 v1에서 현장 관리자 문의로만 처리한다.
- 비밀번호 설정/입력 화면에는 "비밀번호를 잊은 경우 현장 운영자에게 문의해 주세요." 안내를 표시한다.
- 참가자 접근 session은 httpOnly cookie로 유지하며, 민감한 참가자 데이터는 클라이언트 storage에 저장하지 않는다.

Reservation statuses:

| Status | Meaning |
| --- | --- |
| `RESERVED` | 정상 예약 |
| `LATE_RESERVED` | 타임 시작 후 정책상 허용된 예약 |
| `CHECKED_IN` | 현장 체크인 완료 |
| `CANCELLED` | 관리자 또는 운영 정책에 따른 취소 |
| `NO_SHOW` | 운영자가 노쇼로 처리 |

### 5.4 Tournament Option

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| TRN-001 | 예약 폼에서 대회 참가 여부를 선택할 수 있다. | Must | 선택 값이 예약 문서에 boolean으로 저장된다. |
| TRN-002 | 대회 신청은 해당 타임슬롯 예약 완료를 전제로 한다. | Must | 예약 없이 대회만 신청할 수 없다. |
| TRN-003 | 관리자 화면에서 대회 신청자 수와 목록을 확인할 수 있다. | Must | 전체 신청자 수와 타임슬롯별 신청자 수가 표시된다. |
| TRN-004 | v1에서는 브래킷을 자동 생성하지 않는다. | Must | 관리자 화면의 브래킷 생성은 disabled 또는 v2 안내로 처리한다. |

Tournament policy:

- 기본 최대 인원은 32명으로 설정한다.
- 32명 미만인 경우 운영자가 16강 등으로 수동 운영한다.
- 자동 브래킷 생성, 시드 배정, 경기 결과 입력은 v2 범위로 분리한다.

### 5.5 QR and URL

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| QR-001 | 이벤트별 예약 URL을 제공한다. | Must | `/event/{eventId}` 경로로 이벤트 예약 페이지에 접근할 수 있다. |
| QR-002 | 특정 타임슬롯으로 바로 진입하는 URL을 지원할 수 있다. | Could | `/r/{eventId}/{timeslotId}` 접근 시 해당 슬롯이 선택된 상태로 표시된다. |
| QR-003 | 예약 완료 후 체크인 보조용 예약 식별자를 제공할 수 있다. | Could | 관리자 체크인 화면에서 예약 ID 또는 QR 스캔으로 예약을 조회할 수 있다. |

URL examples:

```text
https://domain.com/event/{eventId}
https://domain.com/r/{eventId}/{timeslotId}
https://domain.com/checkin/{reservationId}
```

### 5.6 Admin Operations

| ID | Requirement | Priority | Acceptance Criteria |
| --- | --- | --- | --- |
| ADM-001 | 관리자는 로그인 후 이벤트 대시보드를 볼 수 있다. | Must | 전체 예약 수, 타임별 잔여 좌석, 대회 신청자 수가 표시된다. |
| ADM-002 | 관리자는 예약자 이름, 학교, 예약 ID로 예약을 검색할 수 있다. | Must | 검색 결과에서 예약 상태와 타임슬롯을 확인할 수 있다. |
| ADM-003 | 관리자는 예약을 체크인 처리할 수 있다. | Must | 체크인 후 상태가 `CHECKED_IN`으로 변경되고 중복 체크인을 방지한다. |
| ADM-004 | 관리자는 예약을 취소 또는 노쇼 처리할 수 있다. | Must | 취소 시 `reserved_count` 처리 정책이 일관되게 적용된다. |
| ADM-005 | 관리자는 정원 초과 수동 추가를 할 수 있다. | Should | 수동 추가는 admin action log에 사유와 담당자를 기록한다. |
| ADM-006 | 관리자는 예약 목록을 CSV로 다운로드할 수 있다. | Must | CSV에는 예약 ID, 참가자 정보, 타임, 상태, 대회 신청 여부가 포함된다. |
| ADM-007 | 관리자 예약/참가자/타임슬롯 목록은 TanStack Table로 관리한다. | Must | 서버 사이드 pagination, sorting, filtering, column visibility를 지원한다. |
| ADM-008 | 관리자는 이벤트별 운영자를 지정할 수 있다. | Should | `event_admins` 권한이 있는 관리자만 해당 이벤트 데이터에 접근한다. |
| ADM-009 | 관리자는 체크인 전용 대시보드에서 참가자를 빠르게 검색할 수 있다. | Must | 전화번호 뒷자리, 이름 일부, 학교명 일부, 예약번호, 타임슬롯으로 검색된다. |
| ADM-010 | 체크인 검색 결과에서 row 단위로 즉시 체크인 처리할 수 있다. | Must | 검색 결과 row의 체크인 버튼으로 상태가 `CHECKED_IN`으로 변경된다. |
| ADM-011 | 관리자는 Supabase Auth email/password로 로그인한다. | Must | 소셜 로그인, magic link, OTP 없이 email/password와 reset password flow만 사용한다. |
| ADM-012 | 모든 관리자는 수동 정원 초과 예약을 생성할 수 있다. | Should | 수동 예약은 `reserved_count`에 포함되고 `is_overbooked=true` 및 admin log가 기록된다. |

Admin dashboard fields:

- Total reservations
- Reservations by timeslot
- Remaining seats by timeslot
- Tournament participants
- Current active timeslot
- Check-in count
- Cancellation and no-show count

Admin table requirements:

- Reservation table: participant name, phone last 4 digits, school, grade, timeslot, status, tournament, createdAt, checkedInAt
- Participant table: phone last 4 digits, participant count, reservation count, last access time
- Timeslot table: start time, end time, capacity, reserved count, checked-in count, status
- Event table: status, date, total reservations, admin count
- CSV export must respect current filters unless the admin chooses full export.

Schedule component requirements:

- Use one shared schedule component for participant and admin contexts.
- Participant schedule shows time, availability, remaining seats, and reservation CTA.
- Admin schedule shows time, capacity, reserved count, checked-in count, tournament count, status, and management actions.
- If an event has multiple event days, the schedule supports switching between days.

Check-in dashboard requirements:

- Check-in dashboard is the primary on-site check-in tool.
- Check-in QR is optional and secondary.
- A single search input should support phone last 4 digits, participant name substring, school substring, reservation code, and timeslot filtering.
- Search results must show timeslot, participant name, school, grade, masked phone number, reservation status, tournament option, and check-in action.
- Full phone number must not be shown by default. Use masked display such as `****1234`.
- If multiple rows match the same phone last 4 digits, show all matches clearly so staff can confirm by name, school, grade, and timeslot.

## 6. User Flows

### 6.1 Participant Reservation

1. 참가자가 행사 QR을 스캔한다.
2. 이벤트 예약 페이지에 진입한다.
3. 예약 가능한 타임슬롯과 잔여 좌석을 확인한다.
4. 전화번호를 입력한다.
5. 해당 행사에서 처음 사용하는 전화번호이면 비밀번호를 설정한다.
6. 이미 등록된 전화번호이면 비밀번호를 입력해 접근한다.
7. 타임슬롯을 선택한다.
8. 참가자 정보를 입력한다.
9. 보호자 동행 또는 대회 참가 옵션을 선택한다.
10. 예약하기 버튼을 누른다.
11. 시스템이 transaction으로 정원과 중복 예약을 검증한다.
12. 예약 완료 화면에서 예약 ID를 확인한다.

### 6.2 Participant Reservation Lookup

1. 참가자가 행사 페이지에서 내 예약 확인을 선택한다.
2. 전화번호와 행사별 비밀번호를 입력한다.
3. 시스템이 해당 이벤트의 `participant_accesses` row를 검증한다.
4. 연결된 participant와 reservation 목록을 표시한다.
5. 참가자는 예약 상세와 예약 ID를 확인한다.
6. 취소 가능 시간 내 예약이면 취소 버튼을 눌러 예약을 취소할 수 있다.

### 6.3 Admin Check-in

1. 관리자가 로그인한다.
2. 체크인 화면으로 이동한다.
3. 전화번호 뒷자리, 이름 일부, 학교명 일부, 예약번호, 타임슬롯 중 하나로 검색한다.
4. 검색 결과에서 참가자 이름, 학교, 학년, 마스킹된 전화번호, 예약 시간을 확인한다.
5. 해당 row의 체크인 버튼을 누른다.
6. 시스템이 예약 상태를 `CHECKED_IN`으로 변경한다.
7. 대시보드 체크인 수가 갱신된다.

### 6.4 Admin Cancellation

1. 관리자가 예약 상세를 연다.
2. 취소 사유를 선택하거나 입력한다.
3. 취소 버튼을 누른다.
4. 시스템이 예약 상태를 `CANCELLED`로 변경한다.
5. 운영 정책에 따라 잔여 좌석을 복구한다.

### 6.5 Event Schedule

1. 참가자 또는 관리자가 전체 행사 시간표 페이지에 진입한다.
2. 시스템은 선택된 event day의 전체 타임슬롯을 시간순으로 표시한다.
3. 참가자 화면에서는 예약 가능 여부와 예약 CTA를 표시한다.
4. 관리자 화면에서는 정원, 예약 수, 체크인 수, 대회 신청 수, 상태, 관리 액션을 표시한다.
5. 멀티데이 이벤트인 경우 날짜 전환 컨트롤로 다른 event day 시간표를 확인한다.

## 7. Business Rules

| ID | Rule |
| --- | --- |
| BR-001 | 예약 가능 여부는 이벤트 공개 상태, 타임슬롯 상태, 시간 마감 정책, 잔여 정원, 중복 예약 정책을 모두 통과해야 한다. |
| BR-002 | 참가자는 전화번호와 행사별 비밀번호로 해당 행사 예약 목록에만 접근할 수 있다. |
| BR-003 | `CHECKED_IN`, `NO_SHOW`, `CANCELLED` 상태 예약은 참가자가 변경할 수 없다. |
| BR-004 | 취소된 예약은 CSV에 포함하되 상태로 구분한다. |
| BR-005 | 관리자의 정원 초과 수동 추가는 `is_overbooked` flag와 `admin_logs`로 추적한다. |
| BR-006 | `reserved_count`는 클라이언트에서 직접 수정할 수 없고 server action, route handler, RPC transaction에서만 변경한다. |
| BR-007 | 이벤트 종료 후 참가자의 신규 예약은 차단한다. |
| BR-008 | 동일 행사 내 같은 전화번호는 하나의 `participant_accesses` row를 가진다. |
| BR-009 | 동일 전화번호라도 참가자 정보가 다르면 별도 `participants` row로 저장해 다자녀 예약을 허용한다. |
| BR-010 | 참가자 비밀번호는 행사별로만 유효하며 다른 행사와 공유하지 않는다. |

## 8. Data Model

### 8.1 Database

Use Supabase Postgres as the primary database. The service should be modeled as a reusable multi-event system, not a single-event reservation form.

Core tables:

```text
events
event_days
event_admins
participant_accesses
participants
timeslots
reservations
admin_logs
participant_sessions
```

### 8.2 events

```sql
create table events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  timezone text not null default 'Asia/Seoul',
  status text not null check (status in ('DRAFT', 'PUBLISHED', 'CLOSED', 'ARCHIVED')),
  reservation_close_after_minutes integer not null default 20,
  allow_late_reservation boolean not null default true,
  allow_multiple_booking boolean not null default false,
  allow_participant_cancellation boolean not null default true,
  participant_cancel_until_minutes_before_start integer not null default 0,
  enable_tournament boolean not null default true,
  min_guardian_required_grade integer not null default 1,
  max_guardian_required_grade integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 8.3 event_days

```sql
create table event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  event_date date not null,
  label text,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, event_date)
);
```

Most events are expected to run for one day, but `event_days` keeps the model ready for multi-day events.

### 8.4 event_admins

```sql
create table event_admins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  admin_user_id uuid not null,
  role text not null check (role in ('OWNER', 'MANAGER', 'STAFF')),
  created_at timestamptz not null default now(),
  unique (event_id, admin_user_id)
);
```

`admin_user_id` maps to the Supabase Auth user ID. Initial super admin is created through a seed script. Super admin 권한은 별도 `is_super_admin` profile flag 또는 service-role 기반 운영 도구로 관리한다.

### 8.5 participant_accesses

```sql
create table participant_accesses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  phone_number text not null,
  phone_last4 text not null,
  password_hash text not null,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, phone_number)
);
```

`participant_accesses` is not a global users table. It is an event-scoped reservation access record.

### 8.6 participant_sessions

```sql
create table participant_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  access_id uuid not null references participant_accesses(id) on delete cascade,
  session_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  unique (session_token_hash)
);
```

Participant sessions are issued as httpOnly cookies. Store only a hashed session token in the database.

### 8.7 participants

```sql
create table participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  access_id uuid not null references participant_accesses(id) on delete cascade,
  name text not null,
  school text not null,
  grade integer not null,
  guardian_required boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, access_id, name, school, grade)
);
```

### 8.8 timeslots

```sql
create table timeslots (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  event_day_id uuid not null references event_days(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null check (capacity >= 0),
  reserved_count integer not null default 0 check (reserved_count >= 0),
  status text not null check (status in ('OPEN', 'CLOSED', 'HIDDEN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
```

### 8.9 reservations

```sql
create table reservations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  timeslot_id uuid not null references timeslots(id),
  access_id uuid not null references participant_accesses(id),
  participant_id uuid not null references participants(id),
  status text not null check (status in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN', 'CANCELLED', 'NO_SHOW')),
  tournament boolean not null default false,
  duplicate_key text,
  reservation_code text not null,
  check_in_code text not null,
  is_overbooked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checked_in_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text check (cancelled_by in ('PARTICIPANT', 'ADMIN')),
  cancellation_reason text,
  unique (event_id, reservation_code),
  unique (event_id, check_in_code)
);
```

### 8.10 admin_logs

```sql
create table admin_logs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  admin_user_id uuid not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
```

### 8.11 Recommended Indexes

```sql
create index idx_event_days_event_date
on event_days (event_id, event_date);

create index idx_timeslots_event_day_starts
on timeslots (event_id, event_day_id, starts_at);

create index idx_participant_accesses_event_phone_last4
on participant_accesses (event_id, phone_last4);

create index idx_participant_sessions_access_expires
on participant_sessions (access_id, expires_at);

create index idx_participants_event_name
on participants (event_id, name);

create index idx_participants_event_school
on participants (event_id, school);

create index idx_reservations_event_timeslot_status
on reservations (event_id, timeslot_id, status);

create index idx_reservations_event_reservation_code
on reservations (event_id, reservation_code);

create unique index idx_reservations_active_duplicate_key_unique
on reservations (event_id, duplicate_key)
where duplicate_key is not null
  and status in ('RESERVED', 'LATE_RESERVED', 'CHECKED_IN');
```

For production Postgres substring search, consider trigram indexes on participant name and school if simple `like` queries are not fast enough.
SQLite local prototype should enforce the same active duplicate rule in the reservation service transaction even if the exact partial index differs by migration target.

### 8.12 Local Prototype Database

- Use Drizzle ORM as the database access layer.
- Use SQLite for local prototype and fast iteration.
- Use Supabase Postgres for production.
- All data access must go through server-side domain services so the database can be replaced without rewriting UI flows.
- SQLite is allowed to differ in low-level locking and timestamp types, but schema names and domain behavior should stay aligned with the Postgres target.

## 9. Transaction and Consistency Design

### 9.1 Reservation Creation Transaction

Reservation creation must run in a single Postgres transaction, preferably through a Supabase RPC function called from a Next.js server action or route handler.

1. Read and lock the target `timeslots` row with `for update`.
2. Read `events` and validate event status and settings.
3. Read `event_days` and validate the selected day belongs to the event.
4. Validate time window and timeslot status.
5. Validate `reserved_count < capacity`.
6. Create or reuse `participant_accesses` after verifying the event-scoped password.
7. Create or reuse `participants`.
8. Validate duplicate reservation when `allow_multiple_booking=false`.
9. Create a normalized `duplicate_key` when `allow_multiple_booking=false`; otherwise store `null`.
10. Create `reservations`.
11. Increment `timeslots.reserved_count`.
12. Commit transaction.

### 9.2 Cancellation Policy

- `RESERVED` 또는 `LATE_RESERVED` 예약 취소 시 `reserved_count`를 1 감소한다.
- 참가자는 예약 상세에서 본인 예약을 취소할 수 있다.
- 참가자 취소 가능 시간은 이벤트 설정으로 관리하며, 기본값은 타임슬롯 시작 전까지 허용한다.
- `CHECKED_IN` 이후 취소는 기본적으로 허용하지 않는다. 필요 시 관리자 전용 예외 처리로 별도 action log를 남긴다.
- `NO_SHOW`는 예약 정원 집계에서는 유지하고, 출석 통계에서만 제외한다.

### 9.3 Manual Overbooking Policy

- All admins assigned to an event can create manual overbook reservations.
- Manual overbook reservations are included in `timeslots.reserved_count`.
- If `reserved_count >= capacity`, manual overbook is allowed only through an explicit admin action.
- Manual overbook reservations must set `is_overbooked=true`.
- The action must be recorded in `admin_logs` with admin user ID and reason.

### 9.4 Duplicate Reservation Policy

v1에서는 전역 사용자 계정이 없으므로 다음 값을 정규화하여 중복을 판단한다.

- event_id
- normalized phone_number
- participant name
- school
- grade

동일 전화번호라도 참가자 정보가 다르면 다른 participant로 보고 다자녀 예약을 허용한다. 전화번호를 저장하므로 개인정보 수집 안내와 보관 기간 정책이 필요하다.
When `allow_multiple_booking=false`, the reservation service stores a normalized `duplicate_key` so the database can reject duplicate active reservations under concurrency.

### 9.5 Participant Access Consistency

- `participant_accesses.password_hash`는 bcrypt 또는 argon2로 생성한다.
- 비밀번호 검증은 server action, route handler, 또는 RPC 경유 서버 코드에서만 수행한다.
- 로그인 실패 시 `failed_login_count`를 증가시키고 일정 횟수 초과 시 `locked_until`을 설정한다.
- 에러 메시지는 계정 존재 여부를 노출하지 않도록 "전화번호 또는 비밀번호가 올바르지 않습니다"로 통일한다.
- 접근 성공 시 random session token을 발급하고 httpOnly, secure, sameSite cookie로 저장한다.
- DB에는 session token 원문이 아니라 hash만 저장한다.
- 세션 만료 기본값은 24시간으로 한다.

## 10. Security and Permissions

### 10.1 Authentication

- 관리자는 Supabase Auth email/password로 로그인한다.
- 관리자 소셜 로그인, magic link, OTP는 v1에서 사용하지 않는다.
- 관리자 비밀번호 재설정은 Supabase Auth reset password flow를 사용한다.
- 초기 super admin은 seed script로 생성한다.
- 관리자 권한은 `event_admins` 테이블과 Supabase Auth user ID로 관리한다.
- 참가자는 Supabase Auth user로 만들지 않는다.
- 참가자는 행사별 `participant_accesses`에 저장된 전화번호와 비밀번호로 해당 행사 예약에 접근한다.
- 참가자 접근은 본인 인증이 아니라 예약 접근 제어로 정의한다.

### 10.2 Authorization

| Actor | Permission |
| --- | --- |
| Public visitor | Published event read, visible timeslot read |
| Participant access | Own event reservations read, reservation create |
| Admin | Assigned event read/write, timeslot read/write, reservation read/update, CSV export |
| Super Admin | All admin permissions across events |

### 10.3 Supabase RLS and Server-side Access Principles

- Public client reads are limited to published events and visible/open timeslots.
- Reservation creation must go through server-side code or RPC, not direct unrestricted table insert from the browser.
- `password_hash`, full `phone_number`, admin-only fields, and logs are never exposed to public clients.
- Admin table queries require Supabase Auth and `event_admins` membership.
- RLS policies should restrict event-scoped data to assigned admins.
- CSV export is performed by authenticated server-side code and logged in `admin_logs`.

### 10.4 Privacy Policy Defaults

- Collect only phone number, participant name, school, grade, guardian confirmation, reservation details, and admin operation logs required for event operation.
- Show consent notice before reservation submission.
- Use full phone number for participant access and admin operations, but participant-facing UI and check-in tables show masked phone by default.
- Admins can view full phone number when needed for on-site support.
- Keep personal data for 90 days after event end by default, then delete or anonymize participant/access/reservation personal fields.
- Keep aggregate statistics and admin logs without unnecessary personal data for operational audit.
- CSV export is admin-only and should include a privacy warning.
- Provide a public privacy policy page and link it from reservation forms.

## 11. UX and UI Requirements

### 11.1 Participant UI

- 모바일 우선 레이아웃을 기본으로 한다.
- 첫 화면은 "예약하기"와 "내 예약 확인" 중심으로 구성하고, 회원가입/로그인 용어는 최소화한다.
- 전화번호 입력 후 신규 접근이면 비밀번호 설정, 기존 접근이면 비밀번호 입력으로 자연스럽게 분기한다.
- 비밀번호 오류는 전화번호 존재 여부를 노출하지 않는 단일 메시지로 표시한다.
- 타임슬롯 카드는 시간, 잔여 좌석, 예약 가능 상태를 즉시 인지할 수 있어야 한다.
- 예약 불가 사유를 버튼 비활성화만으로 처리하지 말고 문구로 함께 제공한다.
- 보호자 동행 필수 조건은 학년 선택 직후 명확히 노출한다.
- 예약 완료 화면은 스크린샷 저장이 가능하도록 핵심 정보를 한 화면에 배치한다.

### 11.2 Admin UI

- 현장 운영 중 빠른 조작을 위해 검색, 체크인, 현재 타임 현황을 상단에 둔다.
- 체크인 대시보드는 QR 스캔보다 검색을 기본 체크인 방식으로 설계한다.
- 체크인 검색창은 전화번호 뒷자리, 이름 일부, 학교명 일부, 예약번호를 하나의 입력으로 처리한다.
- 검색 결과는 한 화면에서 확인과 체크인이 끝나도록 row action을 제공한다.
- 예약, 참가자, 타임슬롯, 이벤트 목록은 TanStack Table을 사용한다.
- 테이블은 서버 사이드 pagination, sorting, filtering, column visibility를 지원한다.
- 체크인 완료, 이미 체크인, 취소, 노쇼 상태를 색상과 텍스트로 구분한다.
- 정원 초과 수동 추가, 취소, 노쇼는 확인 modal을 거친다.
- CSV export는 현재 이벤트 기준으로 제공하며 필터 적용 여부를 명확히 표시한다.

### 11.3 Accessibility

- 모든 form input은 label과 validation message를 가진다.
- 색상만으로 상태를 전달하지 않는다.
- QR 보조 체크인을 제공하는 경우, QR 스캔 실패 시 예약 ID 직접 입력을 제공한다.
- QR이 없어도 전화번호 뒷자리 또는 이름으로 체크인할 수 있어야 한다.
- 터치 타겟은 모바일 기준 최소 44px 이상으로 설계한다.

## 12. Non-functional Requirements

| Category | Requirement |
| --- | --- |
| Performance | 예약 생성 p95 2초 이내 |
| Concurrency | 동시 100~300명 접속, 동일 타임슬롯 집중 예약 대응 |
| Availability | Vercel + Supabase managed service 기준 운영 |
| Compatibility | iOS Safari, Android Chrome 최신 2개 major version 지원 |
| Observability | 예약 생성 실패, transaction conflict, admin action log를 추적 |
| Error Handling | 네트워크 오류, 정원 마감, 시간 마감, 중복 예약 오류를 구분 |
| Data Export | CSV는 UTF-8 BOM 포함 옵션을 제공하여 Excel 한글 깨짐을 방지 |
| Privacy | 개인정보 최소 수집, 행사 종료 후 보관 기간 정책 적용 |
| Dashboard Data | TanStack Table 서버 사이드 pagination, sorting, filtering 기준으로 API 설계 |
| Local Development | Drizzle ORM + SQLite로 로컬 프로토타입을 지원 |

## 13. Analytics and Logging

Recommended events:

- `event_page_viewed`
- `timeslot_selected`
- `reservation_submitted`
- `reservation_succeeded`
- `reservation_failed`
- `participant_cancelled_reservation`
- `admin_checkin_searched`
- `admin_checked_in`
- `admin_cancelled_reservation`
- `csv_exported`

Failure logs should include:

- eventId
- timeslotId
- errorCode
- timestamp
- client user agent, when available

## 14. Risks and Mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| 동시 예약 race condition | 정원 초과 예약 발생 | Postgres transaction, row lock, RPC 기반 `reserved_count` update |
| 현장 네트워크 불안정 | 예약 실패 또는 체크인 지연 | 명확한 retry UX, 예약 ID 수동 검색, 관리자 화면 경량화 |
| 관리자 실수 | 잘못된 취소, 초과 예약 | 확인 modal, admin action log, 취소 사유 기록 |
| 개인정보 관리 미흡 | 운영 및 법적 리스크 | 최소 수집, 보관 기간 명시, CSV 접근 제한 |
| 참가자 비밀번호 분실 | 예약 조회 불가 및 현장 문의 증가 | 비밀번호 설정/입력 화면에 현장 관리자 문의 안내를 명확히 표시 |
| 브래킷 요구사항 확장 | v1 일정 지연 | v1은 신청 집계까지만 구현하고 자동 브래킷은 v2로 분리 |
| QR 공유로 인한 예기치 않은 접근 | 비공개 행사 노출 | 이벤트 status, 공개 URL 정책, 필요 시 access code 적용 |
| 전화번호 뒷자리 검색 중복 | 현장 체크인 오인 처리 | 이름, 학교, 학년, 타임슬롯을 함께 표시하고 체크인 전 row 확인을 요구 |

## 15. MVP Definition

MVP is complete when the following are available in production:

- 이벤트 생성 및 공개 URL 발급
- 이벤트 날짜 및 전체 시간표
- 타임슬롯 생성 및 정원 설정
- 참가자 예약 생성
- 참가자 예약 조회 및 취소
- 학년 기반 보호자 동행 validation
- 대회 참가 체크 옵션
- 예약 완료 화면과 예약 ID 발급
- 관리자 로그인
- 체크인 대시보드 검색 및 row 단위 체크인
- 취소 및 노쇼 처리
- 실시간 정원 차감
- CSV export
- 기본 Supabase RLS policy
- 참가자 행사별 전화번호/비밀번호 접근
- TanStack Table 기반 관리자 테이블
- Drizzle ORM + SQLite 로컬 프로토타입
- 개인정보 처리방침 페이지와 예약 전 동의 UX

## 16. Release Plan

### Phase 1: Foundation

- Supabase project setup
- Supabase Auth admin setup
- Super admin seed script
- Turborepo monorepo setup
- Drizzle ORM setup
- SQLite local prototype database setup
- Postgres schema and RLS policies
- Event, event day, access, session, participant, timeslot, reservation schema

### Phase 2: Reservation MVP

- Public event page
- Public schedule page
- Public privacy policy page
- Timeslot selection
- Reservation form
- Event-scoped participant access creation/login
- Participant httpOnly cookie session
- Participant reservation lookup and cancellation
- Transaction-based reservation creation through RPC or server-side code
- Reservation completion page

### Phase 3: Admin Operations

- Admin dashboard
- Admin schedule view
- TanStack Table reservation, participant, timeslot tables
- Check-in dashboard search
- Check-in
- Cancellation and no-show
- CSV export

### Phase 4: Hardening

- Concurrent booking test
- Mobile browser QA
- Error message QA
- RLS policy test
- Concurrent reservation transaction test
- Operational checklist

## 17. Future Enhancements

- Tournament bracket generation
- SMS, KakaoTalk, or email notification
- Participant self-service reservation edit
- Participant password reset or recovery flow
- Waitlist and automatic promotion
- Multi-event admin dashboard
- Event template management
- Access code protected events
- Multilingual support
- Advanced analytics dashboard

## 18. Open Questions

- QR 생성 기능을 시스템에서 제공할 것인가, 외부 QR 생성 도구를 사용할 것인가?
- 대회 신청 인원이 32명을 초과할 경우 선착순 마감, 대기자, 별도 타임 분리 중 어떤 정책을 적용할 것인가?
