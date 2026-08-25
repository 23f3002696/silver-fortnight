import { api } from "../../api.js";
import {
  CHART_COLORS,
  DIFFICULTY_COLORS,
  BOOKING_STATUS_COLORS,
  renderChart,
  destroyChart,
  formatMonthLabel,
  centerTextPlugin,
} from "../../charts.js";

export default {
  name: "AdminAnalytics",
  data() {
    return {
      loading: true,
      error: "",
      stats: null,
      charts: [],
      difficultyColors: DIFFICULTY_COLORS,
    };
  },
  async created() {
    await this.fetchStats();
  },
  computed: {
    difficultyBreakdown() {
      const difficulty = this.stats?.participation_by_difficulty || {};
      const total = Object.values(difficulty).reduce((sum, v) => sum + v, 0);
      return Object.entries(difficulty).map(([label, count]) => ({
        label,
        count,
        pct: total > 0 ? Math.round((count / total) * 100) : 0,
      }));
    },
    hasTrend() {
      const trend = this.stats?.monthly_trend;
      if (!trend) return false;
      return [...(trend.bookings || []), ...(trend.participants || [])].some((v) => v > 0);
    },
    hasStatus() {
      return Object.values(this.stats?.bookings_by_status || {}).some((v) => v > 0);
    },
    hasPopular() {
      return (this.stats?.popular_treks || []).length > 0;
    },
    hasParticipants() {
      return (this.stats?.top_participants || []).length > 0;
    },
    hasDifficulty() {
      return Object.values(this.stats?.participation_by_difficulty || {}).some((v) => v > 0);
    },
    hasAnyChart() {
      return this.hasTrend || this.hasStatus || this.hasPopular || this.hasDifficulty;
    },
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

      if (this.hasTrend) {
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
      }
      this.renderRest();
    },
    renderRest() {
      const byStatus = this.stats.bookings_by_status || {};
      if (this.hasStatus) {
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
              cutout: "68%",
              plugins: { legend: { position: "bottom", labels: { boxWidth: 12, boxHeight: 12 } } },
            },
            plugins: [centerTextPlugin("BOOKINGS")],
          })
        );
      }

      const popular = this.stats.popular_treks || [];
      if (this.hasPopular) {
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
      }

      const difficulty = this.stats.participation_by_difficulty || {};
      const labels = Object.keys(difficulty);
      if (this.hasDifficulty) {
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
              cutout: "68%",
              plugins: { legend: { display: false } },
            },
            plugins: [centerTextPlugin("TREKKERS")],
          })
        );
      }
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

        <div v-if="!hasAnyChart" class="border rounded p-4 mt-4 text-center text-secondary">
          No chart data yet &mdash; once trekkers start booking, the charts will light up here.
        </div>

        <div v-if="hasTrend || hasStatus" class="row g-3 mt-1">
          <div v-if="hasTrend" class="col-lg-8">
            <div class="border rounded p-4 h-100">
              <h6 class="fw-semibold mb-1"><i class="bi bi-activity me-2 text-primary"></i>Monthly Booking &amp; Participation Trend</h6>
              <p class="text-muted small mb-3">Bookings made and unique participants per month over the last 12 months.</p>
              <div style="height: 280px;"><canvas ref="trendCanvas"></canvas></div>
            </div>
          </div>
          <div v-if="hasStatus" class="col-lg-4">
            <div class="border rounded p-4 h-100">
              <h6 class="fw-semibold mb-1"><i class="bi bi-pie-chart me-2 text-primary"></i>Bookings by Status</h6>
              <p class="text-muted small mb-3">How every booking ended up, all-time.</p>
              <div style="height: 280px;"><canvas ref="statusCanvas"></canvas></div>
            </div>
          </div>
        </div>

        <div v-if="hasPopular || hasParticipants" class="row g-3 mt-1 align-items-stretch">
          <div v-if="hasPopular" class="col-lg-7">
            <div class="border rounded p-4 h-100 d-flex flex-column">
              <h6 class="fw-semibold mb-1"><i class="bi bi-bar-chart-line me-2 text-primary"></i>Trending Treks</h6>
              <p class="text-muted small mb-3">Top 5 treks ranked by confirmed bookings.</p>
              <div class="flex-grow-1" style="min-height: 220px;">
                <canvas ref="popularCanvas"></canvas>
              </div>
            </div>
          </div>
          <div v-if="hasParticipants" class="col-lg-5">
            <div class="border rounded p-4 h-100 d-flex flex-column">
              <h6 class="fw-semibold mb-1"><i class="bi bi-award me-2 text-primary"></i>Top Participants</h6>
              <p class="text-muted small mb-3">Your most seasoned trekkers, ranked by confirmed bookings.</p>
              <div class="flex-grow-1 d-flex flex-column justify-content-center">
                <table class="table table-sm table-borderless align-middle mb-0">
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
        </div>

        <div v-if="hasDifficulty" class="row g-3 mt-1">
          <div class="col-12">
            <div class="border rounded p-4">
              <h6 class="fw-semibold mb-1"><i class="bi bi-bar-chart-steps me-2 text-primary"></i>Participation by Difficulty</h6>
              <p class="text-muted small mb-3">Confirmed bookings grouped by how tough the trail is.</p>
              <div class="row align-items-center g-4">
                <div class="col-md-5 col-lg-4">
                  <div style="height: 220px;"><canvas ref="difficultyCanvas"></canvas></div>
                </div>
                <div class="col-md-7 col-lg-8">
                  <div v-for="row in difficultyBreakdown" :key="row.label" class="mb-3">
                    <div class="d-flex justify-content-between small mb-1">
                      <span class="text-capitalize fw-medium">{{ row.label }}</span>
                      <span class="text-muted">{{ row.count }} ({{ row.pct }}%)</span>
                    </div>
                    <div class="progress" style="height: 8px;">
                      <div
                        class="progress-bar"
                        role="progressbar"
                        :style="{ width: row.pct + '%', backgroundColor: difficultyColors[row.label] }"
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
        </div>
      </div>
    </div>
  `,
};
