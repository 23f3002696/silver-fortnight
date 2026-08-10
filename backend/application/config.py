import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../backend


class config():
    DEBUG = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class LocalDevelopmentConfig(config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///silver-fortnight.db"
    JWT_SECRET_KEY = "super-secret"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=6)

    EXPORT_DIR = os.path.join(BASE_DIR, "instance", "exports")

    MAIL_SERVER_HOST = "localhost"
    MAIL_SERVER_PORT = 1025
    MAIL_SENDER_ADDRESS = "no-reply@silver-fortnight.local"
    MAIL_SENDER_PASSWORD = ""
    TREK_REMINDER_DAYS_AHEAD = 1