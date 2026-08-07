class config():
    DEBUG = False
    SQLALCHEMY_TRACK_MODIFICATIONS = False

class LocalDevelopmentConfig(config):
    DEBUG = True
    SQLALCHEMY_DATABASE_URI = "sqlite:///silver-fortnight.db"
    JWT_SECRET_KEY = "super-secret"