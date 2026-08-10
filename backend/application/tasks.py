import csv
import os
from datetime import date, datetime, timedelta

from celery import shared_task
from flask import current_app
from jinja2 import Template
from sqlalchemy import func

from .constants import BookingStatus, Role, TrekStatus
from .database import db
from .mail import send_email
from .models import Booking, Trek, User


def _export_dir():
    export_dir = current_app.config.get("EXPORT_DIR", "instance/exports")
    os.makedirs(export_dir, exist_ok=True)
    return export_dir



REMINDER_TEMPLATE = """
<h3>Hi {{ username }},</h3>
<p>This is a reminder that your trek <strong>{{ trek_name }}</strong> starts on
<strong>{{ start_date }}</strong> ({{ days_left }} day(s) from now).</p>
<p>Location: {{ location }}<br>Difficulty: {{ difficulty }}</p>
<p>Please pack accordingly and reach the meeting point on time. Happy trekking!</p>
<p>&mdash; Silver Fortnight Trekking Team</p>
"""


@shared_task(ignore_result=False, name="tasks.send_trek_reminders")
def send_trek_reminders(days_ahead=None):
    """Scheduled job: email every trekker with an active booking on a trek
    starting `days_ahead` days from today (defaults to config value)."""
    if days_ahead is None:
        days_ahead = current_app.config.get("TREK_REMINDER_DAYS_AHEAD", 1)

    target_date = date.today() + timedelta(days=days_ahead)
    treks = Trek.query.filter(Trek.start_date == target_date).all()

    reminders_sent = 0
    for trek in treks:
        active_bookings = [b for b in trek.bookings if b.status == BookingStatus.BOOKED]
        for booking in active_bookings:
            user = booking.user
            html = Template(REMINDER_TEMPLATE).render(
                username=user.username,
                trek_name=trek.name,
                start_date=trek.start_date.isoformat(),
                days_left=days_ahead,
                location=trek.location or "TBA",
                difficulty=trek.difficulty,
            )
            send_email(user.email, subject=f"Reminder: {trek.name} starts soon", message=html)
            reminders_sent += 1

    return f"Sent {reminders_sent} trek reminder(s) for treks starting {target_date.isoformat()}."



MONTHLY_REPORT_TEMPLATE = """
<h2>Monthly Trekking Activity Report</h2>
<p>Period: {{ period_label }}</p>
<ul>
  <li>Treks conducted (completed): {{ treks_conducted }}</li>
  <li>Participants: {{ participants }}</li>
</ul>
<h3>Popular Treks</h3>
<table border="1" cellpadding="6" cellspacing="0">
  <tr><th>Trek Name</th><th>Bookings</th></tr>
  {% for trek in popular_treks %}
  <tr><td>{{ trek.name }}</td><td>{{ trek.count }}</td></tr>
  {% else %}
  <tr><td colspan="2">No bookings in this period.</td></tr>
  {% endfor %}
</table>
<p>&mdash; Silver Fortnight Trekking Team</p>
"""


def _previous_month_bounds(today=None):
    today = today or date.today()
    first_of_this_month = today.replace(day=1)
    last_month_end = first_of_this_month - timedelta(days=1)
    last_month_start = last_month_end.replace(day=1)
    return last_month_start, last_month_end


@shared_task(ignore_result=False, name="tasks.send_monthly_report")
def send_monthly_report():
    """Scheduled job (1st of every month): email every Admin a summary of
    the previous month's trekking activity, as HTML."""
    period_start, period_end = _previous_month_bounds()

    treks_conducted = Trek.query.filter(
        Trek.status == TrekStatus.COMPLETED,
        Trek.end_date.isnot(None),
        Trek.end_date >= period_start,
        Trek.end_date <= period_end,
    ).count()

    participants = (
        db.session.query(func.count(func.distinct(Booking.user_id)))
        .join(Trek, Booking.trek_id == Trek.id)
        .filter(
            Booking.status != BookingStatus.CANCELLED,
            Trek.start_date.isnot(None),
            Trek.start_date >= period_start,
            Trek.start_date <= period_end,
        )
        .scalar()
    ) or 0

    popular_rows = (
        db.session.query(Trek.name, func.count(Booking.id).label("cnt"))
        .join(Booking, Booking.trek_id == Trek.id)
        .filter(Booking.status != BookingStatus.CANCELLED)
        .group_by(Trek.id)
        .order_by(func.count(Booking.id).desc())
        .limit(5)
        .all()
    )
    popular_treks = [{"name": name, "count": cnt} for name, cnt in popular_rows]

    html = Template(MONTHLY_REPORT_TEMPLATE).render(
        period_label=f"{period_start.isoformat()} to {period_end.isoformat()}",
        treks_conducted=treks_conducted,
        participants=participants,
        popular_treks=popular_treks,
    )

    admins = User.query.filter_by(role=Role.ADMIN).all()
    for admin in admins:
        send_email(admin.email, subject="Monthly Trekking Activity Report", message=html)

    return f"Monthly report sent to {len(admins)} admin(s)."




@shared_task(ignore_result=False, name="tasks.export_user_bookings_csv")
def export_user_bookings_csv(user_id):
    """User-triggered async job: write the trekker's booking history to a
    CSV file on disk, then email them once it's ready."""
    user = db.session.get(User, user_id)
    if not user:
        return {"error": "User not found."}

    bookings = (
        Booking.query.filter_by(user_id=user_id)
        .order_by(Booking.booking_date.desc())
        .all()
    )

    filename = f"booking_history_user{user_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.csv"
    filepath = os.path.join(_export_dir(), filename)

    with open(filepath, "w", newline="") as csv_file:
        writer = csv.writer(csv_file)
        writer.writerow(
            ["User ID", "Trek Name", "Location", "Booking Status", "Booking Date", "Trek Start Date", "Trek End Date"]
        )
        for booking in bookings:
            trek = booking.trek
            writer.writerow(
                [
                    user_id,
                    trek.name,
                    trek.location or "",
                    booking.status,
                    booking.booking_date.isoformat() if booking.booking_date else "",
                    trek.start_date.isoformat() if trek.start_date else "",
                    trek.end_date.isoformat() if trek.end_date else "",
                ]
            )

    send_email(
        user.email,
        subject="Your trekking history export is ready",
        message=(
            f"<p>Hi {user.username},</p>"
            "<p>Your trekking history CSV export has finished processing and is "
            "ready to download from the app.</p>"
        ),
    )

    return {"filename": filename}