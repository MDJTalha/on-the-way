# Implementation Roadmap — On the Way

The roadmap is evidence-driven. A milestone is complete only after implementation and verification; UI mockups and planned integrations do not count as live functionality.

## Milestone 0 — Product and frontend foundation
- [x] Next.js + TypeScript application foundation.
- [x] Responsive passenger booking preview.
- [x] Car, bike and rickshaw selection.
- [x] Suggested fare / passenger offer interaction (preview only).
- [x] Product scope, architecture and UI/UX documentation.
- [x] CI workflow for typecheck and production build.
- [x] On the Way brand applied to the customer experience and repository documentation.
- [ ] Confirm domain/brand availability and complete repository publishing under the designated organization.
- [ ] Run current CI and record build evidence for the designated repository.

## Milestone 1 — Pi Browser integration
- [ ] Register the Testnet application in Pi Developer Portal.
- [ ] Configure approved app URL and official SDK.
- [x] Implement Pi authentication and backend token validation locally; real Pioneer acceptance remains pending.
- [x] Add environment-safe Sandbox configuration.
- [ ] Test supported Pi Browser versions and mobile devices.

## Milestone 2 — Backend foundation
- [x] Next.js Node.js modular-monolith API foundation and initial API contracts.
- [ ] PostgreSQL/PostGIS schema, migrations and backup/restore.
- [x] User, passenger session and multi-role foundation.
- [x] Driver application profile foundation; document-submission and verification workflow remain open.
- [ ] Country, city, service-zone, currency and timezone configuration.
- [x] Driver application captures an ISO country code; availability checks city + country against an active service zone.
- [ ] Audit events, structured logs and request correlation.

## Milestone 3 — Booking and pricing
- [x] Server-side ride request validation and authenticated persistence.
- [ ] Versioned fare quote engine and transparent breakdown.
- [ ] Passenger offer/counteroffer workflow with policy bounds.
- [ ] Server-authoritative booking state machine.
- [ ] Cancellation, expiry and no-driver rules.
- [ ] Contract, authorization, idempotency and race-condition tests.

## Milestone 4 — Driver operations and dispatch
- [x] Operator-authorized driver review queue and transactional decision/audit API foundation (external evidence review and Pioneer acceptance still pending).
- [ ] Driver onboarding and human verification workflow.
- [x] Server-side driver availability gate and audited online/offline transitions; online activation remains blocked until a verified vehicle and active city/country service zone exist.
- [ ] Secure vehicle onboarding/verification and production service-zone provisioning.
- [ ] Geospatial candidate search and dispatch ranking.
- [ ] Atomic assignment and stale-offer expiry.
- [ ] Realtime dispatch and trip updates.
- [ ] Trip events, completion and incident handling.

## Milestone 5 — Pi Testnet payments
- [ ] Official Pi SDK and Platform API integration.
- [ ] Server-side payment approval and completion.
- [ ] Idempotent callbacks, retries and failure recovery.
- [ ] Payment, booking and ledger reconciliation.
- [ ] Testnet end-to-end payment evidence.

## Milestone 6 — Safety, administration and QA
- [ ] Operator console and least-privilege administration.
- [ ] Support, incident, cancellation and dispute workflows.
- [ ] Privacy, security and threat-model review.
- [ ] Accessibility and responsive QA (WCAG 2.2 AA).
- [ ] Passenger and driver E2E plus failure-path tests.
- [ ] Monitoring, alerting and verified backup restore.

## Milestone 7 — Controlled pilot
- [ ] Select one launch city and confirm legal/insurance requirements.
- [ ] Appoint accountable local operations and support owners.
- [ ] Recruit and verify the pilot driver cohort.
- [ ] Configure service area, pricing, currency and policies.
- [ ] Complete closed Testnet/staging pilot.
- [ ] Review real operational evidence and resolve critical defects.
- [ ] Record explicit production go/no-go approval.

## Release rule

Production is **NO-GO** until every critical gate has implementation evidence and accountable sign-off. See [Pilot and Production Release Gates](pilot-release-gates.md). Mainnet is a separate release decision and must not be enabled by changing a frontend flag alone.

## Engineering progress checkpoint — 22 November 2026

Completed locally:
- Passenger, driver and operator preview routes are present.
- Passenger navigation uses real application routes.
- Passenger home reads /api/health and distinguishes API/database connectivity from pending Pi authentication.
- PostgreSQL 16 + PostGIS runs in a dedicated on-the-way-postgis container with a named persistent volume; its credentials are stored in ignored .env.local.
- Initial migration applied and verified: accounts, driver_profiles, vehicles, service_zones, bookings and payment_events.
- Node.js PostgreSQL pool and health endpoint implemented.
- Booking API validates and persists requests only for a signed passenger session backed by a Pi-verified account; fare calculation and dispatch are not connected.
- Dependency audit fixed without forcing a major Next.js upgrade; full npm audit reports zero vulnerabilities.

Verification:
- TypeScript typecheck passed.
- Next.js production build passed.
- Full npm audit passed with zero vulnerabilities.
- git diff --check passed.
- GET /api/health returned HTTP 200 with database connected.
- GET /api/bookings returned HTTP 401.
- Invalid POST /api/bookings returned HTTP 422.
- Unauthenticated booking requests return HTTP 401; malformed requests return HTTP 422.
- .env.local is ignored by Git.

Not yet certified: real Pi Pioneer sign-in, geocoding/routing, pricing, dispatch, live trip state, Pi payment processing, driver identity verification, admin authorization and production operations. This checkpoint is local development evidence, not production certification.


### Pi authentication foundation — implemented locally, external acceptance pending

- Official Pi SDK script and version 2.0 initialization are wired into the passenger screen.
- Sandbox mode is controlled by NEXT_PUBLIC_PI_SANDBOX.
- Sign-in requests the username scope only.
- Backend validates the access token against the Pi Platform API /v2/me endpoint.
- Verified Pi UID is stored in PostgreSQL; a signed HttpOnly passenger session is issued.
- Session restore, passenger-role check and logout endpoints are implemented.
- Booking create/list endpoints now require a verified passenger session.
- Negative tests: missing session returns 401; malformed booking returns 422; invalid Pi token returns 401.

Not yet certified: a successful sign-in by a real Pi Sandbox Pioneer, production app registration, session abuse/rate-limit controls, payment scope and the full payment handshake.


### Driver application workflow — implemented locally, verification pending

- Added migration 002 for account_roles and driver application metadata.
- Driver portal restores the verified passenger session and loads the current application.
- Driver application POST validates city, vehicle category and explicit consent.
- Application is persisted with pending verification and offline availability.
- Driver profile lookup is scoped to the signed-in account.
- Unauthenticated driver application and profile endpoints return HTTP 401.

Real identity/document verification, licence/vehicle checks, approval controls, driver role activation, online availability and dispatch remain unimplemented.


### Booking retry integrity — implemented locally, verified 22 November 2026

- Added migration 003 with passenger-scoped booking idempotency key and SHA-256 canonical request hash.
- Booking creation requires an Idempotency-Key header and validates its length and character set.
- First successful request creates one booking and returns HTTP 201.
- Retry with the same passenger, key and canonical payload returns the original booking with replayed=true.
- Reuse of a key with a different payload returns HTTP 409.
- PostgreSQL partial unique index enforces one booking per passenger/key under concurrent requests.
- CI migration sequence now includes migration 003.
- Database setup and architecture documentation describe retry semantics and the limitation: idempotency does not imply fare quote, driver assignment or payment authorization.

Verification:
- Migration 003 applied successfully to the dedicated local On the Way database.
- TypeScript typecheck passed after the API change.
- Next.js production build passed after the API change.
- git diff --check passed; only line-ending normalization warnings were emitted.
- Database inspection confirmed both idempotency columns and the unique index.
- A full authenticated HTTP replay/race test is still pending a real Pi-authenticated test account; no synthetic user/session was created.

Remaining: add contract tests for idempotency replay and concurrent retries using a controlled test fixture; complete server-side rate limiting and audit correlation before exposing booking creation beyond development.


## Frontend milestone update — 22 November 2026

Implemented locally:
- Reworked passenger booking UI to use real place search results, browser geolocation with explicit user action, pickup/destination coordinates and OpenStreetMap map embedding.
- Connected passenger request form to the authenticated booking API with a fresh idempotency key per intentional request.
- Added honest no-quote state: no illustrative fare or invented driver/ETA/availability values are shown.
- Added authenticated recent booking history and request status labels based only on persisted API data.
- Added optional passenger note, validation, loading/disabled states, accessible live notices and mobile layout adjustments.
- Added PWA web manifest, install icons, service-worker registration and an offline navigation fallback. API routes and private Next.js assets are never cached by the service worker.
- Updated booking API response shape so a newly created or replayed booking includes pickup and destination labels required by the passenger history UI.

Important limitations:
- Place search currently uses the public OpenStreetMap Nominatim endpoint for development and must be replaced with a contracted/operationally compliant provider before production; observe the provider's usage policy and attribution.
- The map shows a selected location, not a verified turn-by-turn route. No route geometry, travel time, distance, ETA or driver availability is fabricated.
- Fare quotes, scheduled rides, driver matching, live tracking and Pi payments are not available until their backend workflows and pilot configuration exist.
- PWA install/offline behavior still needs acceptance testing on supported Android, iOS and Pi Browser versions. Offline mode does not support booking or authentication.

- Driver portal now initializes the official Pi SDK itself and supports Pi sign-in directly on /driver; it loads the signed-in account's application after server-side identity verification. Driver approval and online activation remain intentionally unavailable.


## Frontend hardening checkpoint — 22 November 2026

Additional local changes:
- Passenger booking retries retain the same idempotency key when the exact same request payload is retried after a network or uncertain response. A changed payload receives a new key; a confirmed response clears the pending key.
- A replayed booking response is communicated distinctly so the passenger knows the original request was recovered.
- Driver portal now exposes sign-out and clears the local authenticated/application view after calling the logout endpoint.
- Added shared keyboard-visible focus treatment, disabled-control affordances, touch interaction hints and narrow-screen header adjustments.

Verification:
- npm run typecheck: passed as part of the production build command.
- npm run build: passed; Next.js generated all 8 static pages and the passenger, driver, business and API route bundles.
- Local HTTP smoke test: passenger, driver, business, manifest and health endpoints returned HTTP 200; unauthenticated booking API returned HTTP 401 as expected.
- git diff --check: passed before the latest CSS and retry/sign-out hardening; rerun before commit.
- No Git commit, push or deployment was performed.

Still not frontend-certified:
- Business/operator console is a capability preview; no operator roles, fleet APIs, dispatch queues or reconciliation APIs exist yet.
- No fare quote/offer, driver assignment, live trip, payment, receipt, cancellation or dispute UI can be truthfully marked operational until the corresponding server contracts are implemented.
- Pi authentication requires acceptance in Pi Browser with a registered sandbox/production app; this was not validated with a real Pioneer in this checkpoint.
- Responsive visual acceptance, screen-reader/keyboard audit and WCAG 2.2 AA contrast measurements remain open.
- Pilot city and production map/routing provider are not configured. Public Nominatim remains development-only.


## Operator and session UX checkpoint — 22 November 2026

- Replaced the static business capability preview with a client-side service foundation panel that checks the real /api/health endpoint, reports API/database connectivity, shows the last successful check time, and allows manual refresh. It explicitly states that this health result is not operational or production readiness.
- Added dependency-level explanations to each planned operator capability so unavailable functions are not mistaken for implemented controls.
- Passenger sign-out now checks the server response, prevents duplicate auth actions while busy, clears account-scoped booking history and pending retry state only after confirmed logout, and displays a retry message on failure.
- Driver sign-out now checks the server response, disables concurrent auth actions, and clears local driver application state only after confirmed logout.
- Added responsive operator health panel styling.

Verification:
- TypeScript check and Next.js production build passed after these changes.
- Passenger, driver, business, PWA manifest and health routes returned HTTP 200 on the local app.
- The business page now includes a live database connectivity check, but no operator authorization, fleet, dispatch, finance or support service has been implemented.
- npm audit is being rerun as a separate check; result to be recorded after completion.

- Follow-up verification completed: npm audit --audit-level=moderate reported 0 vulnerabilities; git diff --check passed.
- Restarted the local Next.js production server so the refreshed business UI is served from the latest production build; verified the response contains the new Service foundation / LIVE PLATFORM CHECK content.
- Final local smoke test after restart: /, /driver, /business, /manifest.webmanifest and /api/health all returned HTTP 200.


## Passenger frontend hardening and brand alignment — 22 November 2026

- Aligned the shared interface accents with the current On the Way purple-and-gold brand direction while retaining green for service-health success indicators.
- Hardened location search against stale asynchronous responses: editing a query invalidates prior results, clears obsolete suggestions, and prevents overlapping pickup/destination searches.
- Validated external geocoder results before exposing them to booking state: display name required and latitude/longitude must be finite and within geographic bounds.
- Improved search feedback with an explicit Searching… state and disabled both search actions while a request is active.
- Kept the public Nominatim integration clearly documented in code as development-only; a contracted production geocoding/routing provider remains a release dependency.

Verification:
- npm run typecheck: passed.
- npm run build: passed; Next.js generated the passenger, driver, business, manifest and API routes.
- git diff --check: passed (only existing LF/CRLF normalization warnings were emitted).
- Local HTTP smoke test: /, /driver, /business, /manifest.webmanifest and /api/health all returned HTTP 200.
- Health payload confirmed API status ok and database connected.
- Unauthenticated /api/bookings and /api/drivers/me returned HTTP 401, confirming protected API routes still reject anonymous requests.
- No authenticated Pioneer acceptance test, visual-device matrix, accessibility certification, Git commit, push or deployment was performed.


## Pi Browser / installable web-app update foundation — 22 November 2026

- Reworked the service-worker lifecycle so first installation can activate immediately, while later releases wait for an explicit user update action.
- Added a visible "Update app" prompt when a new service worker is waiting; the app reloads only after the updated worker takes control.
- Added a live offline connectivity notice that explicitly distinguishes cached page availability from live booking/account availability.
- Added an update-check when the app becomes visible and remains online.
- Kept private API responses and Next.js build assets outside the service-worker cache.
- Versioned the app shell cache and limited cleanup to this application's own cache namespace.
- Aligned PWA manifest theme/background colors with the current purple-and-gold brand direction.

Verification in progress:
- TypeScript and production build are being rerun after these changes.
- Pi Browser device installation, real update hand-off, offline recovery and Android/iOS home-screen behavior still require device acceptance testing.
- The PWA remains a web application; this work does not create a native APK or register/publish the app in the Pi Developer Portal.


Verification outcome:
- npx tsc --noEmit --incremental false: passed.
- node --check public/sw.js: passed.
- git diff --check: passed (line-ending normalization warnings only).
- Next.js production compilation reached "Compiled successfully", but build finalization failed with ENOSPC while writing the webpack cache / .next cache.
- The C: drive had only 22 MB free. Removed only this project's generated .next/cache directory (about 120.5 MB); the retry consumed the available space and failed again with ENOSPC. No user documents, databases, Docker volumes, or other project files were deleted.
- A full production build and runtime smoke test of the updated PWA bundle remain blocked until safe disk space is made available.


## Verification checkpoint — 23 November 2026

Completed against the current local checkout of the designated GitHub repository:
- Recovered disk capacity and confirmed the project directory remains `C:\Projects\Pi-Mobility`; no unrelated files, databases or Docker volumes were removed during this work session.
- `npm run typecheck`: passed.
- `node --check public/sw.js`: passed.
- `git diff --check`: passed; Git reported only expected LF/CRLF normalization warnings.
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities.
- `npm run build`: passed. Next.js compiled successfully, type/lint checks completed, all 8 static pages generated and build traces collected.
- Started the newly built production server on port 3002 and smoke-tested: `/`, `/driver`, `/business`, `/manifest.webmanifest` and `/api/health` returned HTTP 200; `/api/bookings` and `/api/drivers/me` returned HTTP 401 while unauthenticated, as required.
- Health endpoint returned `status: ok` and `database: connected`.

This verifies the current application build and basic local HTTP/API protections only. It does not certify Pi Pioneer authentication, dispatch, pricing, Pi payments, driver verification, operator workflows, accessibility, production hosting or Pi Ecosystem listing. No commit, push or deployment was performed; GitHub write permission remains an external blocker.


## Passenger cancellation slice — 23 November 2026

Implemented locally:
- Added POST `/api/bookings/[id]/cancel` for passenger-owned ride requests.
- The handler verifies the signed passenger session, validates the booking UUID, scopes lookup to the authenticated passenger, and locks the booking row inside a transaction.
- Only `requested` and `matching` bookings may be cancelled. Assigned or progressed trips return HTTP 409; unknown or other passengers' bookings return HTTP 404.
- Repeated cancellation of an already-cancelled booking is idempotent and returns the persisted state.
- Passenger ride history now exposes a cancellation action only for `requested` and `matching` states and updates the view only after server confirmation.

Verification:
- `npm run typecheck`: passed.
- `npm run build`: passed; Next.js generated the new dynamic `/api/bookings/[id]/cancel` route.
- Production-server smoke tests on port 3003: `/`, `/driver`, `/business`, `/manifest.webmanifest` and `/api/health` returned HTTP 200; `/api/bookings`, `/api/drivers/me` and unauthenticated cancellation returned HTTP 401.
- Health endpoint confirmed PostgreSQL connected.
- No authenticated cancellation integration test was run because no real Pi-authenticated Pioneer session was available. No test booking or synthetic account was created.

Limitations: cancellation fees, driver-side acceptance, assigned-trip cancellation, support escalation and audit-event history are not implemented. The endpoint deliberately refuses to cancel after the request leaves the safe pre-assignment states.


## Booking event integrity — 23 November 2026

Implemented locally:
- Added migration 004 with a booking event history table, constrained event types, status fields, JSON object metadata and booking/actor timeline indexes.
- Booking creation now writes `booking_requested` in the same transaction as the booking insert.
- Passenger cancellation now writes `booking_cancelled` with the prior and resulting status in the same transaction as the state transition.
- CI migration validation and database setup instructions now include migration 004.
- Applied migration 004 to the dedicated local `on_the_way` database on `127.0.0.1:55433`; confirmed `booking_events` exists with its three indexes.

Verification:
- `npm run typecheck`: passed.
- `node --check public/sw.js`: passed.
- `npm run build`: passed; dynamic cancellation route included in build output.
- Fresh production server smoke test on port 3004: passenger, driver, business, manifest and health returned HTTP 200; protected booking, driver profile and cancellation endpoints returned HTTP 401 without a session.
- `/api/health` returned database connected.
- No synthetic account or booking was created. Authenticated booking/cancellation event insertion still requires a real Pi Sandbox Pioneer acceptance test.

No Git commit, push or deployment was performed. GitHub write access is still unresolved.


## Driver application integrity and re-verification checkpoint — 23 November 2026

Implemented locally:
- Added migration 005 for append-only driver application event history, including actor, previous/new verification state, event metadata and timeline indexes.
- Driver application submission and revision now write their audit event in the same database transaction as the profile mutation.
- Editing the operating city or preferred vehicle category on a previously verified profile returns it to pending verification and forces availability offline. Re-submitting unchanged details preserves verified status and existing availability; suspended profiles remain suspended and offline.
- CI migration validation and database setup documentation now include migration 005.

Verification:
- `npm run typecheck`: passed after the final account-row locking change.
- `npm run build`: passed; all 8 static pages generated and the driver application API route compiled.
- Migration 005 applied successfully to the dedicated local `on_the_way` database; confirmed `driver_application_events` exists with its primary-key and two timeline indexes.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Fresh production server on port 3005: `/`, `/driver`, `/business`, `/manifest.webmanifest` and `/api/health` returned HTTP 200; `/api/drivers/me` and unauthenticated POST `/api/drivers/apply` returned HTTP 401.
- Health payload confirmed PostgreSQL connected.

Limitations: no authenticated Pioneer application was submitted, so transactional event creation and re-verification behavior have not been exercised end-to-end with a real account. No commit, push or deployment was performed.


## Operator driver-review API foundation — 23 November 2026

Implemented locally:
- Added migration 006 to extend append-only driver application event types for review start, verification, rejection and suspension, plus a review-queue index.
- Added server-side operator authorization based on the signed Pi-authenticated session plus an explicit `operator` or `platform_admin` membership in `account_roles`. A passenger session alone is insufficient.
- Added `GET /api/operators/drivers` with bounded queue size, status filtering, no-store responses and a minimal application data projection.
- Added same-origin-protected `PATCH /api/operators/drivers` for review decisions. Row locking and one transaction protect the profile transition, driver-role grant/revocation and audit event.
- Verification requires an external verification case reference; rejection/suspension require a reason. These are audit metadata, not a substitute for actual identity/licence/vehicle evidence review.
- Every review decision leaves driver availability offline. Only a verified decision grants the driver role; no online activation or dispatch is implied.
- CI migration sequence and database setup instructions now include migration 006.

Verification:
- `npm run typecheck`: passed after adding the operator API.
- `npm run build`: passed; Next.js compiled the dynamic `/api/operators/drivers` route and generated all 8 static pages.
- Applied migration 006 to the dedicated local `on_the_way` database; verified the expanded event constraint and `driver_profiles_review_queue_idx`.
- Authenticated operator acceptance, review queue UI, real evidence checks and full decision-path integration tests remain pending. No synthetic Pioneer account or driver application was created.
- No Git commit, push or deployment was performed.


Operator review UI verification addendum — 23 November 2026:
- Connected the business/operator screen to the protected driver review queue. It handles sign-in required, insufficient operator permissions, empty queues, loading/errors and review outcomes; it does not expose the queue to passenger-only accounts.
- Added status filtering, refresh, start-review, approve, reject and suspend actions. Approval requires an external case reference; reject/suspend require a reason. The UI states that evidence review remains external and approval does not activate availability.
- Final `npm run typecheck`: passed.
- Final `npm run build`: passed with no CSS compatibility warnings; `/business` bundle includes the operator review UI and `/api/operators/drivers` is compiled as a dynamic route.
- `npm audit --audit-level=moderate`: found 0 vulnerabilities.
- Runtime smoke test on local production server port 3006: `/business` returned HTTP 200 and contained the driver review UI; `/api/health` returned HTTP 200 with database connected; unauthenticated GET and PATCH `/api/operators/drivers` both returned HTTP 401.
- No authorized operator session exists for an end-to-end decision test, so operator queue data visibility, state changes, role grant/revocation and event insertion remain unverified through HTTP.

- Authorization boundary test: a correctly signed short-lived passenger session with no operator membership was denied HTTP 403; the temporary test token used a random non-existent account ID and created no database account or driver record. The temporary test script was removed.
- Git executable is still unavailable on this Windows checkout (the `.git` directory exists, but no Git binary was found in standard installation paths). Consequently, `git status`, `git diff --check`, commit and push could not be performed. GitHub synchronization remains unverified.


## Driver availability and market identity checkpoint — 23 November 2026

Implemented locally:
- Driver applications now require an ISO 3166-1 alpha-2 operating country code in addition to the city; changes to city, country or vehicle category invalidate prior verification and force the profile offline.
- Operator review queue includes the operating country code.
- Added `GET/PATCH /api/drivers/availability`. Only accounts with an approved driver role can access it. Online activation requires a verified driver profile, a verified vehicle matching the selected category and an active service zone matching both city and country.
- Availability mutation locks the driver profile, verified vehicle row and active service-zone row for the duration of the transaction, preventing eligibility records from changing during the online transition. Each availability change writes an append-only driver application event in the same transaction. A busy driver cannot switch offline.
- Driver portal now captures country code and presents availability status/blockers for verified drivers. It does not imply approval or activation.
- Migration 007 was applied to the dedicated local PostGIS database. Verified the `service_country_code` column, expanded event-type constraint, verified-vehicle index and country/city active-zone index. Reapplied the migration after correcting the existing index definition so the local index includes country code.

Verification:
- `npm run typecheck`: passed.
- `npm run build`: passed; `/api/drivers/availability` compiled as a dynamic route and all 8 static pages generated.
- `npm audit --audit-level=moderate`: 0 vulnerabilities.
- Local production server on port 3007: `/`, `/driver`, `/business`, `/manifest.webmanifest` and `/api/health` returned HTTP 200; health payload reported database connected.
- Unauthenticated GET `/api/drivers/availability` and GET `/api/operators/drivers` returned HTTP 401. Unauthenticated PATCH `/api/drivers/availability` returned HTTP 401. Unauthenticated POST `/api/drivers/apply` returned HTTP 401. POST to the availability endpoint returned HTTP 405 as expected because only GET/PATCH are supported.

Not certified:
- No real Pi-authenticated driver/operator session was available for positive-path testing.
- No secure vehicle document onboarding, vehicle approval UI, active pilot service zone or actual driver dispatch exists yet; online activation is therefore expected to remain blocked.
- CI has not run on GitHub. No commit or deployment has been performed.
- Additional authorization test: a correctly signed short-lived passenger session without a driver role received HTTP 403 on both availability GET and PATCH; a signed session for a non-existent account received HTTP 403 on driver application submission. The temporary test script was removed; no user or driver records were created.

- Isolated positive-path integration test completed against a disposable PostgreSQL/PostGIS database with migrations 001–007: passenger application (201), operator review (200), operator verification (200), online attempt correctly blocked without verified vehicle/zone (409), online transition after verified vehicle + matching active service zone (200), offline transition (200), and city-change reverification reset to pending/offline with online re-entry blocked (409).
- The test verified one `application_submitted`, one `review_started`, one `application_verified` and two `availability_changed` audit events. It used short-lived HMAC-signed test sessions and synthetic fixture accounts, not a real Pioneer account.
- The disposable acceptance database and temporary test script were removed after the test. The primary `on_the_way` database was checked afterward and remained accessible.
