# UI and Experience Specification

## Experience objective

Deliver a calm, premium mobility interface that is immediately understandable in Pi Browser on mobile and remains efficient on desktop. The interface must make the next action obvious without implying that unavailable marketplace services are live.

## Design direction

- Brand: On the Way — “Move Freely. Pay with Pi.”
- Visual character: confident, clean, practical, human and globally usable.
- Palette: deep evergreen/charcoal for structure, restrained lime accent for primary actions, warm off-white surfaces, muted neutral text.
- Typography: high-legibility sans serif with clear hierarchy; avoid decorative display treatments in operational screens.
- Layout: mobile-first, generous but purposeful spacing, compact operational cards, consistent 8-point spacing rhythm.
- Motion: short, reduced-motion-aware transitions; never use motion to communicate a critical booking or payment state by itself.

## Customer booking screen

1. Header: brand, role navigation, environment indicator, Pi sign-in action.
2. Journey: pickup and destination fields with explicit permission before requesting device location.
3. Vehicle choice: car, bike and rickshaw; show capacity and accessibility details only when verified.
4. Price: distinguish server-issued fare quotes from illustrative preview values; show currency/Pi amount, quote expiry and itemized fees when live.
5. Request: confirm pickup, destination, vehicle and price before submission.
6. Matching: show only real driver offers returned by dispatch; explain when no drivers are available.
7. Trip: show assigned driver and vehicle only after a valid assignment; provide trip-sharing and support controls.
8. Payment: show the exact Pi amount and transaction state; distinguish initiated, approved, completed, failed and reconciled.

## Driver experience

- Onboarding checklist with identity, licence, vehicle and service-zone verification.
- Clear pending/approved/rejected/expired document states.
- Online/offline control and permission-aware location sharing.
- Incoming request card with pickup area, destination area, vehicle requirements and fare/offer.
- Accept/reject/counteroffer actions with server-confirmed result.
- Active trip milestones and earnings ledger based only on reconciled records.

## Operator experience

- Role-scoped queues for drivers, bookings, support cases and payment reconciliation.
- Country/city/service-zone filters.
- Audit history for sensitive changes.
- No fabricated dashboard metrics or seeded production-looking records.

## Interaction and content rules

- All primary actions have loading, success, empty, error and retry states.
- Never claim a booking exists until the API confirms persistence.
- Never show driver ETAs, driver counts, route distance or live availability unless supplied by a live provider/backend.
- Clearly label preview data and disable real payment actions in preview mode.
- Do not present a static map illustration as navigation or a live map.
- Use plain language for errors and preserve entered form data after recoverable failures.

## Accessibility and responsive quality

- Target WCAG 2.2 AA.
- Keyboard-operable controls and visible focus states.
- Programmatic labels, semantic headings and status announcements.
- Minimum 4.5:1 contrast for normal text and 3:1 for large text and essential UI graphics.
- Touch targets sized for mobile use; no horizontal overflow at 320 CSS pixels.
- Respect reduced-motion preferences and browser text scaling.
