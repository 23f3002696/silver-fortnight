from datetime import datetime
from flask import current_app as app, jsonify, request, abort
from sqlalchemy import or_
from .models import User, Trek, StaffProfile, Booking
from flask_jwt_extended import create_access_token, current_user, jwt_required, get_jwt
from functools import wraps
from .database import db
from .constants import Role, StaffStatus, TrekDifficulty, TrekStatus
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

 
def _serialize_trek(trek):
    d = trek.to_dict()
    if trek.assigned_staff:
        d["assigned_staff_name"] = trek.assigned_staff.name or trek.assigned_staff.user.username
    else:
        d["assigned_staff_name"] = None
    d["bookings_count"] = len(trek.bookings)
    return d


def _serialize_staff(staff):
    d = staff.to_dict()
    d["username"] = staff.user.username
    d["email"] = staff.user.email
    d["is_active"] = staff.user.is_active
    d["assigned_treks_count"] = len(staff.assigned_treks)
    return d


def _parse_date(value):
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _validate_trek_payload(data, partial=False):
    errors = {}
    fields = {}

    if not partial or "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            errors["name"] = "Trek name is required."
        fields["name"] = name

    if not partial or "difficulty" in data:
        difficulty = (data.get("difficulty") or "").strip().lower()
        if difficulty not in TrekDifficulty.ALL:
            errors["difficulty"] = f"Difficulty must be one of: {', '.join(TrekDifficulty.ALL)}."
        fields["difficulty"] = difficulty

    if not partial or "status" in data:
        status = (data.get("status") or TrekStatus.PENDING).strip().lower()
        if status not in TrekStatus.ALL:
            errors["status"] = f"Status must be one of: {', '.join(TrekStatus.ALL)}."
        fields["status"] = status

    if not partial or "duration_days" in data:
        duration = None
        try:
            duration = int(data.get("duration_days"))
            if duration <= 0:
                raise ValueError
        except (TypeError, ValueError):
            errors["duration_days"] = "Duration must be a positive number of days."
        fields["duration_days"] = duration

    if not partial or "available_slots" in data:
        slots = None
        try:
            slots = int(data.get("available_slots"))
            if slots < 0:
                raise ValueError
        except (TypeError, ValueError):
            errors["available_slots"] = "Available slots must be zero or a positive number."
        fields["available_slots"] = slots

    if not partial or "location" in data:
        fields["location"] = (data.get("location") or "").strip() or None
    if not partial or "description" in data:
        fields["description"] = (data.get("description") or "").strip() or None

    if not partial or "start_date" in data:
        fields["start_date"] = _parse_date(data.get("start_date"))
    if not partial or "end_date" in data:
        fields["end_date"] = _parse_date(data.get("end_date"))
    if fields.get("start_date") and fields.get("end_date") and fields["end_date"] < fields["start_date"]:
        errors["end_date"] = "End date cannot be before the start date."

    if not partial or "assigned_staff_id" in data:
        staff_id = data.get("assigned_staff_id")
        if staff_id in ("", None):
            fields["assigned_staff_id"] = None
        else:
            staff = db.session.get(StaffProfile, staff_id)
            if not staff:
                errors["assigned_staff_id"] = "Selected staff member was not found."
            fields["assigned_staff_id"] = staff_id

    return fields, errors


@app.route("/api/admin/dashboard", methods=["GET"])
@role_required(Role.ADMIN)
def admin_dashboard():
    treks_by_status = {status: Trek.query.filter_by(status=status).count() for status in TrekStatus.ALL}

    return jsonify(
        total_treks=Trek.query.count(),
        total_users=User.query.filter_by(role=Role.USER).count(),
        total_staff=User.query.filter_by(role=Role.STAFF).count(),
        total_bookings=Booking.query.count(),
        treks_by_status=treks_by_status,
    )


@app.route("/api/admin/treks", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_treks():
    query = Trek.query

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(or_(Trek.name.ilike(like), Trek.location.ilike(like)))

    status = (request.args.get("status") or "").strip().lower()
    if status:
        query = query.filter_by(status=status)

    difficulty = (request.args.get("difficulty") or "").strip().lower()
    if difficulty:
        query = query.filter_by(difficulty=difficulty)

    treks = query.order_by(Trek.created_at.desc()).all()
    return jsonify(treks=[_serialize_trek(t) for t in treks])


@app.route("/api/admin/treks", methods=["POST"])
@role_required(Role.ADMIN)
def admin_create_trek():
    data = request.get_json(silent=True) or {}
    fields, errors = _validate_trek_payload(data)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400

    trek = Trek(**fields)
    db.session.add(trek)
    db.session.commit()
    return jsonify(message="Trek created.", trek=_serialize_trek(trek)), 201


@app.route("/api/admin/treks/<int:trek_id>", methods=["PUT"])
@role_required(Role.ADMIN)
def admin_update_trek(trek_id):
    trek = db.session.get(Trek, trek_id)
    if not trek:
        return jsonify(message="Trek not found."), 404

    data = request.get_json(silent=True) or {}
    fields, errors = _validate_trek_payload(data, partial=True)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400

    for key, value in fields.items():
        setattr(trek, key, value)
    db.session.commit()
    return jsonify(message="Trek updated.", trek=_serialize_trek(trek))


@app.route("/api/admin/treks/<int:trek_id>", methods=["DELETE"])
@role_required(Role.ADMIN)
def admin_delete_trek(trek_id):
    trek = db.session.get(Trek, trek_id)
    if not trek:
        return jsonify(message="Trek not found."), 404

    db.session.delete(trek)
    db.session.commit()
    return jsonify(message="Trek deleted.")


@app.route("/api/admin/staff", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_staff():
    query = StaffProfile.query.join(User)

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(User.username.ilike(like), User.email.ilike(like), StaffProfile.name.ilike(like))
        )

    staff_members = query.order_by(User.username).all()
    return jsonify(staff=[_serialize_staff(s) for s in staff_members])


@app.route("/api/admin/staff", methods=["POST"])
@role_required(Role.ADMIN)
def admin_create_staff():
    data = request.get_json(silent=True) or {}
    username, email, password, errors = _validate_registration_payload(data)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400
    if User.query.filter_by(username=username).first():
        return jsonify(message="That username is already taken."), 409
    if User.query.filter_by(email=email).first():
        return jsonify(message="That email is already registered."), 409

    staff_user = User(username=username, email=email, role=Role.STAFF)
    staff_user.set_password(password)
    staff_user.staff_profile = StaffProfile(
        name=(data.get("name") or "").strip() or None,
        contact_number=(data.get("contact_number") or "").strip() or None,
        status=StaffStatus.ACTIVE,
    )
    db.session.add(staff_user)
    db.session.commit()
    return jsonify(
        message="Trek Staff account created.", staff=_serialize_staff(staff_user.staff_profile)
    ), 201


@app.route("/api/admin/staff/<int:staff_id>", methods=["PUT"])
@role_required(Role.ADMIN)
def admin_update_staff(staff_id):
    staff = db.session.get(StaffProfile, staff_id)
    if not staff:
        return jsonify(message="Staff member not found."), 404

    data = request.get_json(silent=True) or {}
    if "name" in data:
        staff.name = (data.get("name") or "").strip() or None
    if "contact_number" in data:
        staff.contact_number = (data.get("contact_number") or "").strip() or None
    db.session.commit()
    return jsonify(message="Staff member updated.", staff=_serialize_staff(staff))


@app.route("/api/admin/staff/<int:staff_id>/toggle-active", methods=["POST"])
@role_required(Role.ADMIN)
def admin_toggle_staff_active(staff_id):
    staff = db.session.get(StaffProfile, staff_id)
    if not staff:
        return jsonify(message="Staff member not found."), 404

    staff.user.is_active = not staff.user.is_active
    staff.status = StaffStatus.ACTIVE if staff.user.is_active else StaffStatus.DEACTIVATED
    db.session.commit()
    action = "reactivated" if staff.user.is_active else "deactivated"
    return jsonify(message=f"Staff member {action}.", staff=_serialize_staff(staff))


@app.route("/api/admin/staff/<int:staff_id>", methods=["DELETE"])
@role_required(Role.ADMIN)
def admin_delete_staff(staff_id):
    staff = db.session.get(StaffProfile, staff_id)
    if not staff:
        return jsonify(message="Staff member not found."), 404
    if staff.assigned_treks:
        return jsonify(
            message="This staff member is assigned to one or more treks. Reassign those treks first."
        ), 409

    db.session.delete(staff.user)
    db.session.commit()
    return jsonify(message="Staff member removed.")


@app.route("/api/admin/users", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_users():
    query = User.query.filter_by(role=Role.USER)

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(or_(User.username.ilike(like), User.email.ilike(like)))

    users = query.order_by(User.username).all()
    result = []
    for u in users:
        d = u.to_dict()
        d["bookings_count"] = len(u.bookings)
        result.append(d)
    return jsonify(users=result)


@app.route("/api/admin/users/<int:user_id>/toggle-active", methods=["POST"])
@role_required(Role.ADMIN)
def admin_toggle_user_active(user_id):
    user = db.session.get(User, user_id)
    if not user or user.role != Role.USER:
        return jsonify(message="User not found."), 404

    user.is_active = not user.is_active
    db.session.commit()
    action = "reactivated" if user.is_active else "blacklisted"
    return jsonify(message=f"User {action}.", user=user.to_dict())



@app.route("/api/admin/bookings", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_bookings():
    query = Booking.query.join(User, Booking.user_id == User.id).join(Trek, Booking.trek_id == Trek.id)

    q = (request.args.get("q") or "").strip()
    if q:
        like = f"%{q}%"
        query = query.filter(or_(User.username.ilike(like), Trek.name.ilike(like)))

    status = (request.args.get("status") or "").strip().lower()
    if status:
        query = query.filter(Booking.status == status)

    bookings = query.order_by(Booking.booking_date.desc()).all()
    result = []
    for b in bookings:
        d = b.to_dict()
        d["username"] = b.user.username
        d["trek_name"] = b.trek.name
        result.append(d)
    return jsonify(bookings=result)


@app.route("/api/staff/dashboard", methods=["GET"])
@role_required(Role.STAFF)
def staff_dashboard():
    return jsonify(message=f"Welcome, {current_user.username}. (Trek Staff dashboard data comes in a later milestone.)")
 
 
@app.route("/api/user/dashboard", methods=["GET"])
@role_required(Role.USER)
def user_dashboard():
    return jsonify(message=f"Welcome, {current_user.username}. (Trekker dashboard data comes in a later milestone.)")