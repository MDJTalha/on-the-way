import fs from 'node:fs';
function readJson(path){ return JSON.parse(fs.readFileSync(path,'utf8').replace(/^\uFEFF/,'')); }
const market=readJson('config/pilot-market.json');
const policy=readJson('config/payment-policy-pakistan.json');
const errors=[];
if(market.marketId!=='PK-PB-LHE'||market.country.iso3166Alpha2!=='PK'||market.city.slug!=='lahore') errors.push('Pilot market must be PK-PB-LHE (Lahore, Pakistan).');
if(market.currency.iso4217!=='PKR'||policy.currency!=='PKR') errors.push('Pilot and payment policy currencies must both be PKR.');
if(policy.marketId!==market.marketId) errors.push('Payment policy marketId must match pilot market.');
if(policy.primaryPaymentModel!=='locally_supported_methods') errors.push('Local payment methods must remain the primary model.');
if(policy.paymentCollectionEnabled!==false) errors.push('Payment collection must remain disabled before release approval.');
if(policy.methods.cash.enabled!==false||policy.methods.localDigitalPayments.enabled!==false) errors.push('Cash and local digital methods must remain disabled until approved.');
if(policy.methods.localDigitalPayments.provider!==null) errors.push('No payment provider may be configured before selection and approval.');
if(policy.pi.role!=='optional_future_method'||policy.pi.enabled!==false||policy.pi.mainnetEnabled!==false) errors.push('Pi must remain optional and disabled.');
if(market.piPayments.enabled!==false||market.piPayments.mainnetEnabled!==false) errors.push('Pilot-market Pi payments must remain disabled.');
if(market.releaseControls.bookingEnabled!==false||market.releaseControls.dispatchEnabled!==false||market.releaseControls.fareQuotesEnabled!==false) errors.push('Booking, dispatch and fare quotes must remain disabled before release gates pass.');
if(errors.length){ console.error('CONFIG_VALIDATION_FAILED'); for(const e of errors) console.error('- '+e); process.exit(1); }
console.log('CONFIG_VALIDATION_PASSED: Lahore/PKR aligned; local methods primary; Pi optional; payment collection, cash, digital rails, bookings, dispatch and fare quotes disabled.');
