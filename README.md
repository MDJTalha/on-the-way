# On the Way

**Move freely. Pay with Pi.**

On the Way is an independent, Pi Browser-first mobility marketplace. The initial service scope is point-to-point passenger transport by car, bike and rickshaw, with a staged path toward city and intercity journeys.

> On the Way is an independent project. It is not affiliated with, endorsed by, or operated by Pi Network.

## Repository status

This repository now contains the responsive Next.js passenger, driver and operator experiences, initial server API routes, and an isolated local PostgreSQL/PostGIS development database. It is **not yet a live mobility marketplace and is not production-ready**.

| Capability | Current state |
|---|---|
| Responsive passenger booking preview | Implemented |
| Vehicle category and illustrative fare selection | Implemented |
| Suggested fare / passenger offer interaction | Preview only |
| Scheduled ride UI | Preview only; no scheduling API |
| Pi authentication | Implemented locally; real Pi Browser/Sandbox acceptance pending |
| Backend, database and persistent accounts | Initial local API, PostgreSQL schema and signed passenger sessions implemented |
| Driver onboarding, verification and dispatch | Application persistence implemented; identity verification and dispatch not implemented |
| Live geocoding, maps, routes or ETAs | Not integrated |
| Pi payments and reconciliation | Not integrated |
| Operator console and support workflows | Not implemented |

The UI deliberately labels sample fares, map artwork and network status. No driver availability, route, ETA, booking, payment or traction metric should be inferred from this preview.

## Product workflow

**Passenger:** Pi sign-in → pickup and destination → vehicle category → server-issued fare quote or offer → eligible driver offers → driver confirmation → trip status → Pi payment → receipt and rating.

**Driver:** onboarding → identity/licence/vehicle submission → human verification → service-zone and availability setup → accept/reject/counteroffer → pickup and trip lifecycle → payment reconciliation.

**Operations:** configure countries, cities, service zones and pricing; verify drivers; monitor bookings and payments; handle support, incidents and disputes; review audit records.

## Technical direction

- Frontend: Next.js 15, React 19, TypeScript, responsive PWA.
- Backend: Next.js Node.js route handlers for the initial modular monolith; service extraction only when justified.
- Persistence: PostgreSQL + PostGIS (local development schema and migrations implemented; production operations pending).
- Realtime and ephemeral presence: Redis + WebSockets (planned).
- Identity: official Pi SDK and server-side Pi Platform API token verification implemented locally; real Pioneer acceptance pending. Payments: server-side approval/completion not yet implemented.
- Maps: provider selection and credentials required.
- Delivery: Docker, CI, staging, observability and verified backups (planned).

## Local development

Requirements: Node.js 20.9+ and npm.

```powershell
npm ci
npm run dev
```

Open http://localhost:3000.

Verification:

```powershell
npm run typecheck
npm run build
```

## Environment and secrets

Copy `.env.example` to `.env.local` and populate only values for services actually configured. Never commit credentials. Pi API secrets must remain server-side and must never use a `NEXT_PUBLIC_` variable. Use Pi Testnet for development; Mainnet requires separate credentials, approval and release authorization.

## Engineering principles

1. Pi-first integration, using official documented SDK/API flows only.
2. Backend is authoritative for identity, pricing, booking state and payment status.
3. Idempotent booking/payment mutations and auditable state transitions.
4. No fabricated drivers, availability, trips, ETAs, routes, earnings or growth metrics.
5. Country-specific currency, timezone, language, vehicle and regulatory configuration.
6. Least-privilege access, location minimization, safety operations and accessibility.
7. Start as a modular monolith; extract services only when operational evidence justifies it.

## Delivery plan

See [implementation roadmap](docs/implementation-roadmap.md), [product specification](docs/product-specification.md), [architecture](docs/architecture.md), and [pilot and release gates](docs/pilot-release-gates.md).

## Server foundation

The repository includes database health, Pi identity verification, signed passenger sessions, passenger booking persistence and driver application APIs. Booking requests require a verified passenger session; pricing, geocoding, dispatch and payments are not yet active. See [Database setup](database/README.md) and [Architecture](docs/architecture.md).
## Pi authentication foundation

The passenger sign-in flow now loads and initializes the official Pi SDK, sends the resulting access token to the server, validates it against Pi's Platform API, and establishes a signed HttpOnly passenger session. Sandbox mode is configured locally. A successful real Pi Browser/Sandbox sign-in still requires acceptance testing with a registered developer app. Pi payments are not yet implemented.

## Driver onboarding foundation

Driver onboarding now supports a Pi-authenticated, consented application record for operating city and preferred vehicle category. Applications remain pending and offline until manual verification and approval workflows are implemented. No KYC documents or identity evidence are collected by this initial form.


## Frontend experience update

The passenger screen now supports place search (development geocoder), explicit browser geolocation, a real OpenStreetMap location view, vehicle selection, optional trip notes, authenticated booking submission and persisted booking history. Ride requests use the server's idempotency contract. The interface deliberately does not display sample fares, ETAs, live drivers or fabricated route lines.

The application now includes a web manifest, install icons, service-worker registration and an offline fallback page. Offline behavior is informational only; authentication, place search and booking require a live connection.

The public Nominatim geocoder is for development only and must be replaced or formally approved for the intended production usage. The map currently visualizes a selected place, not a navigable route. Fare calculation, scheduling, driver dispatch, live trip tracking and Pi payment remain backend/product release dependencies.


## Embedded maps

- The passenger journey map supports the Google Maps Embed API inside the application, including route directions between selected pickup and destination and satellite imagery (Google Maps satellite layer).
- Configure NEXT_PUBLIC_GOOGLE_MAPS_API_KEY in the deployment environment after enabling the Maps Embed API in Google Cloud. The API requires a valid key and a billing-enabled Cloud project; the Embed API itself is currently documented by Google as no-charge with unlimited requests. Restrict the key to the Maps Embed API and approved HTTP referrers.
- When the Google key is absent, the UI retains an OpenStreetMap location fallback. The fallback does not provide verified route directions. Do not treat satellite imagery as a separate embedded Google Earth application; Google Maps satellite mode is the supported embedded imagery path.
- Map route display is a visual directions view only; fare, dispatch, live driver tracking and booking state remain backend-controlled and are not inferred from the map.
