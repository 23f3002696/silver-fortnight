import { api } from "../../api.js";

const DIFFICULTIES = ["easy", "moderate", "hard"];
const STATUSES = ["pending", "approved", "open", "closed", "completed"];

const DIFFICULTY_BADGE = { easy: "text-bg-success", moderate: "text-bg-warning", hard: "text-bg-danger" };
const STATUS_BADGE = {
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

function emptyForm() {
  return {
    name: "",
    location: "",
    difficulty: "easy",
    duration_days: "",
    available_slots: "",
    status: "pending",
    start_date: "",
    end_date: "",
    description: "",
    assigned_staff_id: "",
  };
}

export default {
  name: "AdminTreks",
  data() {
    return {
      treks: [],
      staffOptions: [],
      loading: true,
      error: "",
      searchQuery: "",
      statusFilter: "",
      difficultyFilter: "",
      difficulties: DIFFICULTIES,
      statuses: STATUSES,
      difficultyBadge: DIFFICULTY_BADGE,
      statusBadge: STATUS_BADGE,
      bookingStatusBadge: BOOKING_STATUS_BADGE,
      form: emptyForm(),
      formErrors: {},
      saving: false,
      editingId: null,
      searchTimer: null,
      historyTrek: null,
      historyBookings: [],
      historyLoading: false,
      historyError: "",
    };
  },
  async created() {
    await Promise.all([this.fetchTreks(), this.fetchStaffOptions()]);
  },
  mounted() {
    this.modal = new bootstrap.Modal(this.$refs.trekModalEl);
    this.historyModal = new bootstrap.Modal(this.$refs.historyModalEl);
  },
  methods: {
    async fetchTreks() {
      this.loading = true;
      this.error = "";
      try {
        const params = {};
        if (this.searchQuery.trim()) params.q = this.searchQuery.trim();
        if (this.statusFilter) params.status = this.statusFilter;
        if (this.difficultyFilter) params.difficulty = this.difficultyFilter;
        const { data } = await api.get("/admin/treks", { params });
        this.treks = data.treks;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load treks.";
      } finally {
        this.loading = false;
      }
    },
    async fetchStaffOptions() {
      try {
        const { data } = await api.get("/admin/staff");
        this.staffOptions = data.staff;
      } catch (err) {
      }
    },
    onSearchInput() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.fetchTreks(), 300);
    },
    staffLabel(staff) {
      const name = staff.name || staff.username;
      return staff.is_active ? name : `${name} (deactivated)`;
    },
    openCreateModal() {
      this.editingId = null;
      this.form = emptyForm();
      this.formErrors = {};
      this.modal.show();
    },
    openEditModal(trek) {
      this.editingId = trek.id;
      this.form = {
        name: trek.name,
        location: trek.location || "",
        difficulty: trek.difficulty,
        duration_days: trek.duration_days,
        available_slots: trek.available_slots,
        status: trek.status,
        start_date: trek.start_date || "",
        end_date: trek.end_date || "",
        description: trek.description || "",
        assigned_staff_id: trek.assigned_staff_id || "",
      };
      this.formErrors = {};
      this.modal.show();
    },
    async submitForm() {
      this.saving = true;
      this.formErrors = {};
      const payload = {
        ...this.form,
        assigned_staff_id: this.form.assigned_staff_id || null,
      };
      try {
        if (this.editingId) {
          await api.put(`/admin/treks/${this.editingId}`, payload);
        } else {
          await api.post("/admin/treks", payload);
        }
        this.modal.hide();
        await this.fetchTreks();
      } catch (err) {
        const data = err.response?.data;
        this.formErrors = data?.errors || {};
        if (!data?.errors) {
          this.formErrors._general = data?.message || "Could not save this trek.";
        }
      } finally {
        this.saving = false;
      }
    },
    async deleteTrek(trek) {
      const confirmed = await window.showConfirm(
        `Delete "${trek.name}"? This cannot be undone.`
      );
      if (!confirmed) return;
      try {
        await api.delete(`/admin/treks/${trek.id}`);
        window.showToast(`"${trek.name}" deleted.`, "success");
        await this.fetchTreks();
      } catch (err) {
        window.showToast(
          err.response?.data?.message || "Could not delete this trek.",
          "danger"
        );
      }
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleString();
    },
    async openHistory(trek) {
      this.historyTrek = trek;
      this.historyBookings = [];
      this.historyError = "";
      this.historyLoading = true;
      this.historyModal.show();
      try {
        const { data } = await api.get("/admin/bookings", { params: { trek_id: trek.id } });
        this.historyBookings = data.bookings;
      } catch (err) {
        this.historyError = err.response?.data?.message || "Could not load booking history for this trek.";
      } finally {
        this.historyLoading = false;
      }
    },
  },
  template: `
    <div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="h4 mb-0">Treks</h1>
        <button class="btn btn-primary btn-sm" @click="openCreateModal">
          <i class="bi bi-plus-lg me-1"></i>New Trek
        </button>
      </div>

      <div class="toolbar row g-2 mb-3">
        <div class="col-12 col-md-6">
          <div class="input-group">
            <span class="input-group-text"><i class="bi bi-search"></i></span>
            <input
              v-model="searchQuery"
              @input="onSearchInput"
              type="search"
              class="form-control"
              placeholder="Search by name or location..."
            />
          </div>
        </div>
        <div class="col-6 col-md-3">
          <select v-model="statusFilter" @change="fetchTreks" class="form-select">
            <option value="">All statuses</option>
            <option v-for="s in statuses" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <select v-model="difficultyFilter" @change="fetchTreks" class="form-select">
            <option value="">All difficulties</option>
            <option v-for="d in difficulties" :key="d" :value="d">{{ d.charAt(0).toUpperCase() + d.slice(1) }}</option>
          </select>
        </div>
      </div>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading treks&hellip;
      </div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded">
        <div v-if="treks.length === 0" class="p-4 text-secondary text-center">
          No treks found. Try adjusting your search or create a new trek.
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
                <th>Staff</th>
                <th>Bookings</th>
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
                <td><span class="badge text-capitalize" :class="statusBadge[trek.status]">{{ trek.status }}</span></td>
                <td>
                  <span v-if="trek.assigned_staff_name">{{ trek.assigned_staff_name }}</span>
                  <span v-else class="text-muted small">Unassigned</span>
                </td>
                <td>{{ trek.bookings_count }}</td>
                <td class="text-center" style="white-space: nowrap;">
                  <button class="btn btn-sm btn-outline-secondary me-1" @click="openHistory(trek)" title="Booking history">
                    <i class="bi bi-clock-history"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-primary me-1" @click="openEditModal(trek)" title="Edit trek">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn btn-sm btn-outline-danger" @click="deleteTrek(trek)" title="Delete trek">
                    <i class="bi bi-trash3"></i>
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" ref="trekModalEl">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <form @submit.prevent="submitForm">
              <div class="modal-header">
                <h5 class="modal-title">{{ editingId ? "Edit Trek" : "New Trek" }}</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div v-if="formErrors._general" class="alert alert-danger py-2">{{ formErrors._general }}</div>

                <div class="row g-3">
                  <div class="col-md-8">
                    <label class="form-label">Trek Name</label>
                    <input v-model.trim="form.name" class="form-control" :class="{ 'is-invalid': formErrors.name }" required />
                    <div class="invalid-feedback">{{ formErrors.name }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Location</label>
                    <input v-model.trim="form.location" class="form-control" />
                  </div>

                  <div class="col-md-4">
                    <label class="form-label">Difficulty</label>
                    <select v-model="form.difficulty" class="form-select" :class="{ 'is-invalid': formErrors.difficulty }">
                      <option v-for="d in difficulties" :key="d" :value="d">{{ d.charAt(0).toUpperCase() + d.slice(1) }}</option>
                    </select>
                    <div class="invalid-feedback">{{ formErrors.difficulty }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Duration (days)</label>
                    <input
                      v-model.number="form.duration_days"
                      type="number"
                      min="1"
                      class="form-control"
                      :class="{ 'is-invalid': formErrors.duration_days }"
                      required
                    />
                    <div class="invalid-feedback">{{ formErrors.duration_days }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Available Slots</label>
                    <input
                      v-model.number="form.available_slots"
                      type="number"
                      min="0"
                      class="form-control"
                      :class="{ 'is-invalid': formErrors.available_slots }"
                      required
                    />
                    <div class="invalid-feedback">{{ formErrors.available_slots }}</div>
                  </div>

                  <div class="col-md-4">
                    <label class="form-label">Status</label>
                    <select v-model="form.status" class="form-select" :class="{ 'is-invalid': formErrors.status }">
                      <option v-for="s in statuses" :key="s" :value="s">{{ s.charAt(0).toUpperCase() + s.slice(1) }}</option>
                    </select>
                    <div class="invalid-feedback">{{ formErrors.status }}</div>
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">Start Date</label>
                    <input v-model="form.start_date" type="date" class="form-control" />
                  </div>
                  <div class="col-md-4">
                    <label class="form-label">End Date</label>
                    <input
                      v-model="form.end_date"
                      type="date"
                      class="form-control"
                      :class="{ 'is-invalid': formErrors.end_date }"
                    />
                    <div class="invalid-feedback">{{ formErrors.end_date }}</div>
                  </div>

                  <div class="col-md-6">
                    <label class="form-label">Assigned Trek Staff</label>
                    <select
                      v-model="form.assigned_staff_id"
                      class="form-select"
                      :class="{ 'is-invalid': formErrors.assigned_staff_id }"
                    >
                      <option value="">Unassigned</option>
                      <option v-for="s in staffOptions" :key="s.id" :value="s.id">{{ staffLabel(s) }}</option>
                    </select>
                    <div class="invalid-feedback">{{ formErrors.assigned_staff_id }}</div>
                  </div>

                  <div class="col-12">
                    <label class="form-label">Description</label>
                    <textarea v-model.trim="form.description" class="form-control" rows="3"></textarea>
                  </div>
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
                  {{ saving ? "Saving..." : "Save Trek" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" ref="historyModalEl">
        <div class="modal-dialog modal-lg">
          <div class="modal-content">
            <div class="modal-header">
              <h5 class="modal-title">
                Booking History
                <span class="text-muted" v-if="historyTrek">&mdash; {{ historyTrek.name }}</span>
              </h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
              <div v-if="historyLoading" class="loading-box">
                <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
                Loading history&hellip;
              </div>
              <div v-else-if="historyError" class="alert alert-danger">{{ historyError }}</div>
              <div v-else-if="historyBookings.length === 0" class="text-secondary text-center p-3">
                No trekkers have ever booked this trek.
              </div>
              <div v-else class="table-responsive">
                <table class="table table-borderless mb-0 align-middle">
                  <thead class="border-bottom">
                    <tr>
                      <th>Trekker</th>
                      <th>Booked On</th>
                      <th>Status</th>
                      <th>Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="b in historyBookings" :key="b.id">
                      <td>
                        <div class="fw-semibold">{{ b.username }}</div>
                        <div class="small text-muted">{{ b.email }}</div>
                      </td>
                      <td class="small">{{ formatDate(b.booking_date) }}</td>
                      <td><span class="badge text-capitalize" :class="bookingStatusBadge[b.status]">{{ b.status }}</span></td>
                      <td><span class="text-muted small text-capitalize">{{ b.payment_status.replace(/_/g, ' ') }}</span></td>
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