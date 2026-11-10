# Rankings Data

Rankings count input and output tokens from consumption logs. They do not
register statistics in the relay request path.

The legacy `quota_data` table remains the source for history before its final
hour. A dedicated background updater rebuilds that last, potentially partial
hour and the subsequent hours from `LOG_DB`, one hour at a time. Historical
rankings remain available until this initial catch-up finishes.

The new `ranking_token_hours` table stores one token total per model and hour.
After catch-up, the updater refreshes the current and preceding hour every five
minutes. Replacing an hour also captures late commits without adding totals
twice. Each publication and its checkpoint commit atomically. The updater locks
only its own `ranking_snapshot_states` row; relay logging does not use that row.
It uses a 15-second background-operation deadline and leaves the previous result
intact on failure. No new indexes are built on `logs`.

Responses combine preserved history with the new hourly totals. Same-period
refreshes share one calculation. Cached responses remain available while an
expired result refreshes in the background. Visible ranking pages check for new
results once per minute. This cache does not change authentication or ranking
visibility permissions.
