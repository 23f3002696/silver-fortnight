from .database import db
from .constants import BookingStatus, PaymentStatus, Role, StaffStatus, TrekDifficulty, TrekStatus
from datetime import datetime, timezone
from werkzeug.security import check_password_hash, generate_password_hash


def utc_now():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "user"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default=Role.USER)

    # Admin's "blacklist/deactivate users or staff" functionality.
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    # User (role=staff) <-> StaffProfile : one-to-one
    staff_profile = db.relationship(
        "StaffProfile",
        backref="user",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # User (role=user) <-> Booking : one-to-many
    bookings = db.relationship(
        "Booking",
        backref="user",
        lazy=True,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.CheckConstraint(f"role IN {Role.ALL}", name="ck_user_role_valid"),
    )

    # password helpers
    def set_password(self, raw_password):
        self.password = generate_password_hash(raw_password)

    def check_password(self, raw_password):
        return check_password_hash(self.password, raw_password)

    def to_dict(self):
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"


class StaffProfile(db.Model):
    __tablename__ = "staff_profile"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), unique=True, nullable=False)
    name = db.Column(db.String(120))
    contact_number = db.Column(db.String(20))
    status = db.Column(db.String(20), nullable=False, default=StaffStatus.ACTIVE)

    # StaffProfile <-> Trek : one-to-many (a staff member can be assigned
    assigned_treks = db.relationship("Trek", backref="assigned_staff", lazy=True)

    __table_args__ = (
        db.CheckConstraint(f"status IN {StaffStatus.ALL}", name="ck_staff_status_valid"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "contact_number": self.contact_number,
            "status": self.status,
        }

    def __repr__(self):
        return f"<StaffProfile user_id={self.user_id}>"


class Trek(db.Model):
    __tablename__ = "trek"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    location = db.Column(db.String(120))
    difficulty = db.Column(db.String(20), nullable=False, default=TrekDifficulty.EASY)
    duration_days = db.Column(db.Integer, nullable=False)
    available_slots = db.Column(db.Integer, nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default=TrekStatus.PENDING)
    start_date = db.Column(db.Date)
    end_date = db.Column(db.Date)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, nullable=False, default=utc_now)

    # Trek Staff <-> Trek : many-to-one (nullable until admin assigns staff)
    assigned_staff_id = db.Column(db.Integer, db.ForeignKey("staff_profile.id"), nullable=True)

    # Trek <-> Booking : one-to-many
    bookings = db.relationship(
        "Booking",
        backref="trek",
        lazy=True,
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        db.CheckConstraint(f"difficulty IN {TrekDifficulty.ALL}", name="ck_trek_difficulty_valid"),
        db.CheckConstraint(f"status IN {TrekStatus.ALL}", name="ck_trek_status_valid"),
        db.CheckConstraint("available_slots >= 0", name="ck_trek_slots_non_negative"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "difficulty": self.difficulty,
            "duration_days": self.duration_days,
            "available_slots": self.available_slots,
            "status": self.status,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "assigned_staff_id": self.assigned_staff_id,
        }

    def __repr__(self):
        return f"<Trek {self.name}>"


class Booking(db.Model):
    __tablename__ = "booking"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    trek_id = db.Column(db.Integer, db.ForeignKey("trek.id"), nullable=False)
    booking_date = db.Column(db.DateTime, nullable=False, default=utc_now)
    status = db.Column(db.String(20), nullable=False, default=BookingStatus.BOOKED)
    payment_status = db.Column(db.String(20), nullable=False, default=PaymentStatus.NOT_REQUIRED)

    __table_args__ = (
        db.CheckConstraint(f"status IN {BookingStatus.ALL}", name="ck_booking_status_valid"),
        db.CheckConstraint(
            f"payment_status IN {PaymentStatus.ALL}", name="ck_booking_payment_status_valid"
        ),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "trek_id": self.trek_id,
            "booking_date": self.booking_date.isoformat() if self.booking_date else None,
            "status": self.status,
            "payment_status": self.payment_status,
        }

    def __repr__(self):
        return f"<Booking user={self.user_id} trek={self.trek_id}>"
