import { api } from "../../api.js";

export default {
  name: "AdminUsers",
  data() {
    return {
      users: [],
      loading: true,
      error: "",
      searchQuery: "",
      searchTimer: null,
    };
  },
  async created() {
    await this.fetchUsers();
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
    </div>
  `,
};
