from flask_jwt_extended import JWTManager
from application.models import User
from .database import db

jwt = JWTManager()

jwt_blocklist = set()

@jwt.user_identity_loader
def user_identity_lookup(user):
    return str(user.id)
 
 
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    identity = jwt_data["sub"]
    return db.session.get(User, int(identity))
 
 
@jwt.token_in_blocklist_loader
def check_if_token_revoked(_jwt_header, jwt_payload):
    return jwt_payload["jti"] in jwt_blocklist
 
 
@jwt.expired_token_loader
def expired_token_callback(_jwt_header, _jwt_payload):
    return {"message": "Token has expired. Please log in again."}, 401
 
 
@jwt.invalid_token_loader
def invalid_token_callback(reason):
    return {"message": "Invalid token.", "error": reason}, 422
 
 
@jwt.unauthorized_loader
def missing_token_callback(reason):
    return {"message": "Missing authentication token.", "error": reason}, 401
 
 
@jwt.revoked_token_loader
def revoked_token_callback(_jwt_header, _jwt_payload):
    return {"message": "Token has been revoked. Please log in again."}, 401