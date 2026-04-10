from email.message import EmailMessage

import aiosmtplib
from aiosmtplib.errors import SMTPAuthenticationError

from app.config import settings


class EmailService:
    @staticmethod
    def _ensure_smtp_config() -> None:
        if not settings.SMTP_HOST:
            raise ValueError("SMTP_HOST is not configured")
        if not settings.SMTP_USER:
            raise ValueError("SMTP_USER is not configured")
        if not settings.SMTP_PASSWORD:
            raise ValueError("SMTP_PASSWORD is not configured")

    async def send_activation_email(self, recipient_email: str, first_name: str, activation_link: str) -> None:
        self._ensure_smtp_config()

        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM or settings.SMTP_USER
        message["To"] = recipient_email
        message["Subject"] = "Подтверждение регистрации AutoRent"

        text_body = (
            f"Здравствуйте, {first_name}!\n\n"
            "Спасибо за регистрацию в AutoRent.\n"
            "Подтвердите ваш email по ссылке:\n"
            f"{activation_link}\n\n"
            "Если вы не регистрировались, просто проигнорируйте это письмо."
        )
        html_body = f"""
        <html>
          <body>
            <p>Здравствуйте, {first_name}!</p>
            <p>Спасибо за регистрацию в <b>AutoRent</b>.</p>
            <p>Подтвердите ваш email по ссылке:</p>
            <p><a href="{activation_link}">Подтвердить аккаунт</a></p>
            <p>Если вы не регистрировались, просто проигнорируйте это письмо.</p>
          </body>
        </html>
        """

        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")

        username_candidates = [settings.SMTP_USER]
        if settings.EMAIL_FROM and settings.EMAIL_FROM not in username_candidates:
            username_candidates.append(settings.EMAIL_FROM)

        password_candidates = [settings.SMTP_PASSWORD]
        compact_password = settings.SMTP_PASSWORD.replace(" ", "")
        if compact_password and compact_password != settings.SMTP_PASSWORD:
            password_candidates.append(compact_password)

        last_error: Exception | None = None
        for username in username_candidates:
            for password in password_candidates:
                try:
                    await aiosmtplib.send(
                        message,
                        hostname=settings.SMTP_HOST,
                        port=settings.SMTP_PORT,
                        username=username,
                        password=password,
                        start_tls=settings.SMTP_STARTTLS,
                        use_tls=settings.SMTP_USE_TLS,
                        timeout=30,
                    )
                    return
                except SMTPAuthenticationError as exc:
                    last_error = exc
                    continue

        if last_error:
            raise last_error
