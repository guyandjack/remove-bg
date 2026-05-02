import process from "node:process";

type TestCase = { name: string; fn: () => void | Promise<void> };
const tests: TestCase[] = [];

export function test(name: string, fn: TestCase["fn"]) {
  tests.push({ name, fn });
}

async function main() {
  // Register test files
  await import("./access.test.ts");

  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      // eslint-disable-next-line no-console
      console.log(`ok - ${t.name}`);
    } catch (err: any) {
      failed += 1;
      // eslint-disable-next-line no-console
      console.error(`not ok - ${t.name}:`, err?.message || String(err));
    }
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
