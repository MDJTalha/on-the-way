# Pi Mobility

**Move Freely. Pay with Pi.**

Pi Mobility is a Pi Browser-first, global mobility marketplace concept. The first product release focuses on passenger rides: cars, bikes and rickshaws, with city and intercity journeys planned in staged releases.

> Independent project. Not affiliated with, endorsed by, or operated by Pi Network.

## Current status

- [x] Private GitHub repository created
- [x] Next.js + TypeScript foundation
- [x] Responsive customer booking experience (interactive preview)
- [x] Ride category selection and fare-mode interaction
- [ ] Pi SDK authentication (requires Pi Developer Portal app credentials)
- [ ] Pi Platform API payment lifecycle (requires Testnet credentials)
- [ ] Backend API and persistent database
- [ ] Driver application and live dispatch
- [ ] Real maps and routing provider configuration
- [ ] End-to-end certification

The current UI is a product preview. It does not create live bookings, locate real drivers, navigate, or process Pi payments yet.

## Technology

- Next.js 15 / React 19 / TypeScript
- FastAPI backend (planned)
- PostgreSQL + PostGIS (planned)
- Redis + WebSockets (planned)
- Official Pi SDK and Pi Platform API (planned)
- Maps provider to be selected and configured

## Local development

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
npm run dev
```

Open http://localhost:3000.

## Environment

Copy `.env.example` to `.env.local`. Never commit secrets. The Pi API key is server-only and must never use a `NEXT_PUBLIC_` prefix.

## Product principles

1. Pi-first, with transparent payment amounts and server-side verification.
2. A modular monolith before microservices.
3. Marketplace data must be real; no fabricated drivers, trips or earnings.
4. Country-specific vehicle, pricing, currency, language and regulatory configuration.
5. Safety, privacy, accessibility and operational readiness are release gates.

## Documentation

- [Product specification](docs/product-specification.md)
- [Architecture](docs/architecture.md)
- [Hackathon plan](docs/hackathon-plan.md)
- [Delivery roadmap](docs/implementation-roadmap.md)
