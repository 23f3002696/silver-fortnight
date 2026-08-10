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
      <h1 class="h4 mb-1">Welcome, <span class="text-muted">{{ authState.user?.username }}</span></h1>
      <p class="text-muted small mb-4">Here's a snapshot of your trekking activity.</p>

      <div v-if="loading" class="text-muted">Loading...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-else>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#90CAF9;">{{ stats.available_treks }}</div>
              <div class="text-muted small">Open Treks</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#A5D6A7;">{{ stats.bookings_by_status.booked || 0 }}</div>
              <div class="text-muted small">Active Bookings</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#B39DDB;">{{ stats.bookings_by_status.completed || 0 }}</div>
              <div class="text-muted small">Completed Treks</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#F48FB1;">{{ stats.total_bookings }}</div>
              <div class="text-muted small">Total Bookings</div>
            </div>
          </div>
        </div>

        <div class="border rounded p-4 mt-4">
          <h6 class="fw-semibold mb-3">Your Next Trek</h6>
          <div v-if="!stats.next_trek" class="text-secondary small">
            No upcoming treks yet. Browse open treks and book your next adventure.
          </div>
          <div v-else class="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <div class="fw-medium">{{ stats.next_trek.trek_name }}</div>
              <div class="small text-muted" v-if="stats.next_trek.trek_location">{{ stats.next_trek.trek_location }}</div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <span class="badge" :class="difficultyBadge[stats.next_trek.trek_difficulty]">{{ stats.next_trek.trek_difficulty }}</span>
              <span class="text-muted small">Starts {{ formatDate(stats.next_trek.trek_start_date) }}</span>
            </div>
          </div>
        </div>

        <div class="d-flex flex-wrap gap-2 mt-4">
          <router-link to="/user/treks" class="btn btn-primary btn-sm">
            <i class="bi bi-compass"></i> Browse Treks
          </router-link>
          <router-link to="/user/bookings" class="btn btn-outline-secondary btn-sm">
            <i class="bi bi-clock-history"></i> My Bookings
          </router-link>
        </div>
      </div>
    </div>
  `,
};
