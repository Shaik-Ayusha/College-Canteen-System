// Checks the wait-time formula. Run with: node scripts/test-wait.js
const assert = require('assert');
const { remainingMinutes, estimateMinutes } = require('../src/services/wait');

const minutesAgo = (m, now) => new Date(now - m * 60000);
const now = Date.now();

// Placed orders count their full prep time
assert.strictEqual(remainingMinutes({ status: 'PLACED', prep_minutes: 10 }, now), 10);

// Cooking order: 8 of 10 minutes already spent, 2 left
assert.strictEqual(remainingMinutes({ status: 'PREPARING', prep_minutes: 10, started_at: minutesAgo(8, now) }, now), 2);

// Overdue cooking order never drops below 1 minute
assert.strictEqual(remainingMinutes({ status: 'PREPARING', prep_minutes: 10, started_at: minutesAgo(15, now) }, now), 1);

// Ready orders are not in the queue (the caller filters them out)
// Two cooks: queue of 30 min shared = 15, plus own 11 min = 26
assert.strictEqual(estimateMinutes(30, 11, 2), 26);

// Empty kitchen: only the order's own time
assert.strictEqual(estimateMinutes(0, 11, 2), 11);

// Estimate falls as cooking progresses: queue 10 min of PLACED work,
// the order ahead has 2 min left instead of 10. Queue goes 10 -> 2 after cooking.
const before = estimateMinutes(10, 5, 2);
const after = estimateMinutes(2, 5, 2);
assert.ok(after < before, 'estimate must fall while cooking');
console.log(`Queue 10 min -> estimate ${before} min; queue 2 min -> estimate ${after} min`);

console.log('All wait-time tests passed');
