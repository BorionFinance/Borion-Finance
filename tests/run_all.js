'use strict';

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const testsDir = __dirname;
const tests = fs.readdirSync(testsDir)
  .filter(name => /^test_.*\.js$/.test(name))
  .sort();

let passed = 0;
for (const test of tests) {
  process.stdout.write(`\n=== ${test} ===\n`);
  const result = spawnSync(process.execPath, [path.join(testsDir, test)], {
    cwd: path.resolve(testsDir, '..'),
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    console.error(`\nFALHOU: ${test}`);
    process.exit(result.status || 1);
  }
  passed += 1;
}

console.log(`\nOK: ${passed}/${tests.length} arquivos de teste passaram.`);
