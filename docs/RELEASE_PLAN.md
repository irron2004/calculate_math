---
title: Calculate Math — Release Plan
owner: PM
status: draft
last_updated: 2025-11-04
---

# MVP Scope
- US-001..US-004 (Login, Deterministic Problems, Sessions, Skill Tree)

# Milestones
- M1: Backend endpoints + basic FE flows
- M2: Invite + Metrics
- M3: Hardening (OTEL, rate limits), QA gate

# Risks & Dependencies
- Content data freshness (skills/graph json)
- Browser cookie policies

# Exit Criteria
- QA gate pass (lint/format, unit_cov ≥ 0.7, core e2e 100%, high vulns 0)
- EXEC sign-off
