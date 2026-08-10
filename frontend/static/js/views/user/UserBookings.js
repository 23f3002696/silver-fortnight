import { api } from "../../api.js";

const STATUSES = ["booked", "cancelled", "completed"];
const STATUS_BADGE = {
  booked: "text-bg-info",
  cancelled: "text-bg-danger",
  completed: "text-bg-success",
};
const DIFFICULTY_BADGE = { easy: "text-bg-success", moderate: "text-bg-warning", hard: "text-bg-danger" };

export default {
  name: "UserBookings",
  data() {
    return {
      bookings: [],
      loading: true,
      error: "",
      statusFilter: "",
      statuses: STATUSES,
      statusBadge: STATUS_BADGE,
      difficultyBadge: DIFFICULTY_BADGE,
      cancellingId: null,
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
        if (this.statusFilter) params.status = this.statusFilter;
        const { data } = await api.get("/user/bookings", { params });
        this.bookings = data.bookings;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load your trekking history.";
      } finally {
        this.loading = false;
      }
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleString();
    },
    formatDay(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleDateString();
    },
    async cancelBooking(booking) {
      if (!confirm(`Cancel your booking for "${booking.trek_name}"?`)) return;
      this.cancellingId = booking.id;
      try {
        await api.post(`/user/bookings/${booking.id}/cancel`);
        await this.fetchBookings();
      } catch (err) {
        alert(err.response?.data?.message || "Could not cancel this booking.");
      } finally {
        this.cancellingId = null;
      }
    },
  },
  template: `
    <div>
      <h1 class="h4 mb-3">My Bookings</h1>

      <div class="mb-3">
        <select v-model="statusFilter" @change="fetchBookings" class="form-select" style="max-width: 220px;">
          <option value="">All statuses</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div v-if="loading" class="text-muted">Loading...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded">
        <div v-if="bookings.length === 0" class="p-4 text-secondary text-center">
          No bookings yet. Head over to Browse Treks to plan your next adventure.
        </div>
        <div v-else class="table-responsive">
          <table class="table table-borderless mb-0 align-middle">
            <thead class="border-bottom">
              <tr>
                <th>Trek</th>
                <th>Difficulty</th>
                <th>Dates</th>
                <th>Booked On</th>
                <th>Status</th>
                <th>Payment</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in bookings" :key="booking.id">
                <td>
                  <div class="fw-medium">{{ booking.trek_name }}</div>
                  <div class="small text-muted" v-if="booking.trek_location">{{ booking.trek_location }}</div>
                </td>
                <td><span class="badge" :class="difficultyBadge[booking.trek_difficulty]">{{ booking.trek_difficulty }}</span></td>
                <td class="small">{{ formatDay(booking.trek_start_date) }} &ndash; {{ formatDay(booking.trek_end_date) }}</td>
                <td>{{ formatDate(booking.booking_date) }}</td>
                <td><span class="badge" :class="statusBadge[booking.status]">{{ booking.status }}</span></td>
                <td><span class="text-muted small text-capitalize">{{ booking.payment_status.replace('_', ' ') }}</span></td>
                <td class="text-center">
                  <button
                    v-if="booking.status === 'booked'"
                    class="btn btn-sm btn-outline-danger"
                    :disabled="cancellingId === booking.id"
                    @click="cancelBooking(booking)"
                  >
                    {{ cancellingId === booking.id ? "Cancelling..." : "Cancel" }}
                  </button>
                  <span v-else class="text-muted small">&mdash;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
