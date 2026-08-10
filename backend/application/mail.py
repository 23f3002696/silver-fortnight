import smtplib
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from flask import current_app


def send_email(to_address, subject, message, content="html", attachment_path=None, attachment_name=None):
    cfg = current_app.config

    msg = MIMEMultipart()
    msg["From"] = cfg.get("MAIL_SENDER_ADDRESS", "no-reply@silver-fortnight.local")
    msg["To"] = to_address
    msg["Subject"] = subject
    msg.attach(MIMEText(message, content))

    if attachment_path:
        with open(attachment_path, "rb") as f:
            part = MIMEBase("application", "octet-stream")
            part.set_payload(f.read())
        encoders.encode_base64(part)
        name = attachment_name or attachment_path.rsplit("/", 1)[-1]
        part.add_header("Content-Disposition", f"attachment; filename={name}")
        msg.attach(part)

    host = cfg.get("MAIL_SERVER_HOST", "localhost")
    port = cfg.get("MAIL_SERVER_PORT", 1025)
    sender_password = cfg.get("MAIL_SENDER_PASSWORD", "")

    with smtplib.SMTP(host=host, port=port) as s:
        if sender_password:
            s.login(msg["From"], sender_password)
        s.send_message(msg)

    return True