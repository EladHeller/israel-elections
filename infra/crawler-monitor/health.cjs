// Persisted hysteresis survives Lambda cold starts and deployment updates.
function evaluate(previous, success, now) {
  const state = { incident: false, bad: 0, good: 0, ...previous };
  // EventBridge retries/duplicates cannot advance the counters twice in a minute.
  if (state.checkedAt && now - state.checkedAt < 55_000) return state;
  const timestamp = Date.parse(success?.finishedAt);
  const fresh = success?.status === 'success' && Number.isFinite(timestamp) && timestamp <= now && now - timestamp <= 60 * 60_000;
  state.checkedAt = now;
  if (!fresh) {
    state.bad++;
    state.good = 0;
    if (state.bad >= 2) state.incident = true;
  } else {
    state.bad = 0;
    if (timestamp !== state.lastSuccess) state.good++;
    state.lastSuccess = timestamp;
    if (state.good >= 3) state.incident = false;
  }
  return state;
}
module.exports = { evaluate };
