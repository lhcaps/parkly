# Ten-minute technical walkthrough — BLOCKED

Start with the [three-minute plan](DEMO_3MIN.md) and its prerequisites. The full flow is not currently runnable or verified, and no screenshots or video were captured.

Once the environment is repaired and independently tested:

1. Show the synthetic entry and review sequence. Explain the [capture route](../../apps/api/src/modules/gate/interfaces/http/register-gate-capture-routes.ts), signature verification and replay handling; avoid showing credentials.
2. Explain the [Redis lease](../../apps/api/src/lib/lane-lock.ts), including expiration and ownership-checked release, without calling it Redlock or implying guaranteed behavior under failover.
3. Walk through session state and manual review; compare the result to the observed state, not a scripted promise.
4. Inspect the event/outbox transaction and worker retry paths in [architecture](ARCHITECTURE.md). Show actual local status only; a pending record is not proof of downstream delivery.
5. Show the [CI audit](CI_AUDIT.md), distinguish local tests from hosted CI, and disclose remaining blockers. Teardown is limited to validated isolated demo resources.

The focused decision and signature tests recorded in the [case study](CASE_STUDY.md) can be demonstrated separately, but they are not an end-to-end demo or evidence of a real camera or ALPR deployment.
