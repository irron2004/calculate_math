# Review – Task 2025-12-02-1

## Key Findings
- Several Python and TypeScript modules (e.g., app/config.py, app/routers/skills.py, frontend/src/utils/api.ts) contain literal `diff --git` patches instead of runnable code, so the service cannot even import these modules. Revert the files to real source before validating functionality.
- Security hardening requested in the chain (bcrypt/argon2 login hashing, secure cookies, rate limiting) is still missing; `app/routers/practice.py` keeps the old SHA-256 logic and insecure session defaults.
- No backend or frontend tests were added to exercise the new seed/layout fallback paths, so regressions would ship silently.

## Recommendations
1. Restore each affected module from the intended patch output and add regression tests that cover missing data scenarios.
2. Complete the authentication hardening requirements and add smoke tests to ensure secure defaults.
3. When re-landing the frontend fallback, ensure analytics helpers actually exist in `frontend/src/utils/analytics.ts` and that the seed diagnostics surface is covered by Vitest.
