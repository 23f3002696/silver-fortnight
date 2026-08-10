import { api } from "../api.js";

const DIFFICULTY_BADGE = { easy: "text-bg-success", moderate: "text-bg-warning", hard: "text-bg-danger" };
const TREK_STATUS_BADGE = {
  pending: "text-bg-secondary",
  approved: "text-bg-info",
  open: "text-bg-success",
  closed: "text-bg-dark",
  completed: "text-bg-primary",
};
const BOOKING_STATUS_BADGE = {
  booked: "text-bg-info",
  cancelled: "text-bg-danger",
  completed: "text-bg-success",
};
const EDITABLE_STATUSES = ["open", "closed", "completed"];

function emptyEditForm() {
  return { available_slots: "", status: "open" };
}

export default {
  name: "StaffDashboardView",
  data() {
    return {
      loading: true,
      error: "",
      stats: null,
      treks: [],
      difficultyBadge: DIFFICULTY_BADGE,
      trekStatusBadge: TREK_STATUS_BADGE,
      bookingStatusBadge: BOOKING_STATUS_BADGE,
      editableStatuses: EDITABLE_STATUSES,
      editingTrek: null,
      editForm: emptyEditForm(),
      editErrors: {},
      saving: false,
      participantsTrek: null,
      participants: [],
      participantsLoading: false,
      participantsError: "",
      cancellingId: null,
    };
  },
  async created() {
    await Promise.all([this.fetchDashboard(), this.fetchTreks()]);
  },
  mounted() {
    this.editModal = new bootstrap.Modal(this.$refs.editModalEl);
    this.participantsModal = new bootstrap.Modal(this.$refs.participantsModalEl);
  },
  methods: {
    async fetchDashboard() {
      try {
        const { data } = await api.get("/staff/dashboard");
        this.stats = data;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load your dashboard.";
      }
    },
    async fetchTreks() {
      this.loading = true;
      try {
        const { data } = await api.get("/staff/treks");
        this.treks = data.treks;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load your assigned treks.";
      } finally {
        this.loading = false;
      }
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleString();
    },

    openEditModal(trek) {
      this.editingTrek = trek;
      this.editForm = { available_slots: trek.available_slots, status: trek.status };
      this.editErrors = {};
      if (!this.editableStatuses.includes(trek.status)) {
        this.editForm.status = "open";
      }
      this.editModal.show();
    },
    async submitEdit() {
      this.saving = true;
      this.editErrors = {};
      try {
        await api.put(`/staff/treks/${this.editingTrek.id}`, this.editForm);
        this.editModal.hide();
        await Promise.all([this.fetchTreks(), this.fetchDashboard()]);
      } catch (err) {
        const data = err.response?.data;
        this.editErrors = data?.errors || {};
        if (!data?.errors) {
          this.editErrors._general = data?.message || "Could not update this trek.";
        }
      } finally {
        this.saving = false;
      }
    },

    async openParticipants(trek) {
      this.participantsTrek = trek;
      this.participants = [];
      this.participantsError = "";
      this.participantsLoading = true;
      this.participantsModal.show();
      try {
        const { data } = await api.get(`/staff/treks/${trek.id}/participants`);
        this.participants = data.participants;
      } catch (err) {
        this.participantsError = err.response?.data?.message || "Could not load participants.";
      } finally {
        this.participantsLoading = false;
      }
    },
    async cancelParticipant(booking) {
      const confirmed = await window.showConfirm(
        `Cancel ${booking.username}'s booking for this trek?`
      );
      if (!confirmed) return;
      this.cancellingId = booking.id;
      try {
        await api.post(`/staff/treks/${this.participantsTrek.id}/participants/${booking.id}/cancel`);
        window.showToast(`${booking.username}'s booking cancelled.`, "warning");
        await this.openParticipants(this.participantsTrek);
        await Promise.all([this.fetchTreks(), this.fetchDashboard()]);
      } catch (err) {
        window.showToast(
          err.response?.data?.message || "Could not cancel this booking.",
          "danger"
        );
      } finally {
        this.cancellingId = null;
      }
    },
  },
  template: `
    <div>
      <h1 class="h4 mb-4">Trek Staff Dashboard</h1>

      <div v-if="error" class="alert alert-danger">{{ error }}</div>

      <div v-if="stats" class="row g-3 mb-4">
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <span class="stat-icon chip-blue mb-2"><i class="bi bi-map"></i></span>
            <div class="stat-value">{{ stats.assigned_treks }}</div>
            <div class="stat-label">Assigned Treks</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <span class="stat-icon chip-green mb-2"><i class="bi bi-people"></i></span>
            <div class="stat-value">{{ stats.total_registered_trekkers }}</div>
            <div class="stat-label">Registered Trekkers</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <span class="stat-icon chip-orange mb-2"><i class="bi bi-ticket-perforated"></i></span>
            <div class="stat-value">{{ stats.total_available_slots }}</div>
            <div class="stat-label">Available Slots</div>
          </div>
        </div>
        <div class="col-6 col-md-3">
          <div class="stat-card">
            <span class="stat-icon chip-pink mb-2"><i class="bi bi-signpost-2"></i></span>
            <div class="stat-value">{{ stats.treks_by_status.open || 0 }}</div>
            <div class="stat-label">Open Treks</div>
          </div>
        </div>
      </div>

      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h2 class="h5 mb-0">My Treks</h2>
      </div>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading your treks&hellip;
      </div>
      <div v-else class="border rounded">
        <div v-if="treks.length === 0" class="p-4 text-secondary text-center">
          No treks assigned yet. You'll see them here once an admin assigns one to you.
        </div>
        <div v-else class="table-responsive">
          <table class="table table-borderless mb-0 align-middle">
            <thead class="border-bottom">
              <tr>
                <th>Trek</th>
                <th>Difficulty</th>
                <th>Duration</th>
                <th>Slots</th>
                <th>Status</th>
                <th>Registered</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trek in treks" :key="trek.id">
                <td>
                  <div class="fw-semibold">{{ trek.name }}</div>
                  <div class="small text-muted" v-if="trek.location">
                    <i class="bi bi-geo-alt me-1"></i>{{ trek.location }}
                  </div>
                </td>
                <td><span class="badge text-capitalize" :class="difficultyBadge[trek.difficulty]">{{ trek.difficulty }}</span></td>
                <td>{{ trek.duration_days }} {{ trek.duration_days === 1 ? 'day' : 'days' }}</td>
                <td>{{ trek.available_slots }}</td>
                <td><span class="badge text-capitalize" :class="trekStatusBadge[trek.status]">{{ trek.status }}</span></td>
                <td>{{ trek.active_bookings_count }}</td>
                <td class="text-center" style="white-space: nowrap;">
                  <button class="btn btn-sm btn-outline-primary me-1" @click="openEditModal(trek)" title="Update slots and status">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-secondary" @click="openParticipants(trek)" title="View participants">
                    <i class="bi bi-people"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" ref="editModalEl">
        <div class="modal-dialog">
          <div class="modal-content">
            <form @submit.prevent="submitEdit">
              <div class="modal-header">
                <h5 class="modal-title">Update Trek</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body" v-if="editingTrek">
                <h6 class="fw-semibold mb-1">{{ editingTrek.name }}</h6>
                <p class="text-muted small mb-3" v-if="editingTrek.location">{{ editingTrek.location }}</p>

                <div v-if="editErrors._general" class="alert alert-danger py-2">{{ editErrors._general }}</div>

                <div class="mb-3">
                  <label class="form-label">Available Slots</label>
                  <input
                    v-model.number="editForm.available_slots"
                    type="number"
                    min="0"
                    class="form-control"
                    :class="{ 'is-invalid': editErrors.available_slots }"
                    required
                  />
                  <div class="invalid-feedback">{{ editErrors.available_slots }}</div>
                </div>
                <div class="mb-0">
                  <label class="form-label">Status</label>
                  <select v-model="editForm.status" class="form-select" :class="{ 'is-invalid': editErrors.status }">
                    <option v-for="s in editableStatuses" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
                  </select>
                  <div class="invalid-feedback">{{ editErrors.status }}</div>
                  <div class="form-text">Marking a trek as "Completed" also closes out any still-booked reservations.</div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
                  {{ saving ? "Saving..." : "Save Changes" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" ref="participantsModalEl">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                Participants
                <span class="text-muted" v-if="participantsTrek">&mdash; {{ participantsTrek.name }}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div v-if="participantsLoading" class="loading-box">
                <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
                Loading participants&hellip;
              </div>
              <div v-else-if="participantsError" class="alert alert-danger">{{ participantsError }}</div>
              <div v-else-if="participants.length === 0" class="text-secondary text-center p-3">
                No trekkers have booked this trek yet.
              </div>
              <div v-else class="table-responsive">
                <table class="table table-borderless mb-0 align-middle">
                  <thead class="border-bottom">
                    <tr>
                      <th>Trekker</th>
                      <th>Booked On</th>
                      <th>Status</th>
                      <th>Payment</th>
                      <th class="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="p in participants" :key="p.id">
                      <td>
                        <div class="fw-semibold">{{ p.username }}</div>
                        <div class="small text-muted">{{ p.email }}</div>
                      </td>
                      <td class="small">{{ formatDate(p.booking_date) }}</td>
                      <td><span class="badge text-capitalize" :class="bookingStatusBadge[p.status]">{{ p.status }}</span></td>
                      <td><span class="text-muted small text-capitalize">{{ p.payment_status.replace(/_/g, ' ') }}</span></td>
                      <td class="text-center">
                        <button
                          v-if="p.status === 'booked'"
                          class="btn btn-sm btn-outline-danger"
                          :disabled="cancellingId === p.id"
                          @click="cancelParticipant(p)"
                        >
                          <span v-if="cancellingId === p.id" class="spinner-border spinner-border-sm me-1" role="status"></span>
                          {{ cancellingId === p.id ? "Cancelling..." : "Cancel" }}
                        </button>
                      </td>
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