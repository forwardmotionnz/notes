// Runner fixture: a suite with a failing check.
console.log(`bad [${process.env.NOTES_TEST_ENGINE}]: 0/1 passed`);
process.exitCode = 1;
