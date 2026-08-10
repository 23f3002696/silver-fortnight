import { api } from "../../api.js";
import {
  CHART_COLORS,
  DIFFICULTY_COLORS,
  BOOKING_STATUS_COLORS,
  renderChart,
  destroyChart,
  formatMonthLabel,
} from "../../charts.js";

export default {
  name: "AdminAnalytics",
  data() {
    return {
      loading: true,
      error: "",
      stats: null,
      charts: [],
    };
  },
  async created() {
    await this.fetchStats();
  },
  beforeUnmount() {
    this.charts.forEach(destroyChart);
    this.charts = [];
  },
  methods: {
    async fetchStats() {
      this.loading = true;
      this.error = "";
      try {
        const { data } = await api.get("/admin/analytics");
        this.stats = data;
      } catch (err) {
        this.error = err.response?.data?.message || "We couldn't load the analytics.";
      } finally {
        this.loading = false;
      }
      if (this.stats && !this.error) {
        this.$nextTick(() => this.renderCharts());
      }
    },
    renderCharts() {
      if (!this.stats) return;
      this.charts.forEach(destroyChart);
      this.charts = [];

      const trend = this.stats.monthly_trend || { labels: [], bookings: [], participants: [] };
      this.charts.push(
        renderChart(this.$refs.trendCanvas, {
          type: "line",
          data: {
            labels: trend.labels.map(formatMonthLabel),
            datasets: [
              {
                label: "Bookings",
                data: trend.bookings,
                borderColor: CHART_COLORS.blue,
                backgroundColor: "rgba(144,202,249,.25)",
                fill: true,
                tension: 0.35,
                pointRadius: 3,
              },
              {
                label: "Participants",
                data: trend.participants,
                borderColor: CHART_COLORS.green,
                backgroundColor: "rgba(165,214,167,.25)",
                fill: true,
                tension: 0.35,
                pointRadius: 3,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } } },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: "rgba(0,0,0,.05)" } },
              x: { grid: { display: false } },
            },
          },
        })
      );

      const byStatus = this.stats.bookings_by_status || {};
      this.charts.push(
        renderChart(this.$refs.statusCanvas, {
          type: "doughnut",
          data: {
            labels: Object.keys(byStatus),
            datasets: [
              {
                data: Object.values(byStatus),
                backgroundColor: Object.keys(byStatus).map(
                  (s) => BOOKING_STATUS_COLORS[s] || CHART_COLORS.purple
                ),
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: { legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } } },
          },
        })
      );

      const popular = this.stats.popular_treks || [];
      this.charts.push(
        renderChart(this.$refs.popularCanvas, {
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
        })
      );

      const difficulty = this.stats.participation_by_difficulty || {};
      const labels = Object.keys(difficulty);
      this.charts.push(
        renderChart(this.$refs.difficultyCanvas, {
          type: "doughnut",
          data: {
            labels,
            datasets: [
              {
                data: Object.values(difficulty),
                backgroundColor: labels.map((l) => DIFFICULTY_COLORS[l] || CHART_COLORS.purple),
                borderWidth: 0,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: { legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } } },
          },
        })
      );
    },
  },
  template: `
    <div>
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-4">
        <div>
          <h1 class="h4 mb-0">Reports &amp; Analytics</h1>
          <p class="text-muted small mb-0">How your trails are performing &mdash; booking trends and monthly participation.</p>
        </div>
        <button class="btn btn-sm btn-outline-secondary" :disabled="loading" @click="fetchStats">
          <i class="bi bi-arrow-clockwise me-1"></i>Refresh
        </button>
      </div>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading analytics&hellip;
      </div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-else>
        <div class="row g-3">
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-pink mb-2"><i class="bi bi-journal-check"></i></span>
              <div class="stat-value">{{ stats.total_bookings }}</div>
              <div class="stat-label">Total Bookings</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-purple mb-2"><i class="bi bi-flag"></i></span>
              <div class="stat-value">{{ stats.completed_treks }}</div>
              <div class="stat-label">Treks completed</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-green mb-2"><i class="bi bi-people"></i></span>
              <div class="stat-value">{{ stats.total_participants }}</div>
              <div class="stat-label">Unique participants</div>
            </div>
          </div>
          <div class="col-6 col-md-3">
            <div class="stat-card">
              <span class="stat-icon chip-blue mb-2"><i class="bi bi-bookmark-check"></i></span>
              <div class="stat-value">{{ stats.bookings_by_status.booked || 0 }}</div>
              <div class="stat-label">Active bookings</div>
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-lg-8">
            <div class="border rounded p-4 h-100">
              <h6 class="fw-semibold mb-1">Monthly Booking &amp; Participation Trend</h6>
              <p class="text-muted small mb-3">Bookings made and unique participants per month over the last 12 months.</p>
              <div style="height: 280px;"><canvas ref="trendCanvas"></canvas></div>
            </div>
          </div>
          <div class="col-lg-4">
            <div class="border rounded p-4 h-100">
              <h6 class="fw-semibold mb-1">Bookings by Status</h6>
              <p class="text-muted small mb-3">How every booking ended up, all-time.</p>
              <div style="height: 280px;"><canvas ref="statusCanvas"></canvas></div>
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-lg-7">
            <div class="border rounded p-4 h-100">
              <h6 class="fw-semibold mb-1">Trending Treks</h6>
              <p class="text-muted small mb-3">Top 5 treks ranked by confirmed bookings.</p>
              <div v-if="stats.popular_treks.length === 0" class="text-secondary small">
                No bookings yet &mdash; the charts will light up once trekkers sign up.
              </div>
              <div v-else :style="{ height: Math.max(180, stats.popular_treks.length * 44) + 'px' }">
                <canvas ref="popularCanvas"></canvas>
              </div>
            </div>
          </div>
          <div class="col-lg-5">
            <div class="border rounded p-4 h-100">
              <h6 class="fw-semibold mb-1">Top Participants</h6>
              <p class="text-muted small mb-3">Your most seasoned trekkers, ranked by confirmed bookings.</p>
              <div v-if="stats.top_participants.length === 0" class="text-secondary small">
                No participant activity yet.
              </div>
              <table v-else class="table table-sm table-borderless align-middle mb-0">
                <thead class="border-bottom">
                  <tr>
                    <th>#</th>
                    <th>Trekker</th>
                    <th class="text-end">Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, index) in stats.top_participants" :key="row.username">
                    <td class="text-muted">{{ index + 1 }}</td>
                    <td class="fw-semibold">{{ row.username }}</td>
                    <td class="text-end">{{ row.bookings }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="row g-3 mt-1">
          <div class="col-lg-4">
            <div class="border rounded p-4">
              <h6 class="fw-semibold mb-1">Participation by Difficulty</h6>
              <p class="text-muted small mb-3">Confirmed bookings grouped by how tough the trail is.</p>
              <div style="height: 240px;"><canvas ref="difficultyCanvas"></canvas></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
