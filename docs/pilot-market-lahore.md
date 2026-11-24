# First pilot market — Lahore, Pakistan

## Market identity

- Market ID: `PK-PB-LHE`
- City: Lahore
- Province: Punjab
- Country: Pakistan (`PK`)
- Local timezone: `Asia/Karachi` (UTC+05:00)
- Local reference currency: Pakistani rupee (`PKR`, ISO 4217)
- Initial vehicle categories: car, bike and rickshaw
- Pi payment environment: Testnet only; payment processing remains disabled until the payment integration and Testnet acceptance gates pass.

The machine-readable baseline is `config/pilot-market.json`. This is a selected pilot market profile, not a declaration that the service is legally cleared or operational in Lahore.

## Configuration decisions

1. Store all trip timestamps as UTC instants; render local times using `Asia/Karachi`. Never use a fixed UTC offset in application logic.
2. Use PKR for any future local fare reference and display. Store currency as an ISO 4217 code and monetary values as exact decimal amounts, never floating-point arithmetic.
3. Pi is a separate payment asset. Do not label Pi amounts as PKR or apply an assumed Pi/PKR exchange rate. Any future conversion display requires an explicit, sourced quote and policy.
4. No fare amount, minimum, maximum, tax, toll or surcharge is active yet. Those values require an approved Lahore pricing policy and documented test vectors.
5. No service boundary is active. An authorized platform administrator must provision and validate the actual GeoJSON MultiPolygon from an approved geographic source, then complete the required market-readiness activation reference.
6. Booking, dispatch, fare quotes and Pi payments remain disabled for pilot release until their respective technical and operational gates pass.

## Required Lahore launch evidence

- Confirm service area boundaries and neighborhoods with local operations; validate geometry and edge cases before activating a zone.
- Obtain documented local legal review for ride-hailing/transport licensing, driver eligibility, vehicle category rules, insurance, consumer protection, taxation, privacy and incident response.
- Appoint a Lahore operations owner and support/escalation coverage.
- Define driver identity, licence and vehicle-document checks with an approved evidence-storage process.
- Approve a fare card for each supported vehicle type, including base fare, distance/time components, permitted fees, taxes, offer floors/ceilings, cancellation policy and rounding rules.
- Confirm routing provider coverage and actual route-distance/duration behavior within the approved service boundary.
- Run closed Pi Testnet payments and reconciliation; do not enable Mainnet as part of this pilot configuration.
- Complete accessibility, security, mobile and Pi Browser acceptance, backup restore and rollback exercises.

## Release decision

**Current decision: NO-GO.** Lahore is the selected first pilot market, but this profile intentionally enables no commercial operations. A city selection is not legal clearance, service-area approval, pricing approval, or production certification.
