# Three-minute demo plan — BLOCKED

This is a proposed walkthrough, **not a verified runnable demo**. API typecheck fails because a media route module is missing, and the Docker engine was unavailable during the audit. See [CI audit](CI_AUDIT.md). Do not present this as a recording of a working facility or as a production system.

## Preparation required before recording

Recover the missing module with its security contract, pass API typecheck, and validate an isolated local MySQL/Redis setup with explicit demo-only credentials and fixtures. Use an isolated database and queue; avoid real customer data, images, plate numbers, device secrets, external webhooks and production endpoints. Verify seed lifecycle, entry/exit lanes, cleanup, and the actual UI before filming. The historical [golden path](../PARKLY_GOLDEN_PATH.md) contains unverified commands and expected outcomes; it is not an acceptance transcript.

## Intended sequence after unblocking

1. Label the screen **DEMO — SYNTHETIC DATA**. Show a manually supplied fictional capture and the resulting session, if the restored local flow supports it. No camera is connected and any OCR confidence is simulated.
2. Present a low-confidence input for manual review; verify the actual review state and action before claiming it occurred.
3. Show a synthetic exit and inspect the session history and outbox status. Report only observed states; no external delivery or physical barrier action is assumed.

After recording, stop only the demo's own services and remove only its isolated fixtures and credentials using a validated cleanup procedure. Do not run reset or volume-deletion commands against an existing environment.
