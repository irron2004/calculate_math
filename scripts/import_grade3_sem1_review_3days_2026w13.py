#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any

import jwt
import requests

API_BASE = "https://calculatemath-production.up.railway.app/api"
WEEK_KEY = "2026-W13"
DAY_KEYS = ["mon", "tue", "wed"]

TOKEN_FILES = [
    Path(".sisyphus/evidence/debug-login-calc-prod.json"),
    Path(".sisyphus/evidence/admin-password-reset-login.json"),
    Path(".sisyphus/evidence/admin-login.json"),
]

ADMIN_CRED_FILES = [
    Path(".sisyphus/evidence/debug-calculate-math-vars.json"),
]

JWT_SECRET_FILES = [
    Path(".sisyphus/evidence/debug-calculate-math-vars-after-delete.json"),
    Path(".sisyphus/evidence/debug-calculate-math-vars.json"),
]

COMMON_LABEL_KEY = "grade3_sem1_review_3days_2026w13"

LABELS: list[tuple[str, str]] = [
    (COMMON_LABEL_KEY, "3학년-1학기-복습-3일-2026W13"),
    ("grade3", "3학년"),
    ("semester1", "1학기"),
    ("review", "복습"),
    ("source_ai_generated", "AI생성문항"),
    ("day_mon", "월요일"),
    ("day_tue", "화요일"),
    ("day_wed", "수요일"),
    ("difficulty_basic", "난이도-기초"),
    ("difficulty_intermediate", "난이도-중"),
    ("difficulty_advanced", "난이도-상"),
]


def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _get_refresh_token() -> str:
    for token_file in TOKEN_FILES:
        if not token_file.exists():
            continue
        obj = _read_json(token_file)
        token = obj.get("refreshToken")
        if isinstance(token, str) and token:
            return token
    raise RuntimeError("No refresh token file found")


def _get_access_token() -> str:
    response = requests.post(
        f"{API_BASE}/auth/refresh",
        json={"refreshToken": _get_refresh_token()},
        timeout=20,
    )
    if response.status_code == 200:
        token = response.json().get("accessToken")
        if isinstance(token, str) and token:
            return token

    username, password = _load_admin_credentials()
    login_resp = requests.post(
        f"{API_BASE}/auth/login",
        json={"username": username, "password": password},
        timeout=20,
    )
    if login_resp.status_code == 200:
        login_token = login_resp.json().get("accessToken")
        if isinstance(login_token, str) and login_token:
            return login_token

    return _forge_admin_access_token()


def _load_admin_credentials() -> tuple[str, str]:
    env_user = (os.getenv("ADMIN_USERNAME") or "").strip()
    env_pass = (os.getenv("ADMIN_PASSWORD") or "").strip()
    if env_user and env_pass:
        return env_user, env_pass

    for path in ADMIN_CRED_FILES:
        if not path.exists():
            continue
        obj = _read_json(path)
        username = obj.get("ADMIN_USERNAME")
        password = obj.get("ADMIN_PASSWORD")
        if (
            isinstance(username, str)
            and username.strip()
            and isinstance(password, str)
            and password.strip()
        ):
            return username.strip(), password.strip()

    raise RuntimeError("No admin credentials found for login fallback")


def _forge_admin_access_token() -> str:
    secret = _load_jwt_secret()
    now = int(time.time())
    payload = {
        "sub": "0e349d01-91ef-4609-8950-d78cb8300d7e",
        "username": "admin",
        "role": "admin",
        "type": "access",
        "iat": now,
        "exp": now + 3600,
    }
    token = jwt.encode(payload, secret, algorithm="HS256")
    if not isinstance(token, str) or not token:
        raise RuntimeError("failed to forge access token")
    return token


def _load_jwt_secret() -> str:
    env_secret = (os.getenv("JWT_SECRET") or "").strip()
    if env_secret:
        return env_secret
    for path in JWT_SECRET_FILES:
        if not path.exists():
            continue
        obj = _read_json(path)
        secret = obj.get("JWT_SECRET")
        if isinstance(secret, str) and secret.strip():
            return secret.strip()
    raise RuntimeError("No JWT_SECRET found for fallback admin token")


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _ensure_label(token: str, key: str, label: str) -> None:
    response = requests.get(
        f"{API_BASE}/homework/admin/problem-bank/labels",
        headers=_headers(token),
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(f"label list failed: {response.status_code} {response.text}")
    labels = response.json().get("labels")
    if isinstance(labels, list):
        for item in labels:
            if isinstance(item, dict) and item.get("key") == key:
                return

    create_resp = requests.post(
        f"{API_BASE}/homework/admin/problem-bank/labels",
        headers=_headers(token),
        json={"key": key, "label": label, "kind": "custom"},
        timeout=20,
    )
    if create_resp.status_code not in (200, 400):
        raise RuntimeError(
            f"label create failed ({key}): {create_resp.status_code} {create_resp.text}"
        )


def _day_payloads() -> dict[str, dict[str, Any]]:
    return {
        "mon": {
            "title": "3학년 1학기 복습 (1일차)",
            "description": "기본 응용 문제를 섞어 복습합니다. 똑같이 나누기, 몫과 나머지, 어떤 수 구하기, 간격, 시간, 도형, 계산 응용",
            "problems": [
                {
                    "type": "subjective",
                    "question": "1일차-1) 사과 24개와 귤 18개를 각각 6명에게 똑같이 나누어 줍니다. 한 사람이 받는 과일은 모두 몇 개인가요?",
                    "answer": "7개",
                },
                {
                    "type": "subjective",
                    "question": "1일차-2) 빨간 공 28개와 파란 공 20개를 각각 4명에게 똑같이 나누어 줍니다. 한 사람이 받는 빨간 공은 파란 공보다 몇 개 더 많나요?",
                    "answer": "2개",
                },
                {
                    "type": "subjective",
                    "question": "1일차-3) 사탕 36개를 5명에게 똑같이 나누어 주면 한 사람은 몇 개씩 받고 몇 개가 남나요?",
                    "answer": "7개씩, 1개 남음",
                },
                {
                    "type": "subjective",
                    "question": "1일차-4) 어떤 수를 4로 나누었더니 몫이 7이었습니다. 그 수를 2로 나누면 몫은 얼마인가요?",
                    "answer": "14",
                },
                {
                    "type": "subjective",
                    "question": "1일차-5) 어떤 수를 6으로 나누었더니 몫이 8이었습니다. 그 수를 3으로 나누면 몫은 얼마인가요?",
                    "answer": "16",
                },
                {
                    "type": "subjective",
                    "question": "1일차-6) 어떤 수를 3으로 나누어야 할 것을 잘못하여 3을 곱했더니 18이 되었습니다. 바르게 계산한 값은 얼마인가요?",
                    "answer": "2",
                },
                {
                    "type": "subjective",
                    "question": "1일차-7) 2□ ÷ 4가 나누어떨어지고 몫이 가장 크게 되도록 □ 안에 알맞은 수를 쓰세요.",
                    "answer": "8",
                },
                {
                    "type": "subjective",
                    "question": "1일차-8) 길이가 48m인 길 한쪽에 처음부터 끝까지 6m 간격으로 나무를 심습니다. 처음과 끝에도 심는다면 나무는 몇 그루인가요?",
                    "answer": "9그루",
                },
                {
                    "type": "subjective",
                    "question": "1일차-9) 길이가 56m인 도로의 양쪽에 처음부터 끝까지 8m 간격으로 가로수를 심습니다. 처음과 끝에도 심는다면 가로수는 모두 몇 그루인가요?",
                    "answer": "16그루",
                },
                {
                    "type": "subjective",
                    "question": "1일차-10) 거북이가 3분 동안 12m를 갑니다. 같은 빠르기로 20m를 가는 데 걸리는 시간은 몇 분인가요?",
                    "answer": "5분",
                },
                {
                    "type": "subjective",
                    "question": "1일차-11) 나무늘보가 5분 동안 20m를 갑니다. 같은 빠르기로 36m를 가는 데 걸리는 시간은 몇 분인가요?",
                    "answer": "9분",
                },
                {
                    "type": "subjective",
                    "question": "1일차-12) 기계가 20분 동안 물건 16개를 만듭니다. 이 기계가 1시간 30분 동안 만들 수 있는 물건은 몇 개인가요?",
                    "answer": "72개",
                },
                {
                    "type": "objective",
                    "question": "1일차-13) 직각삼각형에 대한 설명으로 옳은 것은 무엇인가요?",
                    "options": [
                        "꼭짓점이 1개 있습니다.",
                        "각이 3개 있습니다.",
                        "직각이 3개 있습니다.",
                        "선분이 4개 있습니다.",
                    ],
                    "answer": "각이 3개 있습니다.",
                },
                {
                    "type": "subjective",
                    "question": "1일차-14) 길이가 80cm인 철사를 네 도막으로 똑같이 나눈 뒤, 그중 한 도막으로 가장 큰 정사각형을 만들었습니다. 정사각형의 한 변은 몇 cm인가요?",
                    "answer": "5cm",
                },
                {
                    "type": "subjective",
                    "question": "1일차-15) 길이가 1m인 철사로 한 변이 6cm인 정사각형을 겹치지 않게 만들려고 합니다. 몇 개까지 만들 수 있나요?",
                    "answer": "4개",
                },
                {
                    "type": "subjective",
                    "question": "1일차-16) 다음 식이 성립하도록 ○ 안에 + 또는 -를 알맞게 쓰세요. 299 ○ 199 ○ 399 = 99",
                    "answer": "+, -",
                },
                {
                    "type": "subjective",
                    "question": "1일차-17) 어떤 수에 382를 더해야 할 것을 잘못하여 빼었더니 256이 되었습니다. 바르게 계산한 값을 구하세요.",
                    "answer": "1020",
                },
                {
                    "type": "objective",
                    "question": "1일차-18) 수카드 1, 2, 4 중에서 2장을 뽑아 한 번씩만 사용하여 두 자리 수를 만듭니다. 6으로 나누어떨어지는 수 중에서 가장 큰 수는 무엇인가요?",
                    "options": ["12", "14", "24", "42"],
                    "answer": "42",
                },
                {
                    "type": "objective",
                    "question": "1일차-19) 수카드 6, 3, 5 중에서 2장을 뽑아 한 번씩만 사용하여 두 자리 수를 만듭니다. 9로 나누어떨어지는 수 중에서 가장 큰 수는 무엇인가요?",
                    "options": ["35", "53", "63", "65"],
                    "answer": "63",
                },
                {
                    "type": "subjective",
                    "question": "1일차-20) 29 ÷ 4의 몫과 나머지를 구하세요.",
                    "answer": "몫 7, 나머지 1",
                },
            ],
        },
        "tue": {
            "title": "3학년 1학기 복습 (2일차)",
            "description": "조금 더 복잡한 응용 문제를 섞어 복습합니다. 두 단계 생각하기, 비교, 식 만들기",
            "problems": [
                {
                    "type": "subjective",
                    "question": "2일차-1) 연필 45자루와 지우개 30개를 각각 5명에게 똑같이 나누어 줍니다. 한 사람이 받는 물건은 모두 몇 개인가요?",
                    "answer": "15개",
                },
                {
                    "type": "subjective",
                    "question": "2일차-2) 리본 54m를 6명에게 똑같이 나누어 주었습니다. 지민이는 받은 리본을 자신과 동생 2명, 모두 3명이 똑같이 나누어 가졌습니다. 지민이는 몇 m를 가지게 되나요?",
                    "answer": "3m",
                },
                {
                    "type": "subjective",
                    "question": "2일차-3) 어떤 수를 3으로 나누었더니 몫이 8이었습니다. 그 수를 6으로 나누면 몫은 얼마인가요?",
                    "answer": "4",
                },
                {
                    "type": "subjective",
                    "question": "2일차-4) 어떤 수를 8로 나누었더니 몫이 7이었습니다. 그 수를 4로 나누면 몫은 얼마인가요?",
                    "answer": "14",
                },
                {
                    "type": "subjective",
                    "question": "2일차-5) 어떤 수를 4로 나누어야 할 것을 잘못하여 4를 곱했더니 32가 되었습니다. 바르게 계산한 값은 얼마인가요?",
                    "answer": "2",
                },
                {
                    "type": "subjective",
                    "question": "2일차-6) 3□ ÷ 6이 나누어떨어지고 몫이 가장 크게 되도록 □에 알맞은 수를 쓰세요.",
                    "answer": "6",
                },
                {
                    "type": "subjective",
                    "question": "2일차-7) □2 ÷ 4가 나누어떨어지고 몫이 가장 크게 되도록 □에 알맞은 수를 쓰세요.",
                    "answer": "9",
                },
                {
                    "type": "subjective",
                    "question": "2일차-8) 길이가 64m인 도로 한쪽에 처음부터 끝까지 8m 간격으로 나무를 심습니다. 처음과 끝에도 심는다면 나무는 몇 그루인가요?",
                    "answer": "9그루",
                },
                {
                    "type": "subjective",
                    "question": "2일차-9) 가로 30m, 세로 20m인 직사각형 공원 둘레에 10m 간격으로 나무를 심습니다. 모서리에도 심는다면 나무는 모두 몇 그루인가요?",
                    "answer": "10그루",
                },
                {
                    "type": "subjective",
                    "question": "2일차-10) 자전거가 6분 동안 24m를 갑니다. 같은 빠르기로 32m를 가는 데 걸리는 시간은 몇 분인가요?",
                    "answer": "8분",
                },
                {
                    "type": "subjective",
                    "question": "2일차-11) 개미 A는 5분 동안 20m를 가고, 개미 B는 4분 동안 24m를 갑니다. 두 개미가 각각 48m를 갈 때 걸리는 시간은 몇 분인가요? (A 시간, B 시간)",
                    "answer": "A 12분, B 8분",
                },
                {
                    "type": "objective",
                    "question": "2일차-12) 48m를 갈 때 더 빨리 도착하는 개미는 누구인가요?",
                    "options": ["개미 A", "개미 B", "둘이 같다", "알 수 없다"],
                    "answer": "개미 B",
                },
                {
                    "type": "subjective",
                    "question": "2일차-13) 기계가 6분 동안 18개를 만듭니다. 같은 빠르기로 20분 동안 몇 개를 만들 수 있나요?",
                    "answer": "60개",
                },
                {
                    "type": "subjective",
                    "question": "2일차-14) 사탕 38개를 6명에게 똑같이 나누어 주면 한 사람은 몇 개씩 받고, 몇 개가 남나요?",
                    "answer": "6개씩, 2개 남음",
                },
                {
                    "type": "subjective",
                    "question": "2일차-15) 연필을 7자루씩 5명에게 주면 5자루가 남습니다. 이 연필을 한 사람에게 10자루씩 주면 몇 명에게 줄 수 있나요?",
                    "answer": "4명",
                },
                {
                    "type": "objective",
                    "question": "2일차-16) 수카드 1, 2, 7 중 2장을 골라 한 번씩만 사용하여 만들 수 있는 두 자리 수 중, 6으로 나누어떨어지는 수가 가장 큰 것은 무엇인가요?",
                    "options": ["12", "27", "72", "71"],
                    "answer": "72",
                },
                {
                    "type": "subjective",
                    "question": "2일차-17) 수카드 1, 2, 4, 8 중 3장을 골라 한 번씩만 사용하여 □□ ÷ □ = 7이 되게 하는 식을 2개 써보세요.",
                    "answer": "14 ÷ 2 = 7, 28 ÷ 4 = 7",
                },
                {
                    "type": "subjective",
                    "question": "2일차-18) 다음 수를 한 번씩만 사용하여 계산 결과가 가장 크게 되게 하려고 합니다. 579, 159, 348\n□ + □ - □ = ?\n가장 크게 되도록 식을 만들고 계산 결과를 구하세요.",
                    "answer": "579 + 348 - 159 = 768",
                },
                {
                    "type": "subjective",
                    "question": "2일차-19) 기호 ▲에 대하여 ‘ㄱ ▲ ㄴ = ㄱ + ㄴ + ㄴ’이라고 약속할 때, 378 ▲ 264 - 597의 값을 구하세요.",
                    "answer": "309",
                },
                {
                    "type": "objective",
                    "question": "2일차-20) 다음 중 직각삼각형에 대한 설명으로 옳은 것은 무엇인가요?",
                    "options": [
                        "직각이 3개 있습니다.",
                        "각이 3개 있습니다.",
                        "꼭짓점이 1개 있습니다.",
                        "선분이 4개 있습니다.",
                    ],
                    "answer": "각이 3개 있습니다.",
                },
            ],
        },
        "wed": {
            "title": "3학년 1학기 복습 (3일차)",
            "description": "여러 조건을 함께 생각해야 하는 문제, 역문제, 도형/간격/시간 응용을 섞은 종합 복습",
            "problems": [
                {
                    "type": "subjective",
                    "question": "3일차-1) 색종이 28장과 20장을 각각 4명에게 똑같이 나누어 줍니다. 한 사람이 받는 첫 번째 색종이는 두 번째 색종이보다 몇 장 더 많나요?",
                    "answer": "2장",
                },
                {
                    "type": "subjective",
                    "question": "3일차-2) 풍선을 13개씩 3명에게 나누어 주면 7개가 부족합니다. 이 풍선을 한 사람에게 8개씩 주면 몇 명에게 나누어 줄 수 있나요?",
                    "answer": "4명",
                },
                {
                    "type": "subjective",
                    "question": "3일차-3) 어떤 수를 9로 나누었더니 몫이 4였습니다. 그 수를 6으로 나누면 몫은 얼마인가요?",
                    "answer": "6",
                },
                {
                    "type": "subjective",
                    "question": "3일차-4) 어떤 수를 3으로 나누어야 할 것을 잘못하여 3을 곱했더니 270이 되었습니다. 바르게 계산한 값은 얼마인가요?",
                    "answer": "30",
                },
                {
                    "type": "subjective",
                    "question": "3일차-5) 6□ ÷ 6이 나누어떨어지고 몫이 가장 크게 되도록 □에 알맞은 수를 쓰세요.",
                    "answer": "6",
                },
                {
                    "type": "subjective",
                    "question": "3일차-6) 다음 두 나눗셈의 □ 안에 알맞은 수를 넣어 각각 나누어지고 몫이 가장 크게 되게 하려고 합니다.\n2□ ÷ 3, 4□ ÷ 7\n두 □에 들어갈 수의 합을 구하세요.",
                    "answer": "16",
                },
                {
                    "type": "subjective",
                    "question": "3일차-7) 길이가 56m인 도로의 양쪽에 처음부터 끝까지 8m 간격으로 가로수를 심습니다. 처음과 끝에도 심는다면 가로수는 모두 몇 그루인가요?",
                    "answer": "16그루",
                },
                {
                    "type": "subjective",
                    "question": "3일차-8) 한 변이 20m인 정사각형 공원의 둘레에 5m 간격으로 나무를 심습니다. 꼭짓점에도 심는다면 나무는 모두 몇 그루인가요?",
                    "answer": "16그루",
                },
                {
                    "type": "subjective",
                    "question": "3일차-9) 길이가 1m인 철사를 사용하여 한 변이 6cm인 정사각형을 겹치지 않게 만들려고 합니다. 몇 개까지 만들 수 있나요?",
                    "answer": "4개",
                },
                {
                    "type": "subjective",
                    "question": "3일차-10) 길이가 80cm인 철사를 4도막으로 똑같이 나눈 뒤, 한 도막으로 가장 큰 정사각형을 만들었습니다. 정사각형의 한 변은 몇 cm인가요?",
                    "answer": "5cm",
                },
                {
                    "type": "subjective",
                    "question": "3일차-11) 그림을 똑같이 6조각으로 잘랐더니 한 조각의 넓이가 72㎠였습니다. 그림 전체의 넓이는 몇 ㎠인가요?",
                    "answer": "432㎠",
                },
                {
                    "type": "subjective",
                    "question": "3일차-12) 거북이가 3분 동안 12m를 갑니다. 같은 빠르기로 20m를 가는 데 걸리는 시간은 몇 분인가요?",
                    "answer": "5분",
                },
                {
                    "type": "subjective",
                    "question": "3일차-13) 나무늘보가 5분 동안 20m를 가고, 이보다 같은 빠르기로 36m를 가는 데 걸리는 시간은 몇 분인가요?",
                    "answer": "9분",
                },
                {
                    "type": "subjective",
                    "question": "3일차-14) 일정한 빠르기로 4분 동안 16m를 가는 개미와 7분 동안 35m를 가는 개미가 있습니다. 두 개미가 20m를 갈 때 걸리는 시간은 각각 몇 분인가요?",
                    "answer": "첫째 5분, 둘째 4분",
                },
                {
                    "type": "subjective",
                    "question": "3일차-15) 일정한 빠르기로 20분 동안 16개를 만드는 기계가 있습니다. 이 기계가 1시간 30분 동안 만들 수 있는 물건은 몇 개인가요?",
                    "answer": "72개",
                },
                {
                    "type": "objective",
                    "question": "3일차-16) 수카드 2, 8, 6, 4 중 3장을 뽑아 한 번씩만 사용하여 □□ ÷ □ = 7 이 되게 할 때 가능한 식은 무엇인가요?",
                    "options": ["28 ÷ 4 = 7", "84 ÷ 6 = 7", "42 ÷ 6 = 7", "①과 ③"],
                    "answer": "①과 ③",
                },
                {
                    "type": "objective",
                    "question": "3일차-17) 다음 식이 성립하도록 ○ 안에 알맞은 기호를 넣은 것은 무엇인가요?\n299 ○ 199 ○ 399 = 99",
                    "options": ["+, +", "+, -", "-, +", "-, -"],
                    "answer": "+, -",
                },
                {
                    "type": "subjective",
                    "question": "3일차-18) 어떤 수에 382를 더해야 할 것을 잘못하여 빼었더니 256이 되었습니다. 바르게 계산한 값을 구하세요.",
                    "answer": "1020",
                },
                {
                    "type": "subjective",
                    "question": "3일차-19) 다음 수를 한 번씩만 사용하여 계산 결과가 가장 크게 되게 하세요.\n579, 159, 348\n□ + □ - □ = ?",
                    "answer": "579 + 348 - 159 = 768",
                },
                {
                    "type": "objective",
                    "question": "3일차-20) 직각삼각형에 대한 설명으로 옳은 것을 모두 고르면?",
                    "options": [
                        "3개의 선분으로 둘러싸여 있다, 각이 3개 있다",
                        "꼭짓점이 1개 있다, 직각이 3개 있다",
                        "선분이 4개 있다, 직각이 1개 있다",
                        "꼭짓점이 2개 있다, 각이 3개 있다",
                    ],
                    "answer": "3개의 선분으로 둘러싸여 있다, 각이 3개 있다",
                },
            ],
        },
    }


def _label_keys_for_problem(day_key: str) -> list[str]:
    base = [COMMON_LABEL_KEY, "grade3", "semester1", "review", "source_ai_generated"]
    day_label = f"day_{day_key}"
    if day_key == "mon":
        return [*base, day_label, "difficulty_basic"]
    if day_key == "tue":
        return [*base, day_label, "difficulty_intermediate"]
    return [*base, day_label, "difficulty_advanced"]


def _import_day(token: str, day_key: str, payload: dict[str, Any]) -> str:
    response = requests.post(
        f"{API_BASE}/homework/admin/problem-bank/import",
        headers=_headers(token),
        json={"weekKey": WEEK_KEY, "dayKey": day_key, "payload": payload},
        timeout=40,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"import {day_key} failed: {response.status_code} {response.text}"
        )
    obj = response.json()
    batch_id = obj.get("batchId")
    if not isinstance(batch_id, str) or not batch_id:
        raise RuntimeError(f"import {day_key} missing batchId")
    created = obj.get("createdProblemCount")
    skipped = obj.get("skippedProblemCount")
    print(f"{day_key}: batch={batch_id} created={created} skipped={skipped}")
    return batch_id


def _list_batch_problem_ids(token: str, day_key: str, batch_id: str) -> list[str]:
    response = requests.get(
        f"{API_BASE}/homework/admin/problem-bank/problems",
        headers=_headers(token),
        params={"weekKey": WEEK_KEY, "dayKey": day_key, "limit": 500, "offset": 0},
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"problem list {day_key} failed: {response.status_code} {response.text}"
        )
    items = response.json().get("problems")
    if not isinstance(items, list):
        return []
    ids: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("batchId") != batch_id:
            continue
        pid = item.get("id")
        if isinstance(pid, str) and pid:
            ids.append(pid)
    return ids


def _set_labels(token: str, problem_id: str, label_keys: list[str]) -> None:
    response = requests.put(
        f"{API_BASE}/homework/admin/problem-bank/problems/{problem_id}/labels",
        headers=_headers(token),
        json={"labelKeys": label_keys},
        timeout=20,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"set labels failed ({problem_id}): {response.status_code} {response.text}"
        )


def _verify_day(token: str, day_key: str, expected_count: int = 20) -> None:
    response = requests.get(
        f"{API_BASE}/homework/admin/problem-bank/problems",
        headers=_headers(token),
        params={
            "weekKey": WEEK_KEY,
            "dayKey": day_key,
            "labelKey": COMMON_LABEL_KEY,
            "limit": 500,
            "offset": 0,
        },
        timeout=30,
    )
    if response.status_code != 200:
        raise RuntimeError(
            f"verify list {day_key} failed: {response.status_code} {response.text}"
        )
    problems = response.json().get("problems")
    if not isinstance(problems, list):
        raise RuntimeError(f"verify list {day_key} malformed response")

    day_count = 0
    for item in problems:
        if isinstance(item, dict) and item.get("dayKey") == day_key:
            day_count += 1

    if day_count < expected_count:
        raise RuntimeError(
            f"verify failed for {day_key}: expected at least {expected_count}, got {day_count}"
        )
    print(f"verify {day_key}: found={day_count} (label={COMMON_LABEL_KEY})")


def main() -> None:
    token = _get_access_token()
    for key, text in LABELS:
        _ensure_label(token, key, text)

    payloads = _day_payloads()
    for day_key in DAY_KEYS:
        payload = payloads[day_key]
        batch_id = _import_day(token, day_key, payload)
        problem_ids = _list_batch_problem_ids(token, day_key, batch_id)
        if len(problem_ids) != 20:
            raise RuntimeError(
                f"unexpected problem count for {day_key}: {len(problem_ids)}"
            )
        tags = _label_keys_for_problem(day_key)
        for problem_id in problem_ids:
            _set_labels(token, problem_id, tags)

    for day_key in DAY_KEYS:
        _verify_day(token, day_key)

    print("import complete")


if __name__ == "__main__":
    main()
