import { SmoothStreamBuffer } from '../src/utils/nlp/streamBuffer';

async function testStreamBuffer() {
  console.log('=== TEST SMOOTH STREAM BUFFER ===');

  // Test 1: Basic streaming with finish
  let collectedText = '';
  let tokenCount = 0;

  const buffer = new SmoothStreamBuffer((chunk, currentFull) => {
    tokenCount++;
    collectedText = currentFull;
  });

  buffer.push('Paracetamol ');
  buffer.push('500mg ');
  buffer.push('uống sau ăn.');

  await buffer.finish();

  if (collectedText !== 'Paracetamol 500mg uống sau ăn.') {
    throw new Error(`Test 1 Failed: Expected full text, got "${collectedText}"`);
  }
  if (tokenCount < 3) {
    throw new Error(`Test 1 Failed: Expected multiple smooth ticks, got ${tokenCount}`);
  }
  console.log(`✅ Test 1 Passed: Text streamed smoothly across ${tokenCount} ticks! Result: "${collectedText}"`);

  // Test 2: Large burst drain
  const longText = 'A'.repeat(300);
  let longResult = '';
  let longTicks = 0;

  const buffer2 = new SmoothStreamBuffer((_chunk, currentFull) => {
    longTicks++;
    longResult = currentFull;
  });

  buffer2.push(longText);
  await buffer2.finish();

  if (longResult !== longText) {
    throw new Error(`Test 2 Failed: Expected 300 A's, got ${longResult.length}`);
  }
  console.log(`✅ Test 2 Passed: 300-char burst drained smoothly in ${longTicks} ticks!`);

  // Test 3: Empty push and immediate finish
  let emptyResult = '';
  const buffer3 = new SmoothStreamBuffer((_chunk, currentFull) => {
    emptyResult = currentFull;
  });
  buffer3.push('');
  await buffer3.finish();
  if (emptyResult !== '') {
    throw new Error(`Test 3 Failed: Expected empty string, got "${emptyResult}"`);
  }
  console.log('✅ Test 3 Passed: Empty push handled safely.');

  console.log('🎉 ALL SMOOTH STREAM BUFFER TESTS PASSED 100%!');
}

testStreamBuffer().catch(err => {
  console.error(err);
  process.exit(1);
});
