import { api } from "../api.js";
import { authState, dashboardPathForRole } from "../auth.js";
import {
  CHART_COLORS,
  DIFFICULTY_COLORS,
  renderChart,
  destroyChart,
  formatMonthLabel,
} from "../charts.js";

export default {
  name: "PublicLanding",
  data() {
    return {
      authState,
      loading: true,
      error: "",
      stats: null,
      trendChart: null,
      popularChart: null,
      difficultyChart: null,
    };
  },
  async created() {
    await this.fetchStats();
  },
  beforeUnmount() {
    destroyChart(this.trendChart);
    destroyChart(this.popularChart);
    destroyChart(this.difficultyChart);
  },
  methods: {
    dashboardPath() {
      return dashboardPathForRole(this.authState.user?.role);
    },
    async fetchStats() {
      this.loading = true;
      this.error = "";
      try {
        const { data } = await api.get("/public/stats");
        this.stats = data;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load the live statistics.";
      } finally {
        this.loading = false;
      }
      // Schedule chart rendering only after loading is false, so the
      // re-render that mounts the canvases happens before we read $refs.
      if (this.stats && !this.error) {
        this.$nextTick(() => this.renderCharts());
      }
    },
    renderCharts() {
      if (!this.stats) return;

      // Booking trend — last 6 months (bar)
      const trend = this.stats.booking_trend || { labels: [], counts: [] };
      this.trendChart = renderChart(this.$refs.trendCanvas, {
        type: "bar",
        data: {
          labels: trend.labels.map(formatMonthLabel),
          datasets: [
            {
              label: "Bookings",
              data: trend.counts,
              backgroundColor: CHART_COLORS.blue,
              borderRadius: 6,
              maxBarThickness: 42,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.05)" } },
            x: { grid: { display: false } },
          },
        },
      });

      // Most popular treks (horizontal bar)
      const popular = this.stats.popular_treks || [];
      this.popularChart = renderChart(this.$refs.popularCanvas, {
        type: "bar",
        data: {
          labels: popular.map((t) => t.name),
          datasets: [
            {
              label: "Bookings",
              data: popular.map((t) => t.bookings),
              backgroundColor: CHART_COLORS.green,
              borderRadius: 6,
              maxBarThickness: 26,
            },
          ],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.05)" } },
            y: { grid: { display: false } },
          },
        },
      });

      // Participation by difficulty (doughnut)
      const difficulty = this.stats.participation_by_difficulty || {};
      const labels = Object.keys(difficulty);
      const values = Object.values(difficulty);
      this.difficultyChart = renderChart(this.$refs.difficultyCanvas, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: labels.map((l) => DIFFICULTY_COLORS[l] || CHART_COLORS.purple),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } },
          },
        },
      });
    },
  },
  template: `
    <div>
      <!-- Hero -->
      <div class="border rounded p-4 p-md-5 text-center shadow-sm bg-white mb-4">
        <i class="bi bi-compass text-primary" style="font-size: 2.5rem;"></i>
        <h1 class="h3 fw-bold mt-2 mb-2">Silver Fortnight Trekking</h1>
        <p class="text-muted mx-auto mb-4" style="max-width: 40rem;">
          Guided treks for every level of adventurer. Browse our live trekking
          statistics below, then create an account to book your next trail.
        </p>
        <div class="d-flex justify-content-center gap-2 flex-wrap">
          <router-link v-if="authState.user" :to="dashboardPath()" class="btn btn-primary">
            <i class="bi bi-speedometer2 me-1"></i>Go to my dashboard
          </router-link>
          <template v-else>
            <router-link to="/register" class="btn btn-primary">
              <i class="bi bi-person-plus me-1"></i>Create an account
            </router-link>
            <router-link to="/login" class="btn btn-outline-primary">
              <i class="bi bi-box-arrow-in-right me-1"></i>Sign in
            </router-link>
          </template>
        </div>
      </div>

      <div v-if="loading" class="text-muted">Loading live statistics...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <template v-else>
        <!-- Stat cards -->
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#90CAF9;">{{ stats.total_treks }}</div>
              <div class="text-muted small">Treks Organised</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#A5D6A7;">{{ stats.open_treks }}</div>
              <div class="text-muted small">Open for Booking</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#B39DDB;">{{ stats.completed_treks }}</div>
              <div class="text-muted small">Treks Completed</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="border rounded p-3 text-center h-100">
              <div class="fs-2 fw-bold" style="color:#F48FB1;">{{ stats.total_participants }}</div>
              <div class="text-muted small">Trekkers on the Trail</div>
            </div>
          </div>
        </div>

        <div v-if="stats.total_treks === 0" class="border rounded p-4 mt-4 text-center text-secondary">
          No trekking activity recorded yet &mdash; check back soon!
        </div>

        <template v-else>
          <!-- Charts row 1 -->
          <div class="row g-3 mt-1">
            <div class="col-lg-8">
              <div class="border rounded p-4 h-100 bg-white">
                <h6 class="fw-semibold mb-1">Booking Trend</h6>
                <p class="text-muted small mb-3">Bookings made over the last 6 months.</p>
                <div style="height: 260px;"><canvas ref="trendCanvas"></canvas></div>
              </div>
            </div>
            <div class="col-lg-4">
              <div class="border rounded p-4 h-100 bg-white">
                <h6 class="fw-semibold mb-1">Participation by Difficulty</h6>
                <p class="text-muted small mb-3">Where trekkers put their boots.</p>
                <div style="height: 260px;"><canvas ref="difficultyCanvas"></canvas></div>
              </div>
            </div>
          </div>

          <!-- Charts row 2 -->
          <div class="row g-3 mt-1">
            <div class="col-lg-7">
              <div class="border rounded p-4 h-100 bg-white">
                <h6 class="fw-semibold mb-1">Most Popular Treks</h6>
                <p class="text-muted small mb-3">Ranked by number of bookings.</p>
                <div :style="{ height: Math.max(180, (stats.popular_treks.length || 1) * 44) + 'px' }">
                  <canvas ref="popularCanvas"></canvas>
                </div>
              </div>
            </div>
            <div class="col-lg-5">
              <div class="border rounded p-4 h-100 bg-white d-flex flex-column">
                <h6 class="fw-semibold mb-3">Ready for the trail?</h6>
                <ul class="list-unstyled small text-secondary d-flex flex-column gap-2 mb-4">
                  <li><i class="bi bi-check-circle-fill text-success me-2"></i>Browse open treks with difficulty, location and duration filters.</li>
                  <li><i class="bi bi-check-circle-fill text-success me-2"></i>Book a slot in seconds and track your booking status.</li>
                  <li><i class="bi bi-check-circle-fill text-success me-2"></i>Get reminders before your trek starts and export your trekking history.</li>
                </ul>
                <div class="mt-auto">
                  <router-link v-if="!authState.user" to="/register" class="btn btn-primary btn-sm">
                    <i class="bi bi-person-plus me-1"></i>Join Silver Fortnight
                  </router-link>
                  <router-link v-else-if="authState.user.role === 'user'" to="/user/treks" class="btn btn-primary btn-sm">
                    <i class="bi bi-compass me-1"></i>Browse Treks
                  </router-link>
                  <router-link v-else :to="dashboardPath()" class="btn btn-primary btn-sm">
                    <i class="bi bi-speedometer2 me-1"></i>Go to my dashboard
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  `,
};
