"""Email service for sending homework notifications via Gmail SMTP."""

from __future__ import annotations

import logging
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path
from typing import Any, List, Optional, TypedDict

from .homework_grading import is_objective_answer_correct

logger = logging.getLogger(__name__)


class SMTPConfig(TypedDict):
    host: str
    port: int
    user: str
    password: str
    from_addr: str


def get_smtp_config() -> SMTPConfig:
    """Get SMTP configuration from environment variables."""
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASS", ""),
        "from_addr": os.getenv("SMTP_FROM", ""),
    }


def get_admin_email() -> str:
    """Get admin email from environment variable."""
    return os.getenv("ADMIN_EMAIL", "")


def is_email_configured() -> bool:
    """Check if email service is properly configured."""
    config = get_smtp_config()
    admin_email = get_admin_email()
    return bool(
        config["user"] and config["password"] and config["from_addr"] and admin_email
    )


def send_homework_notification(
    student_id: str,
    student_name: Optional[str],
    assignment_title: str,
    problems: List[dict[str, Any]],
    answers: dict[str, str],
    file_paths: List[str],
) -> bool:
    """
    Send homework submission notification email to admin.

    Args:
        student_id: The student's ID
        student_name: The student's display name (optional)
        assignment_title: Title of the homework assignment
        problems: List of problem definitions
        answers: Dict of {problemId: answer}
        file_paths: List of absolute paths to attached files

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not is_email_configured():
        logger.warning("Email service not configured. Skipping notification.")
        return False

    config = get_smtp_config()
    admin_email = get_admin_email()

    # Create email message
    msg = EmailMessage()
    display_name = student_name or student_id
    msg["Subject"] = f"[숙제 제출] {assignment_title} - {display_name}"
    msg["From"] = config["from_addr"]
    msg["To"] = admin_email

    # Build email body
    body_lines = [
        f"학생: {display_name} ({student_id})",
        f"숙제: {assignment_title}",
        "",
        "=" * 40,
        "답안:",
        "=" * 40,
    ]

    for i, problem in enumerate(problems, 1):
        problem_id = problem.get("id", f"p{i}")
        problem_type = "객관식" if problem.get("type") == "objective" else "주관식"
        question = problem.get("question", "")
        correct_answer = problem.get("answer")
        student_answer = answers.get(problem_id, "(미응답)")

        body_lines.extend(
            [
                "",
                f"문제 {i} [{problem_type}]",
                f"Q: {question}",
            ]
        )

        if problem.get("type") == "objective" and problem.get("options"):
            for j, opt in enumerate(problem["options"], 1):
                body_lines.append(f"   {j}) {opt}")

        body_lines.append(f"학생 답: {student_answer}")
        if correct_answer:
            options = (
                problem.get("options")
                if isinstance(problem.get("options"), list)
                else None
            )
            if problem.get("type") == "objective":
                is_correct = is_objective_answer_correct(
                    student_answer=(
                        str(student_answer) if isinstance(student_answer, str) else None
                    ),
                    correct_answer=str(correct_answer),
                    options=options,
                )
            else:
                is_correct = str(student_answer).strip() == str(correct_answer).strip()
            status = "정답" if is_correct else "오답"
            body_lines.append(f"정답: {correct_answer} ({status})")

    body_lines.append("")

    if file_paths:
        body_lines.extend(
            [
                "=" * 40,
                f"첨부 파일: {len(file_paths)}개",
                "=" * 40,
            ]
        )

    msg.set_content("\n".join(body_lines))

    # Attach files
    for file_path in file_paths:
        try:
            path = Path(file_path)
            if not path.exists():
                logger.warning("Attachment file not found: %s", file_path)
                continue

            with open(path, "rb") as f:
                file_data = f.read()

            # Determine MIME type
            suffix = path.suffix.lower()
            mime_types = {
                ".jpg": ("image", "jpeg"),
                ".jpeg": ("image", "jpeg"),
                ".png": ("image", "png"),
                ".webp": ("image", "webp"),
            }
            maintype, subtype = mime_types.get(suffix, ("application", "octet-stream"))

            msg.add_attachment(
                file_data,
                maintype=maintype,
                subtype=subtype,
                filename=path.name,
            )
        except Exception as e:
            logger.error("Failed to attach file %s: %s", file_path, str(e))

    # Send email
    try:
        smtp_host = str(config["host"])
        smtp_port = int(config["port"])
        smtp_user = str(config["user"])
        smtp_password = str(config["password"])

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)

        logger.info(
            "Homework notification sent for student %s, assignment %s",
            student_id,
            assignment_title,
        )
        return True

    except smtplib.SMTPAuthenticationError as e:
        logger.error("SMTP authentication failed: %s", str(e))
        return False
    except smtplib.SMTPException as e:
        logger.error("SMTP error while sending email: %s", str(e))
        return False
    except Exception as e:
        logger.error("Unexpected error sending email: %s", str(e))
        return False
