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
        this.reportError = err.response?.data?.message || "Could not trigger the report.";
      } finally {
        this.runningReport = false;
      }
    },
  },
  template: `
    <div>
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
        <h1 class="h4 mb-0">Admin Dashboard</h1>
        <div class="text-end">
          <button class="btn btn-sm btn-outline-secondary" :disabled="runningReport" @click="runMonthlyReport">
            <span v-if="runningReport" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ runningReport ? "Sending..." : "Email Monthly Report Now" }}
          </button>
          <div v-if="reportMessage" class="small text-success mt-1">{{ reportMessage }}</div>
          <div v-if="reportError" class="small text-danger mt-1">{{ reportError }}</div>
        </div>
      </div>

      <div v-if="loading" class="text-muted">Loading...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-else>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#90CAF9;">{{ stats.total_treks }}</div>
              <div class="text-muted small">Treks</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#A5D6A7;">{{ stats.total_users }}</div>
              <div class="text-muted small">Trekkers</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#FFCC80;">{{ stats.total_staff }}</div>
              <div class="text-muted small">Trek Staff</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#F48FB1;">{{ stats.total_bookings }}</div>
              <div class="text-muted small">Bookings</div>
            </div>
          </div>
        </div>

        <div class="border rounded p-4 mt-4">
          <h6 class="fw-semibold mb-3">Trek Status Breakdown</h6>
          <div v-if="stats.total_treks === 0" class="text-secondary small">No treks created yet.</div>
          <div v-else>
            <div v-for="row in statusBreakdown" :key="row.status" class="mb-3">
              <div class="d-flex justify-content-between small mb-1">
                <span class="text-capitalize">{{ row.status }}</span>
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