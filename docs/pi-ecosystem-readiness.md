# Pi Ecosystem Submission Readiness — On the Way

Last reviewed: 22 November 2026

This document tracks the requirements for a Pi Browser app and possible Mainnet Ecosystem listing. It does not claim that the project is registered, approved, listed, or endorsed by Pi Network.

## Product identity
- App name: On the Way
- Category: Mobility marketplace
- Description: Connect passengers with local mobility providers for car, bike and rickshaw journeys, with Pi-first identity and payment flows.
- Brand: Independent purple-and-gold identity. Do not use the official Pi logo, Pi symbol artwork, or branding that implies endorsement.
- App URL/domain: must be an owned HTTPS domain and must not misuse Pi trademarks or begin with pi.

## Pi developer setup
- [ ] Developer has completed the Pi KYC requirements for listing.
- [ ] Register a separate Pi Testnet app for development and test payments.
- [ ] Register a separate Pi Mainnet app for production; the network choice cannot be changed after app registration.
- [ ] Configure development URL and validate Sandbox access from the Pi Browser/Sandbox.
- [ ] Configure hosted/production HTTPS URL in the Developer Portal.
- [ ] Complete domain ownership validation using the portal-provided root validation-key.txt; keep it available for re-checks.
- [ ] Keep the Server API Key and app-wallet private key server-side only.
- [ ] Complete Pi review and app listing checklist; approval/listing is a Pi decision, not controlled by this repository.

## Ecosystem experience requirements
- [x] Pi SDK script is loaded by the app.
- [x] Pi SDK is initialized using version 2.0 and an environment-controlled sandbox flag.
- [x] Authentication access token is verified by the backend through the Pi Platform API /v2/me.
- [ ] Request only the Pi SDK scopes required by features actually implemented.
- [ ] Complete passenger and driver flows inside Pi Browser without sending users to an external booking platform.
- [ ] Implement Pi User-to-App payments with backend approval, completion, verification, idempotency and reconciliation before claiming payment support.
- [ ] All marketplace transactions intended for a Mainnet listing must comply with current Pi-only transaction requirements.
- [ ] Replace development-only public geocoding with an approved, policy-compliant location/routing service that does not undermine the in-app experience.
- [ ] Minimize data collection and document purpose, access, retention, deletion and security controls.
- [ ] Publish reviewed Privacy Policy, Terms, safety, cancellation and support information.
- [ ] Complete real-device Pi Browser compatibility, accessibility and end-to-end acceptance.

## Current engineering state
Implemented:
- Next.js web application and installable PWA foundation.
- Passenger, driver-onboarding and operator-preview pages.
- Pi SDK initialization and backend-verified Pi username authentication.
- Signed server session and logout.
- Passenger booking request persistence and idempotent retry protection.
- Driver application persistence as pending/offline.
- Local PostgreSQL/PostGIS schema and migrations 001–003.
- API/database health endpoint.
- Service worker does not cache private API responses.
- User-controlled PWA service-worker update prompt and offline connectivity notice have been implemented; production build verification is currently blocked by the development machine's full system drive.

Not implemented or not certified:
- Server-authoritative fare quotes and market pricing.
- Driver verification/document handling and approval.
- Driver availability, matching, offers and atomic dispatch.
- Live trip state/events and safety escalation.
- Pi payment lifecycle and payment ledger reconciliation.
- Operator roles, fleet/dispatch console and audit workflows.
- Production geocoding/routing provider and pilot market configuration.
- Real Pioneer Sandbox acceptance and Pi payment test.
- Production domain, portal registration, domain validation and listing review.
- Legal/operations sign-off, privacy retention policy, backup/restore, monitoring and incident response.
- WCAG 2.2 AA and supported-device Pi Browser certification.

## Release policy
Do not advertise live rides, confirmed fares, verified drivers, real-time tracking or completed Pi payments until the matching server-side capability is implemented and tested. A successful local build is not proof of Pi Ecosystem approval or production readiness.

Production/Mainnet remains NO-GO until all critical requirements have recorded evidence.

## Official references
- Getting Started: https://developers.minepi.com/docs/build-first-app/GettingStarted
- Register Your App: https://developers.minepi.com/docs/build-first-app/RegisterApp
- Mainnet Listing Requirements: https://developers.minepi.com/docs/build-first-app/MainnetListing
- Production App Access: https://developers.minepi.com/docs/build-first-app/Production
- Build an App: https://developers.minepi.com/docs/build-first-app/BuildAnApp
- Launching on Pi Mainnet: https://developers.minepi.com/docs/build-first-app/Launch