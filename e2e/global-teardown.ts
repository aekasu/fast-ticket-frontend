import { AUTH } from "./global-setup";
import { sweepTestData } from "./sweep";

// After the run: remove anything a test created and did not clean up (a test that died midway).
export default async function globalTeardown() {
  await sweepTestData("http://localhost:3100", AUTH.admin);
}
