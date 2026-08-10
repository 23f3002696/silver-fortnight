import { api } from "../../api.js";

function emptyForm() {
  return { username: "", email: "", password: "", name: "", contact_number: "" };
}

export default {
  name: "AdminStaff",
  data() {
    return {
      staff: [],
      loading: true,
      error: "",
      searchQuery: "",
      searchTimer: null,
      form: emptyForm(),
      formErrors: {},
      saving: false,
    };
  },
  async created() {
    await this.fetchStaff();
  },
  mounted() {
    this.modal = new bootstrap.Modal(this.$refs.staffModalEl);
  },
  methods: {
    async fetchStaff() {
      this.loading = true;
      this.error = "";
      try {
        const params = {};
        if (this.searchQuery.trim()) params.q = this.searchQuery.trim();
        const { data } = await api.get("/admin/staff", { params });
        this.staff = data.staff;
      } catch (err) {
        this.error = err.response?.data?.message || "We couldn't load the trek staff.";
      } finally {
        this.loading = false;
      }
    },
    onSearchInput() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.fetchStaff(), 300);
    },
    openCreateModal() {
      this.form = emptyForm();
      this.formErrors = {};
      this.modal.show();
    },
    async submitForm() {
      this.saving = true;
      this.formErrors = {};
      try {
        await api.post("/admin/staff", this.form);
        this.modal.hide();
        await this.fetchStaff();
      } catch (err) {
        const data = err.response?.data;
        this.formErrors = data?.errors || {};
        if (!data?.errors) {
          this.formErrors._general = data?.message || "We couldn't create this Trek Staff account.";
        }
      } finally {
        this.saving = false;
      }
    },
    async toggleActive(member) {
      try {
        await api.post(`/admin/staff/${member.id}/toggle-active`);
        window.showToast(
          `"${member.name || member.username}" ${member.is_active ? "deactivated" : "activated"}.`,
          "success"
        );
        await this.fetchStaff();
      } catch (err) {
        window.showToast(
          err.response?.data?.message || "We couldn't update this staff member.",
          "danger"
        );
      }
    },
    async deleteStaff(member) {
      const confirmed = await window.showConfirm(
        `Remove Trek Staff "${member.username}"? This can't be undone.`
      );
      if (!confirmed) return;
      try {
        await api.delete(`/admin/staff/${member.id}`);
        window.showToast(`"${member.username}" removed.`, "success");
        await this.fetchStaff();
      } catch (err) {
        window.showToast(
          err.response?.data?.message || "We couldn't remove this staff member.",
          "danger"
        );
      }
    },
  },
  template: `
    <div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <h1 class="h4 mb-0">Trek Staff</h1>
          <p class="text-muted small mb-0">The crew that leads your treks &mdash; add members and assign them to trails.</p>
        </div>
        <button class="btn btn-primary btn-sm" @click="openCreateModal">
          <i class="bi bi-person-plus me-1"></i>Add Staff
        </button>
      </div>

      <div class="toolbar mb-3">
        <div class="input-group">
          <span class="input-group-text"><i class="bi bi-search"></i></span>
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            type="search"
            class="form-control"
            placeholder="Search by name, username, or email..."
          />
        </div>
      </div>

      <div v-if="loading" class="loading-box">
        <span class="spinner-border spinner-border-sm text-primary" role="status"></span>
        Loading trek staff&hellip;
      </div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded">
        <div v-if="staff.length === 0" class="p-4 text-secondary text-center">No trek staff found. Add your first staff member to start assigning treks.</div>
        <div
          v-for="member in staff"
          :key="member.id"
          class="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 p-3 border-bottom"
        >
          <div class="d-flex align-items-center gap-3">
            <span class="avatar">{{ (member.name || member.username).charAt(0).toUpperCase() }}</span>
            <div>
              <span class="fw-semibold" :class="{ 'text-danger text-decoration-line-through': !member.is_active }">
                {{ member.name || member.username }}
              </span>
              <span v-if="!member.is_active" class="badge text-bg-danger ms-1">Deactivated</span>
              <div class="small text-muted mt-1">
                {{ member.username }} &middot; {{ member.email }}
                <span v-if="member.contact_number">&middot; {{ member.contact_number }}</span>
                &middot; {{ member.assigned_treks_count }} {{ member.assigned_treks_count === 1 ? 'trek' : 'treks' }} assigned
              </div>
            </div>
          </div>
          <div class="d-flex gap-2 align-items-center flex-shrink-0 ms-auto">
            <button
              class="btn btn-sm rounded-pill px-3"
              :class="member.is_active ? 'btn-outline-danger' : 'btn-outline-success'"
              @click="toggleActive(member)"
            >
              <i class="bi" :class="member.is_active ? 'bi-person-x' : 'bi-person-check'" style="margin-right:0.3rem;"></i>
              {{ member.is_active ? "Deactivate" : "Activate" }}
            </button>
            <button
              class="btn btn-outline-danger btn-sm rounded-pill px-2"
              @click="deleteStaff(member)"
              title="Remove"
            >
              <i class="bi bi-trash3"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="modal fade" tabindex="-1" ref="staffModalEl">
        <div class="modal-dialog">
          <div class="modal-content">
            <form @submit.prevent="submitForm">
              <div class="modal-header">
                <h5 class="modal-title">Add Trek Staff</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
              </div>
              <div class="modal-body">
                <div v-if="formErrors._general" class="alert alert-danger py-2">{{ formErrors._general }}</div>
                <p class="text-muted small">
                  Trek Staff accounts are invite-only &mdash; members can sign in but can't register themselves.
                </p>
                <div class="mb-3">
                  <label class="form-label">Username</label>
                  <input
                    v-model.trim="form.username"
                    class="form-control"
                    :class="{ 'is-invalid': formErrors.username }"
                    required
                  />
                  <div class="invalid-feedback">{{ formErrors.username }}</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Email</label>
                  <input
                    v-model.trim="form.email"
                    type="email"
                    class="form-control"
                    :class="{ 'is-invalid': formErrors.email }"
                    required
                  />
                  <div class="invalid-feedback">{{ formErrors.email }}</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Password</label>
                  <input
                    v-model="form.password"
                    type="password"
                    class="form-control"
                    :class="{ 'is-invalid': formErrors.password }"
                    required
                    minlength="6"
                  />
                  <div class="invalid-feedback">{{ formErrors.password }}</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Display Name</label>
                  <input v-model.trim="form.name" class="form-control" />
                </div>
                <div class="mb-0">
                  <label class="form-label">Contact Number</label>
                  <input v-model.trim="form.contact_number" class="form-control" />
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="submit" class="btn btn-primary" :disabled="saving">
                  {{ saving ? "Creating..." : "Create Account" }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
};
