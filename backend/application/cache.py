import logging
from datetime import date, datetime, time

from flask_caching import Cache
from sqlalchemy import func, or_

from .config import config as _base_config
from .constants import BookingStatus, Role, TrekDifficulty, TrekStatus
from .database import db
from .models import Booking, StaffProfile, Trek, User

logger = logging.getLogger(__name__)


class _FallbackCache(Cache):

    def init_app(self, app):
        if (
            app.config.get("CACHE_TYPE") == "RedisCache"
            and app.config.get("CACHE_FALLBACK_TO_SIMPLE", False)
        ):
            probe = None
            try:
                import redis

                probe = redis.Redis.from_url(
                    app.config.get("CACHE_REDIS_URL"),
                    socket_connect_timeout=1,
                    socket_timeout=1,
                )
                probe.ping()
            except Exception:
                app.logger.warning(
                    "Redis is unreachable (%s); falling back to in-memory SimpleCache. "
                    "Cache coherence is PER-PROCESS in fallback mode: each worker keeps "
                    "its own cache, bounded only by TTL, until Redis is restored and the "
                    "app is restarted.",
                    app.config.get("CACHE_REDIS_URL"),
                )
                app.config["CACHE_TYPE"] = "SimpleCache"
            finally:
                if probe is not None:
                    try:
                        probe.close()
                    except Exception:
                        pass
        super().init_app(app)


cache = _FallbackCache()


def _serialize_trek(trek):
    d = trek.to_dict()
    if trek.assigned_staff:
        d["assigned_staff_name"] = trek.assigned_staff.name or trek.assigned_staff.user.username
    else:
        d["assigned_staff_name"] = None
    d["bookings_count"] = len(trek.bookings)
    d["active_bookings_count"] = sum(1 for b in trek.bookings if b.status != BookingStatus.CANCELLED)
    return d


def _serialize_staff(staff):
    d = staff.to_dict()
    d["username"] = staff.user.username
    d["email"] = staff.user.email
    d["is_active"] = staff.user.is_active
    d["assigned_treks_count"] = len(staff.assigned_treks)
    return d


def _serialize_admin_user(user):
    d = user.to_dict()
    d["bookings_count"] = len(user.bookings)
    return d


def build_public_treks_payload(q, difficulty, min_duration, max_duration):
    query = Trek.query.filter(Trek.status.in_([TrekStatus.APPROVED, TrekStatus.OPEN]))

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Trek.name.ilike(like), Trek.location.ilike(like)))

    if difficulty:
        query = query.filter_by(difficulty=difficulty)

    if min_duration is not None:
        query = query.filter(Trek.duration_days >= min_duration)

    if max_duration is not None:
        query = query.filter(Trek.duration_days <= max_duration)

    treks = query.order_by(Trek.created_at.desc()).all()
    return [_serialize_trek(t) for t in treks]


def build_admin_treks_payload(q, status, difficulty):
    query = Trek.query

    if q:
        like = f"%{q}%"
        query = query.filter(or_(Trek.name.ilike(like), Trek.location.ilike(like)))

    if status:
        query = query.filter_by(status=status)

    if difficulty:
        query = query.filter_by(difficulty=difficulty)

    treks = query.order_by(Trek.created_at.desc()).all()
    return [_serialize_trek(t) for t in treks]


def build_admin_dashboard_payload():
    return {
        "total_treks": Trek.query.count(),
        "total_users": User.query.filter_by(role=Role.USER).count(),
        "total_staff": User.query.filter_by(role=Role.STAFF).count(),
        "total_bookings": Booking.query.count(),
        "treks_by_status": {status: Trek.query.filter_by(status=status).count() for status in TrekStatus.ALL},
    }


def build_admin_staff_payload(q):
    query = StaffProfile.query.join(User)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(User.username.ilike(like), User.email.ilike(like), StaffProfile.name.ilike(like))
        )

    staff_members = query.order_by(User.username).all()
    return [_serialize_staff(s) for s in staff_members]


def build_admin_users_payload(q):
    query = User.query.filter_by(role=Role.USER)

    if q:
        like = f"%{q}%"
        query = query.filter(or_(User.username.ilike(like), User.email.ilike(like)))

    users = query.order_by(User.username).all()
    return [_serialize_admin_user(u) for u in users]


PUBLIC_TREK_STATUSES = (TrekStatus.APPROVED, TrekStatus.OPEN, TrekStatus.CLOSED, TrekStatus.COMPLETED)


def _last_month_keys(months):
    """Return the trailing `months` month keys ('YYYY-MM'), oldest first."""
    year, month = date.today().year, date.today().month
    keys = []
    for _ in range(months):
        keys.append(f"{year:04d}-{month:02d}")
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    keys.reverse()
    return keys


def _month_start(month_key):
    year, month = month_key.split("-")
    return datetime.combine(date(int(year), int(month), 1), time.min)


def _monthly_booking_counts(month_keys):
    month_label = func.strftime("%Y-%m", Booking.booking_date)
    rows = dict(
        db.session.query(month_label.label("month"), func.count(Booking.id).label("cnt"))
        .filter(Booking.booking_date >= _month_start(month_keys[0]))
        .group_by(month_label)
        .all()
    )
    return [rows.get(key, 0) for key in month_keys]


def _monthly_participant_counts(month_keys):
    month_label = func.strftime("%Y-%m", Booking.booking_date)
    rows = dict(
        db.session.query(
            month_label.label("month"), func.count(func.distinct(Booking.user_id)).label("cnt")
        )
        .filter(
            Booking.status != BookingStatus.CANCELLED,
            Booking.booking_date >= _month_start(month_keys[0]),
        )
        .group_by(month_label)
        .all()
    )
    return [rows.get(key, 0) for key in month_keys]


def _popular_treks(limit=5):
    rows = (
        db.session.query(Trek.name, func.count(Booking.id).label("cnt"))
        .join(Booking, Booking.trek_id == Trek.id)
        .filter(Booking.status != BookingStatus.CANCELLED)
        .group_by(Trek.id, Trek.name)
        .order_by(func.count(Booking.id).desc(), Trek.name.asc())
        .limit(limit)
        .all()
    )
    return [{"name": name, "bookings": cnt} for name, cnt in rows]


def _participation_by_difficulty():
    rows = dict(
        db.session.query(Trek.difficulty, func.count(Booking.id))
        .join(Booking, Booking.trek_id == Trek.id)
        .filter(Booking.status != BookingStatus.CANCELLED)
        .group_by(Trek.difficulty)
        .all()
    )
    return {difficulty: rows.get(difficulty, 0) for difficulty in TrekDifficulty.ALL}


def _total_participants():
    return (
        db.session.query(func.count(func.distinct(Booking.user_id)))
        .filter(Booking.status != BookingStatus.CANCELLED)
        .scalar()
        or 0
    )


def build_public_stats_payload():
    """Read-only trekking statistics for the public landing dashboard.
    Contains aggregates only — no usernames, emails or booking internals."""
    month_keys = _last_month_keys(6)
    return {
        "total_treks": Trek.query.filter(Trek.status.in_(PUBLIC_TREK_STATUSES)).count(),
        "open_treks": Trek.query.filter_by(status=TrekStatus.OPEN).count(),
        "completed_treks": Trek.query.filter_by(status=TrekStatus.COMPLETED).count(),
        "total_participants": _total_participants(),
        "popular_treks": _popular_treks(),
        "booking_trend": {"labels": month_keys, "counts": _monthly_booking_counts(month_keys)},
        "participation_by_difficulty": _participation_by_difficulty(),
    }


def build_admin_analytics_payload():
    """Full analytics payload for the admin Reports & Analytics page."""
    month_keys = _last_month_keys(12)
    top_rows = (
        db.session.query(User.username, func.count(Booking.id).label("cnt"))
        .join(Booking, Booking.user_id == User.id)
        .filter(User.role == Role.USER, Booking.status != BookingStatus.CANCELLED)
        .group_by(User.id, User.username)
        .order_by(func.count(Booking.id).desc(), User.username.asc())
        .limit(5)
        .all()
    )
    return {
        "total_bookings": Booking.query.count(),
        "completed_treks": Trek.query.filter_by(status=TrekStatus.COMPLETED).count(),
        "total_participants": _total_participants(),
        "bookings_by_status": {
            status: Booking.query.filter_by(status=status).count() for status in BookingStatus.ALL
        },
        "monthly_trend": {
            "labels": month_keys,
            "bookings": _monthly_booking_counts(month_keys),
            "participants": _monthly_participant_counts(month_keys),
        },
        "popular_treks": _popular_treks(),
        "participation_by_difficulty": _participation_by_difficulty(),
        "top_participants": [{"username": username, "bookings": cnt} for username, cnt in top_rows],
    }


@cache.memoize(timeout=_base_config.CACHE_TTL_TREK_LISTING)
def cached_public_treks(q, difficulty, min_duration, max_duration):
    return build_public_treks_payload(q, difficulty, min_duration, max_duration)


@cache.memoize(timeout=_base_config.CACHE_TTL_ADMIN_LISTS)
def cached_admin_treks(q, status, difficulty):
    return build_admin_treks_payload(q, status, difficulty)


@cache.memoize(timeout=_base_config.CACHE_TTL_ADMIN_STATS)
def cached_admin_dashboard():
    return build_admin_dashboard_payload()


@cache.memoize(timeout=_base_config.CACHE_TTL_ADMIN_LISTS)
def cached_admin_staff(q):
    return build_admin_staff_payload(q)


@cache.memoize(timeout=_base_config.CACHE_TTL_ADMIN_LISTS)
def cached_admin_users(q):
    return build_admin_users_payload(q)


@cache.memoize(timeout=_base_config.CACHE_TTL_ANALYTICS)
def cached_public_stats():
    return build_public_stats_payload()


@cache.memoize(timeout=_base_config.CACHE_TTL_ANALYTICS)
def cached_admin_analytics():
    return build_admin_analytics_payload()



def invalidate_trek_caches():
    try:
        cache.delete_memoized(cached_public_treks)
        cache.delete_memoized(cached_admin_treks)
        cache.delete_memoized(cached_admin_dashboard)
        cache.delete_memoized(cached_admin_staff)
        cache.delete_memoized(cached_admin_users)
        cache.delete_memoized(cached_public_stats)
        cache.delete_memoized(cached_admin_analytics)
    except Exception:
        logger.exception("Failed to invalidate trek caches; continuing.")


def invalidate_staff_caches():
    try:
        cache.delete_memoized(cached_admin_staff)
    except Exception:
        logger.exception("Failed to invalidate staff cache; continuing.")
    invalidate_trek_caches()


def invalidate_user_caches():
    try:
        cache.delete_memoized(cached_admin_users)
        cache.delete_memoized(cached_admin_dashboard)
        cache.delete_memoized(cached_public_stats)
        cache.delete_memoized(cached_admin_analytics)
    except Exception:
        logger.exception("Failed to invalidate user caches; continuing.")
