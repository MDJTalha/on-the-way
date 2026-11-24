import assert from "node:assert/strict";

const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

async function get(path) {
  return fetch(new URL(path, baseUrl), {
    redirect: "manual",
    headers: { Accept: "text/html,application/json" },
  });
}

const pagePaths = ["/", "/driver", "/business", "/manifest.webmanifest", "/sw.js"];
for (const path of pagePaths) {
  const response = await get(path);
  assert.equal(response.status, 200, `${path} should return HTTP 200`);
  console.log(`PASS ${path} HTTP 200`);
}

const healthResponse = await get("/api/health");
assert.equal(healthResponse.status, 200, "health endpoint should be ready");
const health = await healthResponse.json();
assert.equal(health.status, "ok", "API health should be ok");
assert.equal(health.database, "connected", "database should be connected");
console.log("PASS /api/health reports connected database");

const protectedPaths = [
  "/api/bookings",
  "/api/drivers/vehicles",
  "/api/operators/audit",
  "/api/operators/service-zones",
  "/api/operators/vehicles",
];
for (const path of protectedPaths) {
  const response = await get(path);
  assert.equal(response.status, 401, `${path} must reject unauthenticated access`);
  console.log(`PASS ${path} rejects unauthenticated access`);
}

const home = await (await get("/")).text();
assert.match(home, /Satellite \/ Earth imagery/, "map mode control should be rendered");
assert.match(home, /On the Way app updates/, "PWA update controls should be rendered");
const serviceWorker = await (await get("/sw.js")).text();
assert.match(serviceWorker, /SKIP_WAITING/, "service worker should support controlled update activation");
console.log("PASS embedded map controls and PWA update controls are present");
console.log("SMOKE_TESTS_PASSED");
