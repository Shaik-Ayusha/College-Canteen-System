// Wait-time logic. Pure functions with no database access, so they are easy to test.
const KITCHEN_STAFF = Number(process.env.KITCHEN_STAFF) || 2; // cooks working in parallel

// Cooking minutes still needed for one order
function remainingMinutes(order, now = Date.now()) {
  const prep = Number(order.prep_minutes);
  if (order.status === 'PREPARING' && order.started_at) {
    const elapsed = (now - new Date(order.started_at).getTime()) / 60000;
    // Never below 1 minute: an order still on the stove is not finished yet
    return Math.max(1, prep - elapsed);
  }
  return prep; // not started yet: the full prep time is still ahead
}

// Total wait = queued work shared among cooks + this order's own remaining time
function estimateMinutes(queueAhead, ownRemaining, staff = KITCHEN_STAFF) {
  return Math.ceil(queueAhead / staff) + Math.ceil(ownRemaining);
}

module.exports = { remainingMinutes, estimateMinutes, KITCHEN_STAFF };
