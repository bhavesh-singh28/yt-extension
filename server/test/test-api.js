/**
 * Comprehensive automated test script for YouTube Study Filter API
 */

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🧪 Starting YouTube Study Filter Backend Tests...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Health Check
    console.log('Test 1: Health check');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, `Health status code is 200 (got ${healthRes.status})`);
    const healthData = await healthRes.json();
    assert(healthData.status === 'ok', `Health status is "ok"`);
    console.log(`     Gemini configured: ${healthData.geminiConfigured}`);

    // 2. Single Classify - Educational
    console.log('\nTest 2: Single classify (Educational)');
    const singleEduRes = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'edu123',
        title: 'MIT 18.06 Linear Algebra, Spring 2005 - Lecture 1'
      })
    });
    assert(singleEduRes.status === 200, `Status code 200`);
    const singleEduData = await singleEduRes.json();
    assert(singleEduData.videoId === 'edu123', `Video ID matches`);
    assert(
      singleEduData.classification === 'EDUCATIONAL',
      `Classified as EDUCATIONAL (got ${singleEduData.classification})`
    );
    assert(typeof singleEduData.confidence === 'number', `Confidence is a number (${singleEduData.confidence})`);

    // 3. Single Classify - Non-educational
    console.log('\nTest 3: Single classify (Non-educational)');
    const singleNonEduRes = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'ent456',
        title: 'I Spent 24 Hours in a Box! (Extreme Challenge & Pranks)'
      })
    });
    assert(singleNonEduRes.status === 200, `Status code 200`);
    const singleNonEduData = await singleNonEduRes.json();
    assert(singleNonEduData.videoId === 'ent456', `Video ID matches`);
    assert(
      singleNonEduData.classification === 'NON_EDUCATIONAL',
      `Classified as NON_EDUCATIONAL (got ${singleNonEduData.classification})`
    );

    // 4. Batch Classify
    console.log('\nTest 4: Batch classify');
    const batchRes = await fetch(`${BASE_URL}/api/classify-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videos: [
          { videoId: 'batch1', title: 'Complete React JS Course for Beginners 2026' },
          { videoId: 'batch2', title: 'Celebrity Drama & Red Carpet Fails Compilation' },
          { videoId: 'batch3', title: 'Data Structures and Algorithms in Python - Full Course' },
          { videoId: 'batch4', title: 'Top 10 Funniest Animal Memes of the Week' }
        ]
      })
    });
    assert(batchRes.status === 200, `Status code 200`);
    const batchData = await batchRes.json();
    assert(Array.isArray(batchData.results), `Results is an array`);
    assert(batchData.results.length === 4, `Returned 4 results`);

    const b1 = batchData.results.find(r => r.videoId === 'batch1');
    const b2 = batchData.results.find(r => r.videoId === 'batch2');
    const b3 = batchData.results.find(r => r.videoId === 'batch3');
    const b4 = batchData.results.find(r => r.videoId === 'batch4');

    assert(b1?.classification === 'EDUCATIONAL', `batch1 classified as EDUCATIONAL (got ${b1?.classification})`);
    assert(b2?.classification === 'NON_EDUCATIONAL', `batch2 classified as NON_EDUCATIONAL (got ${b2?.classification})`);
    assert(b3?.classification === 'EDUCATIONAL', `batch3 classified as EDUCATIONAL (got ${b3?.classification})`);
    assert(b4?.classification === 'NON_EDUCATIONAL', `batch4 classified as NON_EDUCATIONAL (got ${b4?.classification})`);

    // 5. Validation Error Handling
    console.log('\nTest 5: Validation error handling');
    const badRes = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ videoId: '' })
    });
    assert(badRes.status === 400, `Rejects empty fields with 400 (got ${badRes.status})`);

    console.log(`\n---------------------------------------------`);
    console.log(`Test Summary: ${passed} passed, ${failed} failed`);
    console.log(`---------------------------------------------\n`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err.message);
    process.exit(1);
  }
}

runTests();
