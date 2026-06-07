# Roadmap

**1 phase** | **2 requirements mapped** | All v1 requirements covered ✓

## Summary

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 1 | Health Endpoint | GET /api/health returns status + uptime JSON for load-balancer probes | HLT-01, HLT-02 | 2 |

---

### Phase 1: Health Endpoint

**Goal:** Expose `GET /api/health` returning `{"status":"ok","uptime":<seconds>}` for load-balancer health checks.
**Mode:** mvp
**Requirements:** HLT-01, HLT-02
**Status:** ✓ Complete

**Success Criteria:**
1. `GET /api/health` responds with HTTP 200 and `Content-Type: application/json`
2. Response body matches `{"status":"ok","uptime":<non-negative integer>}`

**Implementation:** `app/api/health/route.ts` — Next.js Route Handler, module-level `startTime = Date.now()` for uptime calculation.
