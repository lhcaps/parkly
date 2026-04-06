# Grafana Dashboard Templates

Pre-configured dashboard JSON files for importing into Grafana.
Connect these to your Prometheus data source.

## Available Dashboards

| Dashboard | File | Description |
|-----------|------|-------------|
| **Operations** | `operations.json` | sessions/min, decision distribution, barrier response time, review queue size |
| **Infrastructure** | `infrastructure.json` | DB connections, Redis memory/latency, queue backlog, SSE connections |
| **Business** | `business.json` | occupancy %, revenue/hour, subscription utilization, tariff calculation latency |

## Import Instructions

1. Open Grafana → Dashboards → Import
2. Upload the JSON file or paste its contents
3. Select your Prometheus data source
4. Save

## Key Metrics Referenced

### Operations Dashboard
- `gate_session_open_duration_ms` — Session open latency
- `gate_session_resolve_duration_ms` — Session resolve latency
- `parkly_decision_engine_outcomes_total` — Decision distribution by code
- `gate_review_queue_size` — Review queue depth
- `gate_barrier_ack_timeout_total` — Barrier ACK failures
- `parkly_lane_lock_wait_time_ms` — Lane lock contention

### Infrastructure Dashboard
- `redis_up` — Redis availability
- `redis_latency_ms` — Redis command latency
- `redis_command_failures_total` — Redis failures
- `gate_outbox_backlog_size` — Outbox queue depth
- `parkly_active_sse_connections` — SSE connection count
- `http_request_duration_ms` — HTTP latency distribution
- `gate_device_offline_count` — Offline devices

### Business Dashboard
- `parkly_tariff_calculation_duration_ms` — Tariff engine performance
- `parkly_operational_requests_total` — Request volume by surface
- `parkly_incident_lifecycle_total` — Incident volume
- `parkly_retention_cleanup_deleted_rows_total` — Data hygiene

## Alert Rules

### Critical
- `gate_device_offline_count > 0` for > 5 min → **Device offline**
- `gate_outbox_backlog_size > 100` → **Outbox backlog spike**
- `rate(parkly_operational_requests_total{outcome="ERROR"}[5m]) / rate(parkly_operational_requests_total[5m]) > 0.05` → **Error rate > 5%**

### Warning
- `parkly_active_sse_connections > 50` → **High SSE connections**
- `redis_up == 0` for > 30s → **Redis down**
- `gate_review_queue_size > 20` → **Review queue growing**
