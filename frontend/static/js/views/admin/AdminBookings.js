import { api } from "../../api.js";

const STATUSES = ["booked", "cancelled", "completed"];
const STATUS_BADGE = {
  booked: "text-bg-info",
  cancelled: "text-bg-danger",
  completed: "text-bg-success",
};

export default {
  name: "AdminBookings",
  data() {
    return {
      bookings: [],
      loading: true,
      error: "",
      searchQuery: "",
      statusFilter: "",
      searchTimer: null,
      statuses: STATUSES,
      statusBadge: STATUS_BADGE,
    };
  },
  async created() {
    await this.fetchBookings();
  },
  methods: {
    async fetchBookings() {
      this.loading = true;
      this.error = "";
      try {
        const params = {};
        if (this.searchQuery.trim()) params.q = this.searchQuery.trim();
        if (this.statusFilter) params.status = this.statusFilter;
        const { data } = await api.get("/admin/bookings", { params });
        this.bookings = data.bookings;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load booking records.";
      } finally {
        this.loading = false;
      }
    },
    onSearchInput() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.fetchBookings(), 300);
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleString();
    },
  },
  template: `
    <div>
      <h1 class="h4 mb-3">All Booking Records</h1>

      <div class="toolbar row g-2 mb-3">
        <div class="col-12 col-md-8">
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              v-model="searchQuery"
              @input="onSearchInput"
              type="search"
              class="form-control"
              placeholder="Search by trekker username or trek name..."
            />
          </div>
        </div>
        <div class="col-12 col-md-4">
          <select v-model="statusFilter" @change="fetchBookings" class="form-select">
            <option value="">All statuses</option>
            <option v-for="s in statuses" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading bookings&hellip;
      </div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded">
        <div v-if="bookings.length === 0" class="p-4 text-secondary text-center">No bookings found.</div>
        <div v-else class="table-responsive">
          <table class="table table-borderless mb-0 align-middle">
            <thead class="border-bottom">
              <tr>
                <th>Trekker</th>
                <th>Trek</th>
                <th>Booked On</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in bookings" :key="booking.id">
                <td class="fw-medium">{{ booking.username }}</td>
                <td>{{ booking.trek_name }}</td>
                <td class="small">{{ formatDate(booking.booking_date) }}</td>
                <td><span class="badge text-capitalize" :class="statusBadge[booking.status]">{{ booking.status }}</span></td>
                <td><span class="text-muted small text-capitalize">{{ booking.payment_status.replace(/_/g, ' ') }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
