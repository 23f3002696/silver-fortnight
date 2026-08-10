import os
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class config():
    DEBUG = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
    CELERY_RESULT_BACKEND = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/1")

    CACHE_TYPE = "RedisCache"
    CACHE_REDIS_URL = os.environ.get("CACHE_REDIS_URL", "redis://localhost:6379/2")
    CACHE_DEFAULT_TIMEOUT = 300
    CACHE_FALLBACK_TO_SIMPLE = True

    CACHE_TTL_TREK_LISTING = 60
    CACHE_TTL_ADMIN_STATS = 60
    CACHE_TTL_ADMIN_LISTS = 60
    CACHE_TTL_ANALYTICS = 120

class LocalDevelopmentConfig(config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///silver-fortnight.db"
    JWT_SECRET_KEY = "super-secret-local-dev-key-not-for-production-000"
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=6)

    EXPORT_DIR = os.path.join(BASE_DIR, "instance", "exports")

    MAIL_SERVER_HOST = "localhost"
    MAIL_SERVER_PORT = 1025
    MAIL_SENDER_ADDRESS = "no-reply@silver-fortnight.local"
    MAIL_SENDER_PASSWORD = ""
    TREK_REMINDER_DAYS_AHEAD = 1