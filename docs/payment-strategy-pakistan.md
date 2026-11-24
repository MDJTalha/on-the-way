# Pakistan payment strategy

## Product decision

On the Way is Pakistan-first and Pi-compatible, not Pi-dependent. The first market is Lahore. PKR is the local reference currency and the target fare currency. Pi is an optional future payment method, not the default or a prerequisite for using the service.

## Current implementation boundary

- The passenger booking API currently records a ride request; it does not calculate a fare, assign a driver, collect money or settle a payment.
- The current passenger sign-in flow still requires Pi authentication. A local phone/email authentication path has not been implemented. This is a launch blocker for a mainstream Pakistan audience that does not use Pi.
- Cash and local digital payment methods are candidates only. No cash collection, wallet, bank, card or payment-gateway integration is enabled.
- `config/payment-policy-pakistan.json` is a policy baseline, not an activation switch or evidence of provider approval.
- Pi payments remain disabled on Testnet and Mainnet until demand is demonstrated, the full payment lifecycle is built and the relevant release gates pass.

## Required implementation sequence

1. Add a non-Pi passenger account path with verified phone/email, session security, rate limits, recovery and abuse controls. Keep Pi sign-in as an optional linked identity.
2. Establish the Lahore operating model: who collects cash, who settles driver earnings, cancellation/no-show handling, receipts, complaints and dispute ownership.
3. Select a locally supported payment provider only after commercial due diligence, merchant onboarding, settlement terms, API documentation and legal review. Do not hardcode a provider before selection.
4. Implement server-authoritative route and fare quotes in PKR using decimal arithmetic, versioned pricing rules, expiry and auditable quote acceptance.
5. Link payment intents to immutable booking and quote identifiers; implement idempotency, verified provider callbacks, reconciliation, refunds and exception handling.
6. Keep all payment methods disabled until end-to-end staging acceptance, security review, operational ownership and legal sign-off.
7. Consider Pi Testnet as an explicit opt-in method only if actual passenger/driver demand supports it. Never infer a PKR/Pi exchange rate or mark a ride paid based only on a client callback.

## Release gate

No fare, payment, dispatch or ride-completion claims are permitted until the corresponding server-side workflow is implemented and tested. Production remains NO-GO while authentication, service boundary, legal/insurance, pricing, driver operations, payment and reliability gates remain open.
