from flask import Flask
from application.config import LocalDevelopmentConfig
from application.database import db
from application.models import User
from application.security import jwt
import click
from application.constants import Role

def create_app():
    app = Flask(__name__)
    app.config.from_object(LocalDevelopmentConfig)
    db.init_app(app)
    jwt.init_app(app)
    return app

app = create_app()

app.app_context().push()

from application.routes import *

@app.cli.command("init-db")
def init_db():
    """
    Create all database tables from the current models.

    Usage:
        flask init-db
    """
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


if __name__ == "__main__":
    app.run()