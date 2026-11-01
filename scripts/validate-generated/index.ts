import { validateGeneratedData, type ValidateOptions } from './validator';

export * from './validator';
export * from './pipeline-fixture';

// CLI entry point
if (process.argv[1] && (process.argv[1].endsWith('validate-generated/index.ts') || process.argv[1].endsWith('validate-generated\\index.ts'))) {
  const args = process.argv.slice(2);
  const options: ValidateOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--data-dir' || arg === '-d') {
      options.publicDataDir = args[++i];
    } else if (arg === '--reports-dir' || arg === '-r') {
      options.reportsDir = args[++i];
    } else if (arg === '--strict') {
      options.strict = true;
    }
  }

  validateGeneratedData(options)
    .then((report) => {
      console.log('🏁 Validation execution completed:');
      console.log(`   Overall Status: ${report.valid ? 'VALID (PASS)' : 'INVALID (FAIL)'}`);
      console.log(`   Checks Passed: ${report.passedChecks}/${report.totalChecks}`);
      console.log(`   Errors: ${report.errors.length}`);
      console.log(`   Warnings: ${report.warnings.length}`);
      if (!report.valid) {
        console.error('Validation errors:', report.errors);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('❌ Validation script encountered fatal exception:', err);
      process.exit(1);
    });
}
