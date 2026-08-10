from datetime import datetime, timezone
import re
from flask import current_app as app, jsonify, request, abort, send_from_directory
from sqlalchemy import or_
from .models import User, Trek, StaffProfile, Booking
from flask_jwt_extended import create_access_token, current_user, jwt_required, get_jwt
from functools import wraps
from .database import db
from .constants import BookingStatus, PaymentStatus, Role, StaffStatus, TrekDifficulty, TrekStatus
from .security import jwt_blocklist
from celery.result import AsyncResult
from .tasks import export_user_bookings_csv, send_monthly_report
from .mail import send_email
from .cache import (
    _serialize_staff,
    _serialize_trek,
    build_admin_analytics_payload,
    build_admin_dashboard_payload,
    build_admin_staff_payload,
    build_admin_treks_payload,
    build_admin_users_payload,
    build_public_stats_payload,
    build_public_treks_payload,
    cached_admin_analytics,
    cached_admin_dashboard,
    cached_admin_staff,
    cached_admin_treks,
    cached_admin_users,
    cached_public_stats,
    cached_public_treks,
    invalidate_staff_caches,
    invalidate_trek_caches,
    invalidate_user_caches,
)

_EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")

def _send_booking_confirmation(user, trek):
    """Send a booking confirmation email. Failures are logged but never re-raised."""
    html = (
        f"<h3>Hi {user.username},</h3>"
        f"<p>Your booking for <strong>{trek.name}</strong> has been confirmed!</p>"
        "<table cellpadding='6' style='border-collapse:collapse;'>"
        f"<tr><td><strong>Location:</strong></td><td>{trek.location or 'TBA'}</td></tr>"
        f"<tr><td><strong>Difficulty:</strong></td><td style='text-transform:capitalize'>{trek.difficulty}</td></tr>"
        f"<tr><td><strong>Duration:</strong></td><td>{trek.duration_days} day(s)</td></tr>"
        f"<tr><td><strong>Start Date:</strong></td><td>{trek.start_date.isoformat() if trek.start_date else 'TBA'}</td></tr>"
        f"<tr><td><strong>End Date:</strong></td><td>{trek.end_date.isoformat() if trek.end_date else 'TBA'}</td></tr>"
        "</table>"
        "<p>See you on the trail! &mdash; Silver Fortnight Trekking Team</p>"
    )
    try:
        send_email(user.email, subject=f"Booking Confirmed: {trek.name}", message=html)
    except Exception:
        app.logger.exception("Failed to send booking confirmation email; booking still recorded.")


def _send_cancellation_notification(user, trek, cancelled_by="user"):
    """Send a cancellation notification email. Failures are logged but never re-raised."""
    if cancelled_by == "staff":
        reason = (
            "<p>Your booking has been cancelled by the Trek Staff. "
            "Please contact the administrator if you have any questions.</p>"
        )
    else:
        reason = "<p>You have successfully cancelled your booking.</p>"
    html = (
        f"<h3>Hi {user.username},</h3>"
        f"<p>Your booking for <strong>{trek.name}</strong> has been cancelled.</p>"
        f"{reason}"
        "<p>&mdash; Silver Fortnight Trekking Team</p>"
    )
    try:
        send_email(user.email, subject=f"Booking Cancelled: {trek.name}", message=html)
    except Exception:
        app.logger.exception("Failed to send cancellation notification email; booking still cancelled.")


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
    if not email or not _EMAIL_RE.match(email):
        errors["email"] = "A valid email address is required."
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
    invalidate_user_caches()
 
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


@app.route("/api/public/stats", methods=["GET"])
def public_stats():
    """Read-only trekking statistics for the public landing dashboard.
    No authentication required; only aggregates are exposed."""
    try:
        payload = cached_public_stats()
    except Exception:
        app.logger.exception("Cache read failed; serving fresh public stats.")
        payload = build_public_stats_payload()
    return jsonify(**payload)


def _serialize_participant(booking):
    d = booking.to_dict()
    d["username"] = booking.user.username
    d["email"] = booking.user.email
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
            try:
                staff_id = int(staff_id)
            except (TypeError, ValueError):
                staff_id = None
                errors["assigned_staff_id"] = "Assigned staff must be a valid staff member."
            if staff_id is not None:
                staff = db.session.get(StaffProfile, staff_id)
                if not staff:
                    errors["assigned_staff_id"] = "Selected staff member was not found."
                fields["assigned_staff_id"] = staff_id
            else:
                fields["assigned_staff_id"] = None

    return fields, errors


@app.route("/api/admin/dashboard", methods=["GET"])
@role_required(Role.ADMIN)
def admin_dashboard():
    try:
        payload = cached_admin_dashboard()
    except Exception:
        app.logger.exception("Cache read failed; serving fresh admin dashboard stats.")
        payload = build_admin_dashboard_payload()
    return jsonify(**payload)


@app.route("/api/admin/analytics", methods=["GET"])
@role_required(Role.ADMIN)
def admin_analytics():
    try:
        payload = cached_admin_analytics()
    except Exception:
        app.logger.exception("Cache read failed; serving fresh admin analytics.")
        payload = build_admin_analytics_payload()
    return jsonify(**payload)


@app.route("/api/admin/treks", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_treks():
    q = (request.args.get("q") or "").strip()[:50]
    status = (request.args.get("status") or "").strip().lower()
    difficulty = (request.args.get("difficulty") or "").strip().lower()

    try:
        treks = cached_admin_treks(q, status, difficulty)
    except Exception:
        app.logger.exception("Cache read failed; serving fresh admin trek list.")
        treks = build_admin_treks_payload(q, status, difficulty)
    return jsonify(treks=treks)


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
    invalidate_trek_caches()
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
    invalidate_trek_caches()
    return jsonify(message="Trek updated.", trek=_serialize_trek(trek))


@app.route("/api/admin/treks/<int:trek_id>", methods=["DELETE"])
@role_required(Role.ADMIN)
def admin_delete_trek(trek_id):
    trek = db.session.get(Trek, trek_id)
    if not trek:
        return jsonify(message="Trek not found."), 404
    if trek.bookings:
        return jsonify(
            message="This trek has booking history and cannot be deleted. "
            "Set its status to Closed instead to preserve trekking records."
        ), 409

    db.session.delete(trek)
    db.session.commit()
    invalidate_trek_caches()
    return jsonify(message="Trek deleted.")


@app.route("/api/admin/staff", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_staff():
    q = (request.args.get("q") or "").strip()[:50]

    try:
        staff = cached_admin_staff(q)
    except Exception:
        app.logger.exception("Cache read failed; serving fresh staff list.")
        staff = build_admin_staff_payload(q)
    return jsonify(staff=staff)


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
    invalidate_staff_caches()
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
    invalidate_staff_caches()
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
    invalidate_staff_caches()
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
    invalidate_staff_caches()
    return jsonify(message="Staff member removed.")


@app.route("/api/admin/users", methods=["GET"])
@role_required(Role.ADMIN)
def admin_list_users():
    q = (request.args.get("q") or "").strip()[:50]

    try:
        users = cached_admin_users(q)
    except Exception:
        app.logger.exception("Cache read failed; serving fresh user list.")
        users = build_admin_users_payload(q)
    return jsonify(users=users)


@app.route("/api/admin/users/<int:user_id>/toggle-active", methods=["POST"])
@role_required(Role.ADMIN)
def admin_toggle_user_active(user_id):
    user = db.session.get(User, user_id)
    if not user or user.role != Role.USER:
        return jsonify(message="User not found."), 404

    user.is_active = not user.is_active
    db.session.commit()
    invalidate_user_caches()
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

    trek_id = request.args.get("trek_id", type=int)
    if trek_id is not None:
        query = query.filter(Booking.trek_id == trek_id)

    user_id = request.args.get("user_id", type=int)
    if user_id is not None:
        query = query.filter(Booking.user_id == user_id)

    bookings = query.order_by(Booking.booking_date.desc()).all()
    result = []
    for b in bookings:
        d = b.to_dict()
        d["username"] = b.user.username
        d["email"] = b.user.email
        d["trek_name"] = b.trek.name
        d["trek_location"] = b.trek.location
        d["trek_status"] = b.trek.status
        result.append(d)
    return jsonify(bookings=result)


@app.route("/api/admin/reports/monthly/run", methods=["POST"])
@role_required(Role.ADMIN)
def admin_trigger_monthly_report():
    task = send_monthly_report.delay()
    return jsonify(message="Monthly report job triggered. Admins will receive it by email.", task_id=task.id), 202


STAFF_EDITABLE_STATUSES = (TrekStatus.OPEN, TrekStatus.CLOSED, TrekStatus.COMPLETED)


def _current_staff_profile():
    return current_user.staff_profile


def _staff_owned_trek_or_error(trek_id):
    staff = _current_staff_profile()
    trek = db.session.get(Trek, trek_id)
    if not trek:
        return None, (jsonify(message="Trek not found."), 404)
    if not staff or trek.assigned_staff_id != staff.id:
        return None, (jsonify(message="You can only manage treks assigned to you."), 403)
    return trek, None


def _validate_staff_trek_payload(data):
    errors = {}
    fields = {}

    if "available_slots" in data:
        try:
            slots = int(data.get("available_slots"))
            if slots < 0:
                raise ValueError
            fields["available_slots"] = slots
        except (TypeError, ValueError):
            errors["available_slots"] = "Available slots must be zero or a positive number."

    if "status" in data:
        status = (data.get("status") or "").strip().lower()
        if status not in STAFF_EDITABLE_STATUSES:
            errors["status"] = f"Status must be one of: {', '.join(STAFF_EDITABLE_STATUSES)}."
        else:
            fields["status"] = status

    if not fields and not errors:
        errors["_general"] = "Nothing to update."

    return fields, errors


@app.route("/api/staff/dashboard", methods=["GET"])
@role_required(Role.STAFF)
def staff_dashboard():
    staff = _current_staff_profile()
    if not staff:
        return jsonify(message="No staff profile found for this account."), 404

    treks = staff.assigned_treks
    treks_by_status = {status: 0 for status in TrekStatus.ALL}
    total_registered = 0
    total_available_slots = 0
    for trek in treks:
        treks_by_status[trek.status] = treks_by_status.get(trek.status, 0) + 1
        total_registered += sum(1 for b in trek.bookings if b.status != BookingStatus.CANCELLED)
        total_available_slots += trek.available_slots

    return jsonify(
        assigned_treks=len(treks),
        total_registered_trekkers=total_registered,
        total_available_slots=total_available_slots,
        treks_by_status=treks_by_status,
    )


@app.route("/api/staff/treks", methods=["GET"])
@role_required(Role.STAFF)
def staff_list_treks():
    staff = _current_staff_profile()
    if not staff:
        return jsonify(message="No staff profile found for this account."), 404

    treks = sorted(staff.assigned_treks, key=lambda t: t.created_at, reverse=True)
    return jsonify(treks=[_serialize_trek(t) for t in treks])


@app.route("/api/staff/treks/<int:trek_id>", methods=["PUT"])
@role_required(Role.STAFF)
def staff_update_trek(trek_id):
    trek, error = _staff_owned_trek_or_error(trek_id)
    if error:
        return error

    data = request.get_json(silent=True) or {}
    fields, errors = _validate_staff_trek_payload(data)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400

    for key, value in fields.items():
        setattr(trek, key, value)

    if fields.get("status") == TrekStatus.COMPLETED:
        for booking in trek.bookings:
            if booking.status == BookingStatus.BOOKED:
                booking.status = BookingStatus.COMPLETED

    db.session.commit()
    invalidate_trek_caches()
    return jsonify(message="Trek updated.", trek=_serialize_trek(trek))


@app.route("/api/staff/treks/<int:trek_id>/participants", methods=["GET"])
@role_required(Role.STAFF)
def staff_trek_participants(trek_id):
    trek, error = _staff_owned_trek_or_error(trek_id)
    if error:
        return error

    bookings = sorted(trek.bookings, key=lambda b: b.booking_date, reverse=True)
    return jsonify(
        trek=_serialize_trek(trek),
        participants=[_serialize_participant(b) for b in bookings],
    )


@app.route("/api/staff/treks/<int:trek_id>/participants/<int:booking_id>/cancel", methods=["POST"])
@role_required(Role.STAFF)
def staff_cancel_participant(trek_id, booking_id):
    trek, error = _staff_owned_trek_or_error(trek_id)
    if error:
        return error

    booking = db.session.get(Booking, booking_id)
    if not booking or booking.trek_id != trek.id:
        return jsonify(message="Booking not found."), 404
    if booking.status != BookingStatus.BOOKED:
        return jsonify(message="Only active bookings can be cancelled."), 400

    booking.status = BookingStatus.CANCELLED
    trek.available_slots += 1
    db.session.commit()
    invalidate_trek_caches()

    _send_cancellation_notification(booking.user, trek, cancelled_by="staff")

    return jsonify(
        message="Booking cancelled.",
        trek=_serialize_trek(trek),
        participant=_serialize_participant(booking),
    )


def _serialize_user_booking(booking):
    d = booking.to_dict()
    trek = booking.trek
    d["trek_name"] = trek.name
    d["trek_location"] = trek.location
    d["trek_difficulty"] = trek.difficulty
    d["trek_status"] = trek.status
    d["trek_duration_days"] = trek.duration_days
    d["trek_start_date"] = trek.start_date.isoformat() if trek.start_date else None
    d["trek_end_date"] = trek.end_date.isoformat() if trek.end_date else None
    return d


def _user_latest_booking_for_trek(trek_id):
    return (
        Booking.query.filter_by(user_id=current_user.id, trek_id=trek_id)
        .order_by(Booking.booking_date.desc())
        .first()
    )


def _serialize_user_trek(trek):
    d = _serialize_trek(trek)
    latest = _user_latest_booking_for_trek(trek.id)
    if latest and latest.status != BookingStatus.CANCELLED:
        d["user_booking_status"] = latest.status
        d["user_booking_id"] = latest.id
    else:
        d["user_booking_status"] = None
        d["user_booking_id"] = None
    return d


@app.route("/api/user/dashboard", methods=["GET"])
@role_required(Role.USER)
def user_dashboard():
    bookings = current_user.bookings
    bookings_by_status = {status: 0 for status in BookingStatus.ALL}
    for b in bookings:
        bookings_by_status[b.status] = bookings_by_status.get(b.status, 0) + 1

    available_treks = Trek.query.filter(
        Trek.status == TrekStatus.OPEN, Trek.available_slots > 0
    ).count()

    upcoming = (
        Booking.query.join(Trek, Booking.trek_id == Trek.id)
        .filter(
            Booking.user_id == current_user.id,
            Booking.status == BookingStatus.BOOKED,
            Trek.start_date.isnot(None),
        )
        .order_by(Trek.start_date.asc())
        .first()
    )

    return jsonify(
        available_treks=available_treks,
        total_bookings=len(bookings),
        bookings_by_status=bookings_by_status,
        next_trek=_serialize_user_booking(upcoming) if upcoming else None,
    )


@app.route("/api/user/treks", methods=["GET"])
@role_required(Role.USER)
def user_list_treks():
    q = (request.args.get("q") or "").strip()[:50]
    difficulty = (request.args.get("difficulty") or "").strip().lower()
    min_duration = request.args.get("min_duration", type=int)
    max_duration = request.args.get("max_duration", type=int)
    try:
        base_rows = cached_public_treks(q, difficulty, min_duration, max_duration)
    except Exception:
        app.logger.exception("Cache read failed; serving fresh trek listing.")
        base_rows = build_public_treks_payload(q, difficulty, min_duration, max_duration)

    latest_by_trek = {}
    user_bookings = (
        Booking.query.filter(Booking.user_id == current_user.id)
        .order_by(Booking.booking_date.desc())
        .all()
    )
    for booking in user_bookings:
        latest_by_trek.setdefault(booking.trek_id, booking)

    treks = []
    for row in base_rows:
        d = dict(row)
        latest = latest_by_trek.get(d["id"])
        if latest and latest.status != BookingStatus.CANCELLED:
            d["user_booking_status"] = latest.status
            d["user_booking_id"] = latest.id
        else:
            d["user_booking_status"] = None
            d["user_booking_id"] = None
        treks.append(d)
    return jsonify(treks=treks)


@app.route("/api/user/treks/<int:trek_id>/book", methods=["POST"])
@role_required(Role.USER)
def user_book_trek(trek_id):
    trek = db.session.get(Trek, trek_id)
    if not trek:
        return jsonify(message="Trek not found."), 404

    if trek.status != TrekStatus.OPEN:
        return jsonify(message="This trek is not open for booking."), 400
    if trek.available_slots <= 0:
        return jsonify(message="No slots available for this trek."), 400

    existing = Booking.query.filter_by(
        user_id=current_user.id, trek_id=trek.id, status=BookingStatus.BOOKED
    ).first()
    if existing:
        return jsonify(message="You already have an active booking for this trek."), 409

    booking = Booking(
        user_id=current_user.id,
        trek_id=trek.id,
        status=BookingStatus.BOOKED,
        payment_status=PaymentStatus.PENDING,
    )
    trek.available_slots -= 1
    db.session.add(booking)
    db.session.commit()
    invalidate_trek_caches()

    _send_booking_confirmation(current_user, trek)

    return jsonify(
        message="Trek booked successfully.",
        booking=_serialize_user_booking(booking),
        trek=_serialize_user_trek(trek),
    ), 201


@app.route("/api/user/bookings", methods=["GET"])
@role_required(Role.USER)
def user_list_bookings():
    query = Booking.query.filter_by(user_id=current_user.id)

    status = (request.args.get("status") or "").strip().lower()
    if status:
        query = query.filter(Booking.status == status)

    bookings = query.order_by(Booking.booking_date.desc()).all()
    return jsonify(bookings=[_serialize_user_booking(b) for b in bookings])


@app.route("/api/user/bookings/<int:booking_id>/cancel", methods=["POST"])
@role_required(Role.USER)
def user_cancel_booking(booking_id):
    booking = db.session.get(Booking, booking_id)
    if not booking or booking.user_id != current_user.id:
        return jsonify(message="Booking not found."), 404
    if booking.status != BookingStatus.BOOKED:
        return jsonify(message="Only active bookings can be cancelled."), 400

    booking.status = BookingStatus.CANCELLED
    booking.trek.available_slots += 1
    db.session.commit()
    invalidate_trek_caches()

    _send_cancellation_notification(current_user, booking.trek, cancelled_by="user")

    return jsonify(message="Booking cancelled.", booking=_serialize_user_booking(booking))


def _simulate_payment_amount(trek):
    """Simulated trek fee: ₹500 per trek day."""
    return trek.duration_days * 500


def _send_payment_receipt(user, trek, amount):
    html = (
        f"<h3>Hi {user.username},</h3>"
        f"<p>We received your payment of <strong>₹{amount}</strong> for "
        f"<strong>{trek.name}</strong>.</p>"
        "<p>This was a simulated transaction &mdash; no real money was charged.</p>"
        "<p>See you on the trail! &mdash; Silver Fortnight Trekking Team</p>"
    )
    try:
        send_email(user.email, subject=f"Payment Received: {trek.name}", message=html)
    except Exception:
        app.logger.exception("Failed to send payment receipt email; payment still recorded.")


_EXPIRY_RE = re.compile(r"^(0[1-9]|1[0-2])/(\d{2})$")


def _validate_payment_payload(data):
    errors = {}

    card_number = re.sub(r"[\s-]", "", str(data.get("card_number") or ""))
    if not card_number.isdigit() or len(card_number) != 16:
        errors["card_number"] = "Card number must be exactly 16 digits."

    if not (data.get("card_name") or "").strip():
        errors["card_name"] = "Name on card is required."

    expiry = (data.get("expiry") or "").strip()
    match = _EXPIRY_RE.match(expiry)
    if not match:
        errors["expiry"] = "Expiry must be in MM/YY format."
    else:
        exp_month, exp_year = int(match.group(1)), 2000 + int(match.group(2))
        now = datetime.now(timezone.utc)
        if (exp_year, exp_month) < (now.year, now.month):
            errors["expiry"] = "This card has expired."

    cvv = str(data.get("cvv") or "").strip()
    if not cvv.isdigit() or len(cvv) not in (3, 4):
        errors["cvv"] = "CVV must be 3 or 4 digits."

    return card_number, errors


@app.route("/api/user/bookings/<int:booking_id>/pay", methods=["POST"])
@role_required(Role.USER)
def user_pay_booking(booking_id):
    """Optional payment simulation: validates card details, then simulates a
    payment gateway. Card numbers ending in 0000 are declined; everything
    else succeeds. No real charge is ever made."""
    booking = db.session.get(Booking, booking_id)
    if not booking or booking.user_id != current_user.id:
        return jsonify(message="Booking not found."), 404
    if booking.status != BookingStatus.BOOKED:
        return jsonify(message="Only active bookings can be paid."), 400
    if booking.payment_status == PaymentStatus.PAID:
        return jsonify(message="This booking has already been paid."), 400

    data = request.get_json(silent=True) or {}
    card_number, errors = _validate_payment_payload(data)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400

    trek = booking.trek
    amount = _simulate_payment_amount(trek)

    if card_number.endswith("0000"):
        booking.payment_status = PaymentStatus.FAILED
        db.session.commit()
        return jsonify(
            message="Payment was declined by the (simulated) gateway. Please try another card.",
            booking=_serialize_user_booking(booking),
        ), 402

    booking.payment_status = PaymentStatus.PAID
    db.session.commit()
    invalidate_trek_caches()

    _send_payment_receipt(current_user, trek, amount)

    return jsonify(
        message="Payment successful. Your booking is confirmed.",
        amount=amount,
        booking=_serialize_user_booking(booking),
    )


def _validate_profile_update_payload(data, user):
    errors = {}
    fields = {}

    if "username" in data:
        username = (data.get("username") or "").strip()
        if not username or len(username) < 3:
            errors["username"] = "Username is required and must be at least 3 characters."
        elif User.query.filter(User.username == username, User.id != user.id).first():
            errors["username"] = "That username is already taken."
        else:
            fields["username"] = username

    if "email" in data:
        email = (data.get("email") or "").strip().lower()
        if not email or "@" not in email:
            errors["email"] = "A valid email is required."
        elif User.query.filter(User.email == email, User.id != user.id).first():
            errors["email"] = "That email is already registered."
        else:
            fields["email"] = email

    new_password = data.get("new_password") or ""
    if new_password:
        current_password = data.get("current_password") or ""
        if not current_password or not user.check_password(current_password):
            errors["current_password"] = "Current password is incorrect."
        elif len(new_password) < 6:
            errors["new_password"] = "New password must be at least 6 characters."
        else:
            fields["_new_password"] = new_password

    return fields, errors


@app.route("/api/user/profile", methods=["PUT"])
@role_required(Role.USER)
def user_update_profile():
    data = request.get_json(silent=True) or {}
    fields, errors = _validate_profile_update_payload(data, current_user)
    if errors:
        return jsonify(message="Validation failed.", errors=errors), 400

    new_password = fields.pop("_new_password", None)
    for key, value in fields.items():
        setattr(current_user, key, value)
    if new_password:
        current_user.set_password(new_password)

    db.session.commit()

    invalidate_user_caches()
    return jsonify(message="Profile updated.", user=current_user.to_dict())


@app.route("/api/user/bookings/export", methods=["POST"])
@role_required(Role.USER)
def user_export_bookings_csv():
    """Kick off an async job that writes the current user's booking history
    to a CSV file. The frontend should poll the status endpoint below with
    the returned task_id, then hit the download endpoint once ready."""
    task = export_user_bookings_csv.delay(current_user.id)
    return jsonify(message="Export started. We'll email you when it's ready.", task_id=task.id), 202


@app.route("/api/user/bookings/export/<task_id>", methods=["GET"])
@role_required(Role.USER)
def user_export_bookings_status(task_id):
    result = AsyncResult(task_id)
    if not result.ready():
        return jsonify(status=result.status, ready=False)

    payload = result.result
    if isinstance(payload, dict) and payload.get("error"):
        return jsonify(status="FAILURE", ready=True, message=payload["error"]), 400

    filename = payload.get("filename") if isinstance(payload, dict) else None
    return jsonify(status=result.status, ready=True, filename=filename)


@app.route("/api/user/bookings/export/<task_id>/download", methods=["GET"])
@role_required(Role.USER)
def user_export_bookings_download(task_id):
    result = AsyncResult(task_id)
    if not result.ready() or not isinstance(result.result, dict):
        return jsonify(message="Export is not ready yet."), 400

    filename = result.result.get("filename")
    if not filename or f"user{current_user.id}_" not in filename:
        return jsonify(message="Export not found."), 404

    return send_from_directory(app.config["EXPORT_DIR"], filename, as_attachment=True)