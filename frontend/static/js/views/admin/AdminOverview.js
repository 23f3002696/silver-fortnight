import { api } from "../../api.js";

const STATUS_COLORS = {
  pending: "#FFCC80",
  approved: "#90CAF9",
  open: "#A5D6A7",
  closed: "#EF9A9A",
  completed: "#B39DDB",
};

export default {
  name: "AdminOverview",
  data() {
    return {
      loading: true,
      error: "",
      stats: null,
      statusColors: STATUS_COLORS,
      runningReport: false,
      reportMessage: "",
      reportError: "",
    };
  },
  computed: {
    statusBreakdown() {
      if (!this.stats) return [];
      const total = this.stats.total_treks || 0;
      return Object.entries(this.stats.treks_by_status).map(([status, count]) => ({
        status,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
    },
  },
  async created() {
    await this.fetchStats();
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      this.error = "";
      try {
        const { data } = await api.get("/admin/dashboard");
        this.stats = data;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load the dashboard.";
      } finally {
        this.loading = false;
      }
    },
    async runMonthlyReport() {
      this.runningReport = true;
      this.reportMessage = "";
      this.reportError = "";
      try {
        const { data } = await api.post("/admin/reports/monthly/run");
        this.reportMessage = data.message;
      } catch (err) {
        this.reportError = err.response?.data?.message || "We couldn't trigger the report. Please try again.";
      } finally {
        this.runningReport = false;
      }
    },
  },
  template: `
    <div>
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
        <div>
          <h1 class="h4 mb-0">Admin Dashboard</h1>
          <p class="text-muted small mb-0">The pulse of Silver Fortnight &mdash; treks, people and bookings at a glance.</p>
        </div>
        <div class="text-end">
          <button class="btn btn-sm btn-outline-secondary" :disabled="runningReport" @click="runMonthlyReport">
            <span v-if="runningReport" class="spinner-border spinner-border-sm me-1" role="status"></span>
            <i v-else class="bi bi-envelope me-1"></i>
            {{ runningReport ? "Sending..." : "Send monthly report" }}
          </button>
          <div v-if="reportMessage" class="small text-success mt-1">{{ reportMessage }}</div>
          <div v-if="reportError" class="small text-danger mt-1">{{ reportError }}</div>
        </div>
      </div>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading the dashboard&hellip;
      </div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-else>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-blue mb-2"><i class="bi bi-map"></i></span>
              <div class="stat-value">{{ stats.total_treks }}</div>
              <div class="stat-label">Treks</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-green mb-2"><i class="bi bi-people"></i></span>
              <div class="stat-value">{{ stats.total_users }}</div>
              <div class="stat-label">Trekkers</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-orange mb-2"><i class="bi bi-person-badge"></i></span>
              <div class="stat-value">{{ stats.total_staff }}</div>
              <div class="stat-label">Trek staff</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-pink mb-2"><i class="bi bi-journal-check"></i></span>
              <div class="stat-value">{{ stats.total_bookings }}</div>
              <div class="stat-label">Bookings</div>
            </div>
          </div>
        </div>

        <div class="border rounded p-4 mt-4">
          <h6 class="fw-semibold mb-3"><i class="bi bi-pie-chart me-2 text-primary"></i>Where your treks stand</h6>
          <div v-if="stats.total_treks === 0" class="text-secondary small">No treks yet &mdash; create your first trek to get the trail moving.</div>
          <div v-else>
            <div v-for="row in statusBreakdown" :key="row.status" class="mb-3">
              <div class="d-flex justify-content-between small mb-1">
                <span class="text-capitalize fw-medium">{{ row.status }}</span>
                <span class="text-muted">{{ row.count }} ({{ row.pct }}%)</span>
              </div>
              <div class="progress" style="height: 8px;">
                <div
                  class="progress-bar"
                  role="progressbar"
                  :style="{ width: row.pct + '%', backgroundColor: statusColors[row.status] }"
                  :aria-valuenow="row.pct"
                  aria-valuemin="0"
                  aria-valuemax="100"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};