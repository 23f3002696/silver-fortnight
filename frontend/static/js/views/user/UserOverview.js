import { api } from "../../api.js";
import { authState } from "../../auth.js";

const DIFFICULTY_BADGE = { easy: "text-bg-success", moderate: "text-bg-warning", hard: "text-bg-danger" };

export default {
  name: "UserOverview",
  data() {
    return {
      authState,
      loading: true,
      error: "",
      stats: null,
      difficultyBadge: DIFFICULTY_BADGE,
    };
  },
  async created() {
    await this.fetchStats();
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      this.error = "";
      try {
        const { data } = await api.get("/user/dashboard");
        this.stats = data;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load your dashboard.";
      } finally {
        this.loading = false;
      }
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleDateString();
    },
  },
  template: `
    <div>
      <h1 class="h4 mb-1">Welcome back, {{ authState.user?.username }}</h1>
      <p class="text-muted small mb-4">Here's a snapshot of your adventures so far.</p>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading your dashboard&hellip;
      </div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-else>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-green mb-2"><i class="bi bi-signpost-2"></i></span>
              <div class="stat-value">{{ stats.available_treks }}</div>
              <div class="stat-label">Treks open now</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-blue mb-2"><i class="bi bi-bookmark-check"></i></span>
              <div class="stat-value">{{ stats.bookings_by_status.booked || 0 }}</div>
              <div class="stat-label">You're booked</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-purple mb-2"><i class="bi bi-flag"></i></span>
              <div class="stat-value">{{ stats.bookings_by_status.completed || 0 }}</div>
              <div class="stat-label">Trails completed</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-pink mb-2"><i class="bi bi-journal-check"></i></span>
              <div class="stat-value">{{ stats.total_bookings }}</div>
              <div class="stat-label">Total bookings</div>
            </div>
          </div>
        </div>

        <div class="border rounded p-4 mt-4">
          <h6 class="fw-semibold mb-3"><i class="bi bi-calendar-event me-2 text-primary"></i>Your next adventure</h6>
          <div v-if="!stats.next_trek" class="text-secondary small">
            Nothing booked yet &mdash; explore open treks and claim your next adventure.
          </div>
          <div v-else class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <div class="fw-semibold">{{ stats.next_trek.trek_name }}</div>
              <div class="small text-muted" v-if="stats.next_trek.trek_location">
                <i class="bi bi-geo-alt me-1"></i>{{ stats.next_trek.trek_location }}
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge" :class="difficultyBadge[stats.next_trek.trek_difficulty]">{{ stats.next_trek.trek_difficulty }}</span>
              <span class="text-muted small">Sets off {{ formatDate(stats.next_trek.trek_start_date) }}</span>
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mt-4">
          <router-link to="/user/treks" class="btn btn-primary btn-sm">
            <i class="bi bi-compass me-1"></i>Explore Treks
          </router-link>
          <router-link to="/user/bookings" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-clock-history me-1"></i>My Bookings
          </router-link>
        </div>
      </div>
    </div>
  `,
};
