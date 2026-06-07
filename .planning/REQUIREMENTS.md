# Requirements

## v1 Requirements

### Health Check

- [x] **HLT-01**: Load balancer can `GET /api/health` and receive HTTP 200 with body `{"status":"ok","uptime":<seconds>}`
- [x] **HLT-02**: `uptime` is a non-negative integer representing seconds elapsed since the Next.js server process started

## v2 Requirements

(None identified)

## Out of Scope

- `/health` root-level path — Next.js routes live under `/api/`; a `next.config.ts` rewrite is available if needed but not required for load-balancer use
- Detailed health sub-checks (DB connectivity, Supabase ping) — not required for MVP load-balancer probe

## Traceability

| REQ-ID | Phase |
|--------|-------|
| HLT-01 | Phase 1: Health Endpoint |
| HLT-02 | Phase 1: Health Endpoint |
