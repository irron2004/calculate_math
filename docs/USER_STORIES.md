---
title: Calculate Math — User Stories
owner: PM
status: draft
last_updated: 2025-11-04
---

# Stories (MoSCoW)

## Must
- US-001 Login/Signup by nickname
  - Given nickname+pw, when POST /api/v1/login, then create-or-login and set cookie.
- US-002 Generate deterministic problems
  - Given op/digits/seed, when GET /api/problems/generate, then stable ids/questions.
- US-003 20-problem session for game
  - Given auth, when POST /api/v1/sessions, then return 20 items and session_id.
- US-004 Skill tree overview
  - When GET /api/v1/skills/tree, then show unlocked and progress snapshot if available.

## Should
- US-005 Progress metrics endpoint (/api/v1/metrics/me)
- US-006 Invite flow (create/get/expire and /share/{token})

## Could
- US-007 LRC evaluation helper and last-eval fetch
