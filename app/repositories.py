from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Iterable, List, Optional


@dataclass(frozen=True, slots=True)
class AttemptRecord:
    id: int
    problem_id: str
    submitted_answer: int
    is_correct: bool
    attempted_at: datetime
    user_id: str | None = None


class AttemptRepository:
    """SQLite-backed repository for storing problem attempts."""

    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS attempts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    problem_id TEXT NOT NULL,
                    submitted_answer INTEGER NOT NULL,
                    is_correct INTEGER NOT NULL,
                    attempted_at TEXT NOT NULL,
                    user_id TEXT
                )
                """
            )
            self._ensure_user_id_column(connection)
            connection.commit()

    def _ensure_user_id_column(self, connection: sqlite3.Connection) -> None:
        columns = connection.execute("PRAGMA table_info(attempts)").fetchall()
        has_user_id = any(column[1] == "user_id" for column in columns)
        if not has_user_id:
            connection.execute("ALTER TABLE attempts ADD COLUMN user_id TEXT")

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(
            self.database_path,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )

    def record_attempt(
        self,
        *,
        problem_id: str,
        submitted_answer: int,
        is_correct: bool,
        user_id: str | int | None = None,
    ) -> AttemptRecord:
        attempted_at = datetime.now(timezone.utc)
        stored_user_id = str(user_id) if user_id is not None else None
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO attempts (
                    problem_id, submitted_answer, is_correct, attempted_at, user_id
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    problem_id,
                    int(submitted_answer),
                    1 if is_correct else 0,
                    attempted_at.isoformat(),
                    stored_user_id,
                ),
            )
            connection.commit()
            attempt_id = int(cursor.lastrowid)
        return AttemptRecord(
            id=attempt_id,
            problem_id=problem_id,
            submitted_answer=int(submitted_answer),
            is_correct=is_correct,
            attempted_at=attempted_at,
            user_id=stored_user_id,
        )

    def list_attempts(
        self,
        problem_id: str | None = None,
        user_id: str | int | None = None,
    ) -> List[AttemptRecord]:
        query = (
            "SELECT id, problem_id, submitted_answer, is_correct, attempted_at, user_id FROM attempts"
        )
        clauses: list[str] = []
        params: list[object] = []
        if problem_id is not None:
            clauses.append("problem_id = ?")
            params.append(problem_id)
        if user_id is not None:
            clauses.append("user_id = ?")
            params.append(str(user_id))
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY id ASC"

        with self._lock, self._connect() as connection:
            rows = connection.execute(query, tuple(params)).fetchall()

        return [self._row_to_record(row) for row in rows]

    def list_attempts_for_user(self, user_id: str | int) -> List[AttemptRecord]:
        return self.list_attempts(user_id=user_id)

    def clear(self) -> None:
        with self._lock, self._connect() as connection:
            connection.execute("DELETE FROM attempts")
            connection.commit()

    def _row_to_record(self, row: Iterable[object]) -> AttemptRecord:
        id_, problem_id, submitted_answer, is_correct, attempted_at, *rest = row
        user_id = None
        if rest:
            user_id = rest[0]
            if user_id is not None:
                user_id = str(user_id)
        attempted_at_dt = datetime.fromisoformat(str(attempted_at))
        if attempted_at_dt.tzinfo is None:
            attempted_at_dt = attempted_at_dt.replace(tzinfo=timezone.utc)
        return AttemptRecord(
            id=int(id_),
            problem_id=str(problem_id),
            submitted_answer=int(submitted_answer),
            is_correct=bool(is_correct),
            attempted_at=attempted_at_dt,
            user_id=user_id,
        )


@dataclass(frozen=True, slots=True)
class UserRecord:
    id: int
    nickname: str
    password_hash: str
    role: str
    locale: str


class UserRepository:
    """Simple SQLite-backed repository for user credentials."""

    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nickname TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL,
                    locale TEXT NOT NULL DEFAULT 'ko',
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(
            self.database_path,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )

    def get_by_nickname(self, nickname: str) -> Optional[UserRecord]:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                "SELECT id, nickname, password_hash, role, locale FROM users WHERE nickname = ?",
                (nickname,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_record(row)

    def get_by_id(self, user_id: int) -> Optional[UserRecord]:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                "SELECT id, nickname, password_hash, role, locale FROM users WHERE id = ?",
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_record(row)

    def create_user(
        self,
        *,
        nickname: str,
        password_hash: str,
        role: str = "student",
        locale: str = "ko",
    ) -> UserRecord:
        created_at = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO users (nickname, password_hash, role, locale, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (nickname, password_hash, role, locale, created_at),
            )
            connection.commit()
            user_id = int(cursor.lastrowid)
        return UserRecord(
            id=user_id,
            nickname=nickname,
            password_hash=password_hash,
            role=role,
            locale=locale,
        )

    def _row_to_record(self, row: Iterable[object]) -> UserRecord:
        user_id, nickname, password_hash, role, locale = row
        return UserRecord(
            id=int(user_id),
            nickname=str(nickname),
            password_hash=str(password_hash),
            role=str(role),
            locale=str(locale),
        )


@dataclass(frozen=True, slots=True)
class SessionRecord:
    id: int
    user_id: int
    token_hash: str
    issued_at: datetime
    expires_at: datetime
    last_seen_at: datetime
    is_active: bool
    user_agent: str | None


class SessionRepository:
    """SQLite-backed repository for session metadata."""

    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL UNIQUE,
                    issued_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    last_seen_at TEXT NOT NULL,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    user_agent TEXT
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)"
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash)"
            )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(
            self.database_path,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )

    def create_session(
        self,
        *,
        user_id: int,
        token_hash: str,
        issued_at: datetime,
        expires_at: datetime,
        user_agent: str | None = None,
    ) -> SessionRecord:
        last_seen_at = issued_at
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO sessions (
                    user_id, token_hash, issued_at, expires_at, last_seen_at, is_active, user_agent
                )
                VALUES (?, ?, ?, ?, ?, 1, ?)
                """,
                (
                    int(user_id),
                    token_hash,
                    issued_at.isoformat(),
                    expires_at.isoformat(),
                    last_seen_at.isoformat(),
                    user_agent,
                ),
            )
            connection.commit()
            session_id = int(cursor.lastrowid)
        return SessionRecord(
            id=session_id,
            user_id=int(user_id),
            token_hash=token_hash,
            issued_at=issued_at,
            expires_at=expires_at,
            last_seen_at=last_seen_at,
            is_active=True,
            user_agent=user_agent,
        )

    def get_by_token_hash(self, token_hash: str) -> Optional[SessionRecord]:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, user_id, token_hash, issued_at, expires_at, last_seen_at, is_active, user_agent
                FROM sessions
                WHERE token_hash = ?
                """,
                (token_hash,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_record(row)

    def list_active_sessions_for_user(self, user_id: int) -> List[SessionRecord]:
        with self._lock, self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id, user_id, token_hash, issued_at, expires_at, last_seen_at, is_active, user_agent
                FROM sessions
                WHERE user_id = ? AND is_active = 1
                ORDER BY issued_at DESC
                """,
                (int(user_id),),
            ).fetchall()
        return [self._row_to_record(row) for row in rows]

    def touch_session(self, session_id: int) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self._lock, self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET last_seen_at = ? WHERE id = ?",
                (now, int(session_id)),
            )
            connection.commit()

    def deactivate_session(self, session_id: int) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET is_active = 0 WHERE id = ?",
                (int(session_id),),
            )
            connection.commit()

    def deactivate_sessions_for_user(self, user_id: int) -> None:
        with self._lock, self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET is_active = 0 WHERE user_id = ?",
                (int(user_id),),
            )
            connection.commit()

    def _row_to_record(self, row: Iterable[object]) -> SessionRecord:
        (
            session_id,
            user_id,
            token_hash,
            issued_at,
            expires_at,
            last_seen_at,
            is_active,
            user_agent,
        ) = row
        issued_at_dt = datetime.fromisoformat(str(issued_at))
        expires_at_dt = datetime.fromisoformat(str(expires_at))
        last_seen_at_dt = datetime.fromisoformat(str(last_seen_at))
        if issued_at_dt.tzinfo is None:
            issued_at_dt = issued_at_dt.replace(tzinfo=timezone.utc)
        if expires_at_dt.tzinfo is None:
            expires_at_dt = expires_at_dt.replace(tzinfo=timezone.utc)
        if last_seen_at_dt.tzinfo is None:
            last_seen_at_dt = last_seen_at_dt.replace(tzinfo=timezone.utc)
        user_agent_str = str(user_agent) if user_agent is not None else None
        return SessionRecord(
            id=int(session_id),
            user_id=int(user_id),
            token_hash=str(token_hash),
            issued_at=issued_at_dt,
            expires_at=expires_at_dt,
            last_seen_at=last_seen_at_dt,
            is_active=bool(is_active),
            user_agent=user_agent_str,
        )


@dataclass(frozen=True, slots=True)
class LRCRecord:
    id: int
    user_id: str
    accuracy: float
    rt_percentile: float
    rubric: float
    passed: bool
    status: str
    recommendation: str
    focus_concept: str | None
    evaluated_at: datetime


class LRCRepository:
    """SQLite-backed store for per-user LRC evaluations."""

    def __init__(self, database_path: Path):
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._initialize()

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS lrc_results (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id TEXT NOT NULL,
                    accuracy REAL NOT NULL,
                    rt_percentile REAL NOT NULL,
                    rubric REAL NOT NULL,
                    passed INTEGER NOT NULL,
                    status TEXT NOT NULL,
                    recommendation TEXT NOT NULL,
                    focus_concept TEXT,
                    evaluated_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                "CREATE INDEX IF NOT EXISTS idx_lrc_results_user ON lrc_results(user_id, evaluated_at DESC)"
            )
            connection.commit()

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(
            self.database_path,
            detect_types=sqlite3.PARSE_DECLTYPES,
            check_same_thread=False,
        )

    def record_result(
        self,
        *,
        user_id: str,
        accuracy: float,
        rt_percentile: float,
        rubric: float,
        passed: bool,
        status: str,
        recommendation: str,
        focus_concept: str | None,
    ) -> LRCRecord:
        evaluated_at = datetime.now(timezone.utc)
        with self._lock, self._connect() as connection:
            cursor = connection.execute(
                """
                INSERT INTO lrc_results (
                    user_id, accuracy, rt_percentile, rubric, passed, status, recommendation, focus_concept, evaluated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    float(accuracy),
                    float(rt_percentile),
                    float(rubric),
                    1 if passed else 0,
                    status,
                    recommendation,
                    focus_concept,
                    evaluated_at.isoformat(),
                ),
            )
            connection.commit()
            record_id = int(cursor.lastrowid)
        return LRCRecord(
            id=record_id,
            user_id=user_id,
            accuracy=float(accuracy),
            rt_percentile=float(rt_percentile),
            rubric=float(rubric),
            passed=passed,
            status=status,
            recommendation=recommendation,
            focus_concept=focus_concept,
            evaluated_at=evaluated_at,
        )

    def get_latest(self, user_id: str) -> LRCRecord | None:
        with self._lock, self._connect() as connection:
            row = connection.execute(
                """
                SELECT id, user_id, accuracy, rt_percentile, rubric, passed, status, recommendation, focus_concept, evaluated_at
                FROM lrc_results
                WHERE user_id = ?
                ORDER BY evaluated_at DESC, id DESC
                LIMIT 1
                """,
                (user_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_record(row)

    def _row_to_record(self, row: Iterable[object]) -> LRCRecord:
        (
            record_id,
            user_id,
            accuracy,
            rt_percentile,
            rubric,
            passed,
            status,
            recommendation,
            focus_concept,
            evaluated_at,
        ) = row
        evaluated_at_dt = datetime.fromisoformat(str(evaluated_at))
        if evaluated_at_dt.tzinfo is None:
            evaluated_at_dt = evaluated_at_dt.replace(tzinfo=timezone.utc)
        return LRCRecord(
            id=int(record_id),
            user_id=str(user_id),
            accuracy=float(accuracy),
            rt_percentile=float(rt_percentile),
            rubric=float(rubric),
            passed=bool(passed),
            status=str(status),
            recommendation=str(recommendation),
            focus_concept=str(focus_concept) if focus_concept is not None else None,
            evaluated_at=evaluated_at_dt,
        )



__all__ = [
    "AttemptRecord",
    "AttemptRepository",
    "UserRecord",
    "UserRepository",
    "SessionRecord",
    "SessionRepository",
    "LRCRecord",
    "LRCRepository",
]

