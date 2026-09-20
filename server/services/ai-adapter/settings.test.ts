/**
 * AI services settings tests
 *
 * Run with: npx tsx server/services/ai-adapter/settings.test.ts
 *
 * Hand-run script in the budget-allocation.test.ts shape — this repository
 * has no test runner configured (no vitest/jest). Each named test prints
 * a PASS/FAIL line and the script exits non-zero if any test fails.
 */

import { getAiServicesSettings } from "../../config/ai-services.js";
import { isAiServicesEnabled } from "./index.js";

let failures = 0;

function pass(name: string, detail?: string) {
  console.log(`PASS: ${name}${detail ? ` (${detail})` : ""}`);
}

function fail(name: string, detail: string) {
  failures += 1;
  console.error(`FAIL: ${name} — ${detail}`);
}

function clearAiServicesEnv() {
  delete process.env.CURALINA_AI_SERVICES_ENABLED;
  delete process.env.CURALINA_RECOMMENDATION_URL;
  delete process.env.CURALINA_VARIANTS_URL;
  delete process.env.CURALINA_ROOMS_URL;
  delete process.env.CURALINA_AI_CONTRACT_VERSION;
}

// Test 1: Default-off
{
  clearAiServicesEnv();
  const settings = getAiServicesSettings();
  if (settings.enabled === false) {
    pass("1. Default-off", "enabled === false with no CURALINA_* env vars set");
  } else {
    fail("1. Default-off", `expected enabled === false, got ${settings.enabled}`);
  }
}

// Test 2: Explicit true
{
  clearAiServicesEnv();
  process.env.CURALINA_AI_SERVICES_ENABLED = "true";
  const settings = getAiServicesSettings();
  if (settings.enabled === true) {
    pass("2. Explicit true", 'CURALINA_AI_SERVICES_ENABLED="true" => enabled === true');
  } else {
    fail("2. Explicit true", `expected enabled === true, got ${settings.enabled}`);
  }
}

// Test 3: Explicit false, case-insensitive
{
  clearAiServicesEnv();
  process.env.CURALINA_AI_SERVICES_ENABLED = "False";
  const settings = getAiServicesSettings();
  if (settings.enabled === false) {
    pass("3. Explicit false, case-insensitive", 'CURALINA_AI_SERVICES_ENABLED="False" => enabled === false');
  } else {
    fail("3. Explicit false, case-insensitive", `expected enabled === false, got ${settings.enabled}`);
  }
}

// Test 4: Invalid value rejected
{
  clearAiServicesEnv();
  process.env.CURALINA_AI_SERVICES_ENABLED = "yes";
  try {
    getAiServicesSettings();
    fail("4. Invalid value rejected", 'expected getAiServicesSettings() to throw for "yes", it did not throw');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("yes")) {
      pass("4. Invalid value rejected", `threw with message containing "yes": ${message}`);
    } else {
      fail("4. Invalid value rejected", `threw but message did not contain "yes": ${message}`);
    }
  }
}

// Test 5: URL defaults
{
  clearAiServicesEnv();
  const settings = getAiServicesSettings();
  const checks: Array<[string, string, string]> = [
    ["recommendationUrl", settings.recommendationUrl, "http://127.0.0.1:8101"],
    ["variantsUrl", settings.variantsUrl, "http://127.0.0.1:8102"],
    ["roomsUrl", settings.roomsUrl, "http://127.0.0.1:8103"],
  ];
  const mismatches = checks.filter(([, actual, expected]) => actual !== expected);
  if (mismatches.length === 0) {
    pass(
      "5. URL defaults",
      `recommendationUrl=${settings.recommendationUrl}, variantsUrl=${settings.variantsUrl}, roomsUrl=${settings.roomsUrl}`
    );
  } else {
    fail(
      "5. URL defaults",
      mismatches.map(([name, actual, expected]) => `${name}: expected ${expected}, got ${actual}`).join("; ")
    );
  }
}

// Test 6: URL override
{
  clearAiServicesEnv();
  process.env.CURALINA_RECOMMENDATION_URL = "http://example.test:9999";
  const settings = getAiServicesSettings();
  if (
    settings.recommendationUrl === "http://example.test:9999" &&
    settings.variantsUrl === "http://127.0.0.1:8102" &&
    settings.roomsUrl === "http://127.0.0.1:8103"
  ) {
    pass("6. URL override", "recommendationUrl overridden, variantsUrl/roomsUrl unchanged");
  } else {
    fail(
      "6. URL override",
      `recommendationUrl=${settings.recommendationUrl}, variantsUrl=${settings.variantsUrl}, roomsUrl=${settings.roomsUrl}`
    );
  }
}

// Test 7: Contract version default
{
  clearAiServicesEnv();
  const settings = getAiServicesSettings();
  if (settings.contractVersion === "1.0") {
    pass("7. Contract version default", 'contractVersion === "1.0"');
  } else {
    fail("7. Contract version default", `expected "1.0", got "${settings.contractVersion}"`);
  }
}

// Test 8: isAiServicesEnabled() reflects settings
{
  clearAiServicesEnv();
  // Fresh-read mechanism: getAiServicesSettings() (and, by extension,
  // isAiServicesEnabled(), which calls it internally) builds a new
  // settings object from process.env on every call — nothing is cached
  // at module scope — so toggling the env var between calls is
  // observable within a single process.
  process.env.CURALINA_AI_SERVICES_ENABLED = "false";
  const before = isAiServicesEnabled();
  process.env.CURALINA_AI_SERVICES_ENABLED = "true";
  const after = isAiServicesEnabled();
  if (before === false && after === true) {
    pass(
      "8. isAiServicesEnabled() reflects settings",
      `before=${before}, after=${after} (fresh read via getAiServicesSettings(), no module-level caching)`
    );
  } else {
    fail("8. isAiServicesEnabled() reflects settings", `expected before=false, after=true, got before=${before}, after=${after}`);
  }
}

clearAiServicesEnv();

console.log("");
if (failures === 0) {
  console.log("ALL 8 NAMED TESTS PASSED");
  process.exit(0);
} else {
  console.error(`${failures} TEST(S) FAILED`);
  process.exit(1);
}
