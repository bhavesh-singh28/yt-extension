/**
 * Automated test script for YouTube Study Filter API
 */

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
  console.log('🧪 Starting Tests (Binary Classification)...\n');
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
    // 1. Health
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    assert(healthRes.status === 200, `Health code 200`);

    // 2. Single Classify - Educational
    const singleEduRes = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'edu1',
        title: 'MIT 18.06 Linear Algebra - Lecture 1'
      })
    });
    const singleEduData = await singleEduRes.json();
    assert(singleEduData.isEducational === true, `Linear Algebra -> isEducational: true`);

    // 3. Single Classify - Non-educational
    const singleNonEduRes = await fetch(`${BASE_URL}/api/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId: 'ent1',
        title: 'I Spent 24 Hours in a Box! (Extreme Challenge & Pranks)'
      })
    });
    const singleNonEduData = await singleNonEduRes.json();
    assert(singleNonEduData.isEducational === false, `Pranks -> isEducational: false`);

    // 4. Batch Classify
    const batchRes = await fetch(`${BASE_URL}/api/classify-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videos: [
          { videoId: 'b1', title: 'Complete React JS Course for Beginners' },
          { videoId: 'b2', title: 'Celebrity Drama & Red Carpet Fails' }
        ]
      })
    });
    const batchData = await batchRes.json();
    assert(Array.isArray(batchData.results), `Results is array`);
    const b1 = batchData.results.find(r => r.videoId === 'b1');
    const b2 = batchData.results.find(r => r.videoId === 'b2');
    assert(b1?.isEducational === true, `React Course -> isEducational: true`);
    assert(b2?.isEducational === false, `Celebrity Drama -> isEducational: false`);

    console.log(`\nAll tests passed: ${passed}/${passed + failed}`);
  } catch (err) {
    console.error('Test error:', err.message);
    process.exit(1);
  }
}

runTests();
