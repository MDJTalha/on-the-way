# Product Specification — On the Way

## 1. Product definition

On the Way is an independent, global mobility marketplace designed first for Pi Browser. It connects passengers with independent drivers and fleet operators. Pi is the primary payment ecosystem, subject to Pi Platform capabilities, regional law and production approval.

**Positioning:** Move Freely. Pay with Pi.

**Non-affiliation:** On the Way is an independent project and must not imply endorsement, ownership or operation by Pi Network.

## 2. MVP objectives

1. Authenticate users through the official Pi authentication flow.
2. Allow a passenger to create a city ride request.
3. Support car, bike and rickshaw categories.
4. Allow suggested pricing and passenger fare offers.
5. Match eligible, available drivers.
6. Let a driver accept or counter an offer.
7. Manage a validated trip lifecycle.
8. Integrate Pi Testnet payments and server-side verification.
9. Provide operational administration and auditable records.
10. Work responsively in supported Pi Browser environments.

## 3. Personas and roles

- Passenger: requests, pays for and reviews rides.
- Driver: registers, verifies identity and vehicle, manages availability and trips.
- Fleet operator: manages only its assigned fleet and staff.
- City operator: manages service zones, local pricing and operational cases.
- Country administrator: manages country-specific configuration.
- Global platform administrator: manages global policies and platform operations.

Least-privilege access is mandatory.

## 4. MVP service scope

### P0
- Standard car, bike and rickshaw.
- Within-city point-to-point booking.
- Pickup and destination search.
- Immediate booking.
- Fare estimate and passenger offer.
- Driver availability and matching.
- Driver accept / reject / counteroffer.
- Trip lifecycle and history.
- Pi Testnet payment demonstration.
- Support, ratings and basic administration.

### P1
- Scheduled rides.
- City-to-city trips.
- Premium car.
- Airport transfers.
- In-car hourly hire.
- Corporate accounts and fleet scheduling.

Freight, food, grocery and retail are future product modules and are excluded from the first mobility MVP.

## 5. Customer workflow

1. Open On the Way in Pi Browser.
2. Authenticate with Pi.
3. Select Ride.
4. Set pickup and destination.
5. Select a vehicle category.
6. Review estimated fare and trip details.
7. Accept suggested fare or submit an offer.
8. Receive eligible driver offers.
9. Select and confirm a driver.
10. Follow driver arrival and trip progress.
11. Review payment amount and complete the supported Pi payment flow.
12. Confirm completion and rate the experience.

## 6. Driver workflow

1. Authenticate and create a driver profile.
2. Submit identity, licence, vehicle registration and required local documents.
3. Await human or approved verification.
4. Select vehicle category and service zone.
5. Set online/offline availability.
6. Receive eligible requests.
7. Accept, reject or counteroffer.
8. Navigate to pickup using an approved maps integration.
9. Confirm pickup and trip start.
10. Complete the trip and reconcile payment records.

A driver must not receive live requests until required verification is approved and current.

## 7. Fare principles

A local pricing policy may combine base fare, distance, time, permitted surcharges and taxes. All fare calculations must be performed or validated server-side. The passenger sees a clear breakdown before confirmation.

Negotiated offers must respect configured minimums, maximums and local rules. Confirmed prices cannot be silently changed.

## 8. Pi payment requirements

- Use the official Pi SDK and Pi Platform API only.
- Keep the Pi API key on the server.
- Verify authentication tokens server-side.
- Implement the documented payment approval and completion lifecycle.
- Make callbacks and payment processing idempotent.
- Persist payment IDs, transaction IDs, amounts, status and timestamps.
- Reconcile payment and booking records.
- Never mark payment complete based only on frontend state.
- Do not claim escrow, automatic refunds or custody unless supported and approved.
- Use Testnet during development; Mainnet only after approval and release gates.

## 9. Safety and privacy

- Collect location only with informed permission and for a defined purpose.
- Minimize location retention and restrict access.
- Provide driver/vehicle identification, support and incident reporting.
- Maintain auditable cancellation and dispute records.
- Protect personal documents and apply retention/deletion policies.
- Establish country-specific emergency and insurance procedures before launch.

## 10. Success measures

Only report metrics derived from real system records: verified active drivers, booking requests, acceptance rate, completed rides, cancellation rate, payment success/failure, repeat usage, dispute rate, customer rating and platform revenue.

## 11. Out of scope for MVP

- Freight and truck booking.
- Food and grocery delivery.
- Retail marketplace.
- Native Android/iOS apps.
- Automatic Pi-to-fiat conversion.
- Unverified escrow or custody features.
- Unmoderated driver onboarding.
- Production launch in multiple countries simultaneously.
