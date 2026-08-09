import { api } from "../api.js";
import { authState } from "../auth.js";

// One small factory instead of copy-pasting the same component three
// times. Each role's dashboard will grow its own real content in later
// milestones (Admin Dashboard, Trek Staff Dashboard, User Dashboard) --
// for this milestone we're just proving the role-gated route + API call
// works end to end.
function createRoleDashboard({ name, title, endpoint }) {
  return {
    name,
    data() {
      return {
        authState,
        message: "",
        error: "",
        loading: true,
      };
    },
    async created() {
      try {
        const { data } = await api.get(endpoint);
        this.message = data.message;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load this dashboard.";
      } finally {
        this.loading = false;
      }
    },
    template: `
      <div>
        <h1 class="h4 mb-3">${title}</h1>
        <div v-if="loading" class="text-muted">Loading...</div>
        <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
        <div v-else class="alert alert-success mb-0">{{ message }}</div>
      </div>
    `,
  };
}

export { createRoleDashboard };
