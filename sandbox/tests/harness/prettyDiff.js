// sandbox/tests/harness/prettyDiff.js
// Pretty diff + summary for PD Scenario tests

import chalk from "chalk";

// Stores results during scenario execution
const results = [];

export function recordExpectation({ stepIndex, expected, actual }) {
  const pass = expected === actual;
  results.push({ stepIndex, expected, actual, pass });

  if (pass) {
    console.log(
      chalk.green(`✔ Step ${stepIndex} PASSED - Move = ${expected}`)
    );
  } else {
    console.log(chalk.red(`✘ Step ${stepIndex} FAILED`));
    console.log(chalk.yellow(`   Expected: ${expected}`));
    console.log(chalk.cyan(`   Actual:   ${actual}`));
  }
}

export function printSummary() {
  console.log("\n==============================================");
  console.log("              TEST SUMMARY");
  console.log("==============================================");

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  console.log(chalk.green(`✔ Passed: ${passed}`));
  console.log(chalk.red(`✘ Failed: ${failed}`));
  console.log(chalk.white(`Total: ${results.length}`));

  if (failed > 0) {
    console.log("\nFailed steps:");
    for (const r of results.filter(r => !r.pass)) {
      console.log(
        chalk.red(
          ` - Step ${r.stepIndex}: expected ${r.expected}, got ${r.actual}`
        )
      );
    }
  }

  console.log("==============================================\n");

  // Reset for next run
  results.length = 0;
}
