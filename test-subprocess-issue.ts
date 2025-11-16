#!/usr/bin/env ts-node

/**
 * Test script to reproduce the verify subprocess issue
 * Simulates what ship.ts does: active spinner + subprocess
 */

import { VerifyService } from './src/services/VerifyService';
import { spinner } from './src/utils/spinner';

async function testWithSpinner() {
  console.log('=== Testing VerifyService with active spinner (simulates gpm ship) ===\n');

  const verifyService = new VerifyService();

  // Start spinner (this is what ship.ts does on line 82)
  spinner.start('Running verification checks...');

  try {
    // Call runChecks with onProgress (this is what ship.ts does on line 84-86)
    const result = await verifyService.runChecks({
      onProgress: (msg) => spinner.update(msg)
    });

    if (result.success) {
      spinner.succeed(`Verification passed (${result.duration}ms)`);
      console.log('\n✅ SUCCESS: Verification completed without errors');
    } else {
      spinner.fail('Verification checks failed');
      console.log('\n❌ FAILURE: Verification errors:');
      result.errors.forEach(err => console.log(`  ${err}`));
    }

    console.log('\nResult:', {
      success: result.success,
      errorCount: result.errors.length,
      duration: result.duration
    });

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    spinner.fail('Unexpected error');
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

async function testWithoutSpinner() {
  console.log('=== Testing VerifyService without spinner (baseline) ===\n');

  const verifyService = new VerifyService();

  try {
    const result = await verifyService.runChecks();

    console.log('Result:', {
      success: result.success,
      errorCount: result.errors.length,
      duration: result.duration
    });

    if (!result.success) {
      console.log('\nErrors:');
      result.errors.forEach(err => console.log(`  ${err}`));
    }

    process.exit(result.success ? 0 : 1);
  } catch (error: any) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

// Run test based on argument
const testType = process.argv[2] || 'with-spinner';

if (testType === 'without-spinner') {
  testWithoutSpinner();
} else {
  testWithSpinner();
}
