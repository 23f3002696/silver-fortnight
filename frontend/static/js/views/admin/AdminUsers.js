import { api } from "../../api.js";

const BOOKING_STATUS_BADGE = {
  booked: "text-bg-info",
  cancelled: "text-bg-danger",
  completed: "text-bg-success",
};

export default {
  name: "AdminUsers",
  data() {
    return {
      users: [],
      loading: true,
      error: "",
      searchQuery: "",
      searchTimer: null,
      bookingStatusBadge: BOOKING_STATUS_BADGE,
      historyUser: null,
      historyBookings: [],
      historyLoading: false,
      historyError: "",
    };
  },
  async created() {
    await this.fetchUsers();
  },
  mounted() {
    this.historyModal = new bootstrap.Modal(this.$refs.historyModalEl);
  },
  methods: {
    async fetchUsers() {
      this.loading = true;
      this.error = "";
      try {
        const params = {};
        if (this.searchQuery.trim()) params.q = this.searchQuery.trim();
        const { data } = await api.get("/admin/users", { params });
        this.users = data.users;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load Trekkers.";
      } finally {
        this.loading = false;
      }
    },
    onSearchInput() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.fetchUsers(), 300);
    },
    async toggleActive(user) {
      const verb = user.is_active ? "blacklist" : "reactivate";
      if (!confirm(`Are you sure you want to ${verb} "${user.username}"?`)) return;
      try {
        await api.post(`/admin/users/${user.id}/toggle-active`);
        await this.fetchUsers();
      } catch (err) {
        alert(err.response?.data?.message || "Could not update this user.");
      }
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleString();
    },
    async openHistory(user) {
      this.historyUser = user;
      this.historyBookings = [];
      this.historyError = "";
      this.historyLoading = true;
      this.historyModal.show();
      try {
        const { data } = await api.get("/admin/bookings", { params: { user_id: user.id } });
        this.historyBookings = data.bookings;
      } catch (err) {
        this.historyError = err.response?.data?.message || "Could not load this trekker's history.";
      } finally {
        this.historyLoading = false;
      }
    },
  },
  template: `
    <div>
      <h1 class="h4 mb-3">Trekkers</h1>

      <div class="mb-3">
        <input
          v-model="searchQuery"
          @input="onSearchInput"
          type="search"
          class="form-control"
          placeholder="Search by username or email..."
        />
      </div>

      <div v-if="loading" class="text-muted">Loading...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded mb-1">
        <div v-if="users.length === 0" class="p-4 text-secondary text-center">No Trekkers found.</div>
        <div
          v-for="user in users"
          :key="user.id"
          class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 p-3 border-bottom"
        >
          <div>
            <span class="fw-medium" :class="{ 'text-danger text-decoration-line-through': !user.is_active }">
              {{ user.username }}
            </span>
            <span v-if="!user.is_active" class="badge bg-danger ms-1">Blacklisted</span>
            <div class="mt-1">
              <small class="text-muted">{{ user.email }} &middot; {{ user.bookings_count }} booking(s)</small>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-shrink-0">
            <button class="btn btn-sm btn-outline-secondary rounded-pill px-3" @click="openHistory(user)">
              <i class="bi bi-clock-history"></i> History
            </button>
            <button
              class="btn btn-sm rounded-pill px-3"
              :class="user.is_active ? 'btn-outline-danger' : 'btn-outline-success'"
              @click="toggleActive(user)"
            >
              {{ user.is_active ? "Blacklist" : "Reactivate" }}
            </button>
          </div>
        </div>
      </div>

      <!-- Trekking History Modal -->
      <div class="modal fade" tabindex="-1" ref="historyModalEl">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                Trekking History
                <span class="text-muted" v-if="historyUser">&mdash; {{ historyUser.username }}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div v-if="historyLoading" class="text-muted">Loading...</div>
              <div v-else-if="historyError" class="alert alert-danger">{{ historyError }}</div>
              <div v-else-if="historyBookings.length === 0" class="text-secondary text-center p-3">
                This trekker has no bookings yet.
              </div>
              <div v-else class="table-responsive">
                <table class="table table-borderless mb-0 align-middle">
                  <thead class="border-bottom">
                    <tr>
                      <th>Trek</th>
                      <th>Booked On</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in historyBookings" :key="b.id">
                      <td>
                        <div class="fw-medium">{{ b.trek_name }}</div>
                        <div class="small text-muted" v-if="b.trek_location">{{ b.trek_location }}</div>
                      </td>
                      <td>{{ formatDate(b.booking_date) }}</td>
                      <td><span class="badge" :class="bookingStatusBadge[b.status]">{{ b.status }}</span></td>
                      <td><span class="text-muted small text-capitalize">{{ b.payment_status.replace('_', ' ') }}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};