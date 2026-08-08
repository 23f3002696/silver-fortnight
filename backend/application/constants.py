class Role:
    ADMIN = "admin"
    STAFF = "staff"
    USER = "user"

    ALL = (ADMIN, STAFF, USER)


class TrekDifficulty:
    EASY = "easy"
    MODERATE = "moderate"
    HARD = "hard"

    ALL = (EASY, MODERATE, HARD)


class TrekStatus:
    PENDING = "pending"
    APPROVED = "approved"
    OPEN = "open"
    CLOSED = "closed"
    COMPLETED = "completed"

    ALL = (PENDING, APPROVED, OPEN, CLOSED, COMPLETED)


class StaffStatus:
    ACTIVE = "active"
    DEACTIVATED = "deactivated"

    ALL = (ACTIVE, DEACTIVATED)


class BookingStatus:
    BOOKED = "booked"
    CANCELLED = "cancelled"
    COMPLETED = "completed"

    ALL = (BOOKED, CANCELLED, COMPLETED)


class PaymentStatus:
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"

    ALL = (NOT_REQUIRED, PENDING, PAID, FAILED)
