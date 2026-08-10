from flask import Flask, render_template
from application.config import LocalDevelopmentConfig
from application.database import db
from application.models import User, StaffProfile
from application.security import jwt
import click
from application.constants import Role, StaffStatus
from flask_cors import CORS
from application.celery_init import celery_init_app
from celery.schedules import crontab

def create_app():
    app = Flask(
        __name__,
        template_folder="../frontend/templates",
        static_folder="../frontend/static")
    app.config.from_object(LocalDevelopmentConfig)
    db.init_app(app)
    jwt.init_app(app)
    CORS(app, resources={r"/api/*": {"origins": "*"}})
    return app

app = create_app()

app.app_context().push()

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

from application.routes import *

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
    click.echo(f"Trek Staff user '{username}' created.")
 
 
if __name__ == "__main__":
    app.run()