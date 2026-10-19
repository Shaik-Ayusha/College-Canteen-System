const MENU_EDIT_CUTOFF = '11:00';
const ORDERING_CUTOFF = '12:00';
const SERVICE_START = '12:00';
const FRESH_ORDERING_END = '13:40';
const SERVICE_END = '14:00';

function timeToMinutes(time) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function scheduleFor(currentTime) {
  const now = timeToMinutes(currentTime);
  return {
    current_time: currentTime,
    menu_edit_open: now !== null && now < timeToMinutes(MENU_EDIT_CUTOFF),
    ordering_open: now !== null && now < timeToMinutes(SERVICE_END),
    service_ordering: now !== null &&
      now >= timeToMinutes(SERVICE_START) &&
      now < timeToMinutes(SERVICE_END),
    fresh_ordering_open: now !== null &&
      now >= timeToMinutes(SERVICE_START) &&
      now < timeToMinutes(FRESH_ORDERING_END),
    ordering_cutoff: ORDERING_CUTOFF,
    fresh_ordering_end: FRESH_ORDERING_END,
    service_start: SERVICE_START,
    service_end: SERVICE_END,
    menu_edit_cutoff: MENU_EDIT_CUTOFF,
  };
}

function canFinishBeforeServiceEnds(currentTime, estimatedMinutes) {
  const now = timeToMinutes(currentTime);
  return now !== null &&
    now < timeToMinutes(SERVICE_END) &&
    now + Math.max(0, Number(estimatedMinutes) || 0) <= timeToMinutes(SERVICE_END);
}

function shouldAutoReadyPreparedOrder(currentTime, fullyPrepared) {
  const now = timeToMinutes(currentTime);
  return Boolean(fullyPrepared) && now !== null && now >= timeToMinutes(SERVICE_START);
}

module.exports = {
  MENU_EDIT_CUTOFF,
  ORDERING_CUTOFF,
  SERVICE_START,
  FRESH_ORDERING_END,
  SERVICE_END,
  timeToMinutes,
  scheduleFor,
  canFinishBeforeServiceEnds,
  shouldAutoReadyPreparedOrder,
};
