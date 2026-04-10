from email.message import EmailMessage

import aiosmtplib
from aiosmtplib.errors import SMTPAuthenticationError

from app.config import settings


class EmailService:
    @staticmethod
    def _ensure_smtp_config() -> None:
        if not settings.SMTP_HOST:
            raise ValueError("Не задан SMTP_HOST")
        if not settings.SMTP_USER:
            raise ValueError("Не задан SMTP_USER")
        if not settings.SMTP_PASSWORD:
            raise ValueError("Не задан SMTP_PASSWORD")

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
            <p><a href=\"{activation_link}\">Подтвердить аккаунт</a></p>
            <p>Если вы не регистрировались, просто проигнорируйте это письмо.</p>
          </body>
        </html>
        """

        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")
        await self._send_message(message)

    async def send_booking_notification_email(
        self,
        recipient_email: str,
        first_name: str,
        booking_id: int,
        status_label: str,
        car_label: str,
        start_date: str,
        end_date: str,
        total_price: str,
        details_url: str | None = None,
    ) -> None:
        self._ensure_smtp_config()

        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM or settings.SMTP_USER
        message["To"] = recipient_email
        message["Subject"] = f"Обновление брони #{booking_id} - {status_label}"

        details_line = f"\nПодробнее: {details_url}\n" if details_url else "\n"
        text_body = (
            f"Здравствуйте, {first_name}!\n\n"
            f"Статус вашей брони #{booking_id}: {status_label}.\n"
            f"Автомобиль: {car_label}\n"
            f"Период: {start_date} - {end_date}\n"
            f"Сумма: {total_price}\n"
            f"{details_line}\n"
            "С уважением,\nКоманда AutoRent"
        )

        details_html = (
            f'<p><a href="{details_url}">Открыть мои бронирования</a></p>' if details_url else ""
        )
        html_body = f"""
        <html>
          <body>
            <p>Здравствуйте, {first_name}!</p>
            <p>Статус вашей брони <b>#{booking_id}</b>: <b>{status_label}</b>.</p>
            <ul>
              <li>Автомобиль: {car_label}</li>
              <li>Период: {start_date} - {end_date}</li>
              <li>Сумма: {total_price}</li>
            </ul>
            {details_html}
            <p>С уважением,<br/>Команда AutoRent</p>
          </body>
        </html>
        """

        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")
        await self._send_message(message)

    async def send_documents_verification_email(
        self,
        recipient_email: str,
        first_name: str,
        verification_status_label: str,
        rejection_reason: str | None = None,
        details_url: str | None = None,
    ) -> None:
        self._ensure_smtp_config()

        message = EmailMessage()
        message["From"] = settings.EMAIL_FROM or settings.SMTP_USER
        message["To"] = recipient_email
        message["Subject"] = f"Статус проверки документов - {verification_status_label}"

        reason_text = f"\nПричина: {rejection_reason}\n" if rejection_reason else "\n"
        details_line = f"\nПодробнее: {details_url}\n" if details_url else "\n"
        text_body = (
            f"Здравствуйте, {first_name}!\n\n"
            f"Статус проверки ваших документов: {verification_status_label}."
            f"{reason_text}"
            f"{details_line}\n"
            "С уважением,\nКоманда AutoRent"
        )

        reason_html = f"<p><b>Причина:</b> {rejection_reason}</p>" if rejection_reason else ""
        details_html = (
            f'<p><a href="{details_url}">Открыть раздел документов</a></p>' if details_url else ""
        )
        html_body = f"""
        <html>
          <body>
            <p>Здравствуйте, {first_name}!</p>
            <p>Статус проверки ваших документов: <b>{verification_status_label}</b>.</p>
            {reason_html}
            {details_html}
            <p>С уважением,<br/>Команда AutoRent</p>
          </body>
        </html>
        """

        message.set_content(text_body)
        message.add_alternative(html_body, subtype="html")
        await self._send_message(message)

    async def _send_message(self, message: EmailMessage) -> None:
        self._ensure_smtp_config()

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
