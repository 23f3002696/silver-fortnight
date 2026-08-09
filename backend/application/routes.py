from flask import current_app as app, jsonify, request, abort
from .models import User
from flask_jwt_extended import create_access_token, current_user, jwt_required, get_jwt
from functools import wraps
from .database import db
from .constants import Role
from .security import jwt_blocklist

def role_required(*roles):
    def wrapper(func):
        @jwt_required()
        @wraps(func)
        def decorator(*args, **kwargs):
            if current_user is None or not current_user.is_active:
                return jsonify(message="Your account is inactive. Contact an administrator."), 403
            if current_user.role not in roles:
                return jsonify(message="You are not authorized to perform this action."), 403
            return func(*args, **kwargs)
        return decorator
    return wrapper

def _validate_registration_payload(data):
    username = (data.get("username") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
 
    errors = {}
    if not username or len(username) < 3:
        errors["username"] = "Username is required and must be at least 3 characters."
    if not email or "@" not in email:
        errors["email"] = "A valid email is required."
    if not password or len(password) < 6:
        errors["password"] = "Password is required and must be at least 6 characters."
 
    return username, email, password, errors

@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    username, email, password, errors = _validate_registration_payload(data)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400
 
    if User.query.filter_by(username=username).first():
        return jsonify(message="That username is already taken."), 409
    if User.query.filter_by(email=email).first():
        return jsonify(message="That email is already registered."), 409
 
    user = User(username=username, email=email, role=Role.USER)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
 
    access_token = create_access_token(identity=user, additional_claims={"role": user.role})
    return jsonify(
        message="Registration successful.",
        access_token=access_token,
        user=user.to_dict(),
    ), 201
 
 
@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
 
    if not username or not password:
        return jsonify(message="Username and password are required."), 400
 
    user = User.query.filter_by(username=username).one_or_none()
    if not user or not user.check_password(password):
        return jsonify(message="Wrong username or password."), 401
 
    if not user.is_active:
        return jsonify(message="Your account has been deactivated. Contact an administrator."), 403
 
    access_token = create_access_token(identity=user, additional_claims={"role": user.role})
    return jsonify(access_token=access_token, user=user.to_dict())
 
 
@app.route("/api/auth/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    jwt_blocklist.add(jti)
    return jsonify(message="Successfully logged out.")
 
 
@app.route("/api/auth/me", methods=["GET"])
@jwt_required()
def me():
    return jsonify(user=current_user.to_dict())

 
@app.route("/api/admin/dashboard", methods=["GET"])
@role_required(Role.ADMIN)
def admin_dashboard():
    return jsonify(message=f"Welcome, {current_user.username}. (Admin dashboard data comes in the next milestone.)")
 
 
@app.route("/api/staff/dashboard", methods=["GET"])
@role_required(Role.STAFF)
def staff_dashboard():
    return jsonify(message=f"Welcome, {current_user.username}. (Trek Staff dashboard data comes in a later milestone.)")
 
 
@app.route("/api/user/dashboard", methods=["GET"])
@role_required(Role.USER)
def user_dashboard():
    return jsonify(message=f"Welcome, {current_user.username}. (Trekker dashboard data comes in a later milestone.)")