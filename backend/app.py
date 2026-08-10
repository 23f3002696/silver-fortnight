from flask import Flask, render_template
from application.config import LocalDevelopmentConfig
from application.database import db
from application.models import Booking, StaffProfile, Trek, User, utc_now
from application.security import jwt
import click
from datetime import date, timedelta
from application.constants import (
    BookingStatus,
    PaymentStatus,
    Role,
    StaffStatus,
    TrekDifficulty,
    TrekStatus,
)
from flask_cors import CORS
from application.celery_init import celery_init_app
from celery.schedules import crontab
from application.cache import (
    cache,
    invalidate_staff_caches,
    invalidate_trek_caches,
    invalidate_user_caches,
)

def create_app():
    app = Flask(
        __name__,
        template_folder="../frontend/templates",
        static_folder="../frontend/static")
    app.config.from_object(LocalDevelopmentConfig)
    db.init_app(app)
    cache.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    return app

app = create_app()

celery = celery_init_app(app)


@celery.on_after_finalize.connect
def setup_periodic_tasks(sender, **kwargs):
    from application.tasks import send_monthly_report, send_trek_reminders
 
    sender.add_periodic_task(
        crontab(hour=8, minute=0),
        send_trek_reminders.s(),
        name="daily-trek-reminders",
    )
    sender.add_periodic_task(
        crontab(hour=0, minute=5, day_of_month=1),
        send_monthly_report.s(),
        name="monthly-admin-report",
    )

with app.app_context():
    import application.routes

@app.route("/")
def index():
    return render_template("index.html")

@app.cli.command("init-db")
def init_db():
    db.create_all()
    click.echo("Database tables created.")


@app.cli.command("create-admin")
@click.option("--username", default="admin", show_default=True, help="Admin username.")
@click.option("--email", default="admin@silver-fortnight.com", show_default=True, help="Admin email.")
@click.option("--password", default="admin", show_default=True, help="Admin password.")
def create_admin(username, email, password):
    if User.query.filter_by(role=Role.ADMIN).first():
        click.echo("An admin user already exists. Skipping.")
        return
 
    admin = User(username=username, email=email, role=Role.ADMIN)
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()
    invalidate_user_caches()
    click.echo(f"Admin user '{username}' created.")
 
 
@app.cli.command("create-staff")
@click.option("--username", required=True, help="Staff login username.")
@click.option("--email", required=True, help="Staff email.")
@click.option("--password", required=True, help="Staff login password.")
@click.option("--name", default=None, help="Staff display name.")
@click.option("--contact", default=None, help="Staff contact number.")
def create_staff(username, email, password, name, contact):
    if User.query.filter_by(username=username).first():
        click.echo(f"A user with username '{username}' already exists.")
        return
    if User.query.filter_by(email=email).first():
        click.echo(f"A user with email '{email}' already exists.")
        return
 
    staff_user = User(username=username, email=email, role=Role.STAFF)
    staff_user.set_password(password)
    staff_user.staff_profile = StaffProfile(name=name, contact_number=contact, status=StaffStatus.ACTIVE)
 
    db.session.add(staff_user)
    db.session.commit()
    invalidate_user_caches()
    click.echo(f"Trek Staff user '{username}' created.")
 
 
@app.cli.command("seed-demo")
def seed_demo():
    """Seed accounts, treks, and bookings for a ready-to-record demo."""
    db.create_all()

    if User.query.filter_by(username="trekker1").first():
        click.echo("Demo data already present. Skipping.")
        return

    today = date.today()
    last_month_start = (today.replace(day=1) - timedelta(days=1)).replace(day=1)

    if not User.query.filter_by(role=Role.ADMIN).first():
        admin = User(username="admin", email="admin@silver-fortnight.com", role=Role.ADMIN)
        admin.set_password("admin")
        db.session.add(admin)

    staff_user = User(username="staff", email="staff@silver-fortnight.com", role=Role.STAFF)
    staff_user.set_password("staff")
    staff_user.staff_profile = StaffProfile(
        name="Asha Rao", contact_number="+91 98765 43210", status=StaffStatus.ACTIVE
    )
    db.session.add(staff_user)

    trekkers = {}
    for i in (1, 2, 3):
        trekker = User(
            username=f"trekker{i}",
            email=f"trekker{i}@silver-fortnight.com",
            role=Role.USER,
        )
        trekker.set_password(f"trekker{i}")
        db.session.add(trekker)
        trekkers[i] = trekker

    db.session.flush()
    staff_profile = staff_user.staff_profile

    def make_trek(name, location, difficulty, duration, slots, status, start, end,
                  assigned=True, description=None):
        trek = Trek(
            name=name,
            location=location,
            difficulty=difficulty,
            duration_days=duration,
            available_slots=slots,
            status=status,
            start_date=start,
            end_date=end,
            description=description,
            assigned_staff_id=staff_profile.id if assigned else None,
        )
        db.session.add(trek)
        return trek

    sunrise = make_trek(
        "Sunrise Silver Fortnight", "Kodai Hills", TrekDifficulty.MODERATE, 2, 2,
        TrekStatus.OPEN, today + timedelta(days=1), today + timedelta(days=2),
        description="Flagship sunrise trek along the silver ridge.",
    )
    fortress = make_trek(
        "Full Fortress Trail", "Silver Fort", TrekDifficulty.EASY, 1, 0,
        TrekStatus.OPEN, today + timedelta(days=6), today + timedelta(days=6),
        description="Easy heritage trail around the old fortress.",
    )
    make_trek(
        "Pending Peak", "North Ridge", TrekDifficulty.HARD, 3, 5,
        TrekStatus.PENDING, today + timedelta(days=14), today + timedelta(days=16),
        assigned=False, description="Awaiting admin approval.",
    )
    make_trek(
        "Alpine Approval Walk", "Meadow Valley", TrekDifficulty.EASY, 2, 8,
        TrekStatus.APPROVED, today + timedelta(days=10), today + timedelta(days=11),
        description="Approved and ready to open.",
    )
    monsoon = make_trek(
        "Monsoon Ridge", "Western Ghats", TrekDifficulty.MODERATE, 4, 0,
        TrekStatus.COMPLETED, last_month_start + timedelta(days=3),
        last_month_start + timedelta(days=6),
        description="Last month's completed flagship trek.",
    )
    cavern = make_trek(
        "Closed Cavern Walk", "Limestone Caves", TrekDifficulty.HARD, 2, 3,
        TrekStatus.CLOSED, today + timedelta(days=20), today + timedelta(days=21),
        description="Closed for the season.",
    )

    db.session.flush()

    def make_booking(user, trek, status, payment, days_ago):
        booking = Booking(
            user_id=user.id,
            trek_id=trek.id,
            status=status,
            payment_status=payment,
            booking_date=utc_now() - timedelta(days=days_ago),
        )
        db.session.add(booking)

    make_booking(trekkers[2], sunrise, BookingStatus.BOOKED, PaymentStatus.PENDING, 3)
    make_booking(trekkers[2], fortress, BookingStatus.BOOKED, PaymentStatus.PAID, 5)
    make_booking(trekkers[3], fortress, BookingStatus.BOOKED, PaymentStatus.PAID, 4)
    make_booking(trekkers[1], monsoon, BookingStatus.COMPLETED, PaymentStatus.PAID, 40)
    make_booking(trekkers[2], monsoon, BookingStatus.COMPLETED, PaymentStatus.PAID, 39)
    make_booking(trekkers[3], cavern, BookingStatus.BOOKED, PaymentStatus.PAID, 10)
    make_booking(trekkers[1], cavern, BookingStatus.CANCELLED, PaymentStatus.NOT_REQUIRED, 9)

    db.session.commit()
    invalidate_trek_caches()
    invalidate_staff_caches()
    invalidate_user_caches()

    click.echo("Demo data seeded.")
    click.echo("Logins: admin/admin, staff/staff, trekker1/trekker1 (also trekker2, trekker3).")
    click.echo("Demo notes:")
    click.echo(" - 'Sunrise Silver Fortnight' starts tomorrow (reminder emails) with 2 slots left.")
    click.echo(" - 'Full Fortress Trail' is full (overbooking rejection).")
    click.echo(" - 'Pending Peak' is pending with no staff (approval lifecycle).")
    click.echo(" - 'Monsoon Ridge' completed last month (monthly report, charts, CSV export).")


if __name__ == "__main__":
    app.run()