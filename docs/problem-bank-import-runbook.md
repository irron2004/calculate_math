# Problem Bank Import Runbook

This runbook documents a repeatable, production-safe process for importing daily homework JSON files into the Problem Bank.

## 1) Safety order (required)

- Recommended order: **staging first**, then production.
- If staging is unavailable: run **local first**, then production.
- Never import to production first.

## 2) Prerequisites

- Admin account credentials for target environment.
- JSON files named `homework_YYYY-MM-DD.json`.
- Each JSON file must include top-level keys: `title`, `description`, `problems`.
- Python environment with `requests` installed.

Required env vars (do not commit these values):

```bash
export API_BASE_URL="https://<target-host>"
export ADMIN_USERNAME="admin"
export ADMIN_PASSWORD="<admin-password>"
```

Notes:
- Script normalizes `API_BASE_URL` to `<base>/api` automatically.
- `ADMIN_PASSWORD` can be omitted from env and entered interactively.

## 3) UI import flow (AuthorHomeworkPage)

Use this for one-off/manual imports.

1. Open author page and switch to `문제은행` (problem bank mode).
2. In the `문제은행 Import` panel:
   - Enter `weekKey` (example: `2026-W11`).
   - Select `day` (`mon`..`sat`).
   - Paste day JSON into the textarea (`title/description/problems`).
3. Click `Import`.
4. Confirm success toast: `문제은행에 import 완료. 목록을 새로고침했습니다.`
5. Verify by filtering list with same `weekKey` and `day`, or use API verification in section 5.

## 4) Script import flow (repeatable / batch)

Use this for multi-day imports.

### 4.1 Dry-run first (no network writes)

```bash
python scripts/import_problem_bank_from_files.py --dry-run \
  homework_2026-03-09.json \
  homework_2026-03-10.json \
  homework_2026-03-11.json \
  homework_2026-03-12.json \
  homework_2026-03-13.json \
  homework_2026-03-14.json
```

Expected dry-run result:
- Per file: derived `weekKey`, `dayKey`, `problemCount`.
- `result` column shows `dry-run`.

### 4.2 Real import

```bash
python scripts/import_problem_bank_from_files.py \
  homework_2026-03-09.json \
  homework_2026-03-10.json \
  homework_2026-03-11.json \
  homework_2026-03-12.json \
  homework_2026-03-13.json \
  homework_2026-03-14.json
```

Expected import result:
- `result=ok` per file.
- Response columns include `batch`, `created`, `skipped`.

## 5) Verification API (must run)

Verify with admin token after import.

1) Get token:

```bash
TOKEN=$(curl -sS -X POST "$API_BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}" \
  | python -c 'import json,sys; print(json.load(sys.stdin)["accessToken"])')
```

2) Check day count:

```bash
curl -sS "$API_BASE_URL/api/homework/admin/problem-bank/problems?weekKey=2026-W11&dayKey=mon&limit=200&offset=0" \
  -H "Authorization: Bearer $TOKEN"
```

Use the same endpoint format for each day:

`/api/homework/admin/problem-bank/problems?weekKey=...&dayKey=...`

Pass criteria:
- Returned list count matches expected imported problems for that day (for this batch: 10/day).

## 6) Idempotency behavior

- Import is idempotent for identical payload content.
- Re-running the same file should not create duplicates.
- In script output, repeated run should show `created=0` and `skipped=<problemCount>`.

## 7) Secrets policy

- Never commit credentials, tokens, or `.env` secrets.
- Do not paste tokens/passwords into PRs, issue comments, or evidence files.
- Prefer environment variables or interactive prompt for `ADMIN_PASSWORD`.
- Rotate admin password immediately if exposed.

## 8) Minimal execution checklist

- Dry-run completed successfully.
- Real import completed with `result=ok`.
- Verification endpoint checked for each target day.
- Re-run one file to confirm idempotency (`created=0`, `skipped>0`).
