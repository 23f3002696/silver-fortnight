import { login, dashboardPathForRole } from "../auth.js";

export default {
  name: "LoginView",
  data() {
    return {
      username: "",
      password: "",
      error: "",
      loading: false,
    };
  },
  methods: {
    async handleSubmit() {
      this.error = "";
      this.loading = true;
      try {
        const user = await login(this.username, this.password);
        const redirect = this.$route.query.redirect;
        this.$router.push(redirect || dashboardPathForRole(user.role));
      } catch (err) {
        this.error =
          err.response?.data?.message || "Login failed. Please check your credentials and try again.";
      } finally {
        this.loading = false;
      }
    },
  },
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-sm-8 col-md-6 col-lg-4">
        <div class="card shadow-sm mt-5">
          <div class="card-body p-4">
          <h1 class="h4 mb-1 text-center">Sign in</h1>
          <p class="text-muted text-center small mb-4">
            Trekkers, Trek Staff, and Admin all sign in here.
          </p>

          <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

          <form @submit.prevent="handleSubmit">
            <div class="mb-3">
              <label class="form-label" for="username">Username</label>
              <input
                id="username"
                v-model.trim="username"
                class="form-control"
                required
                autofocus
              />
            </div>
            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input id="password" v-model="password" type="password" class="form-control" required />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="loading">
              {{ loading ? "Signing in..." : "Sign in" }}
            </button>
          </form>

          <p class="text-center small mt-3 mb-0">
            New trekker?
            <router-link to="/register">Create an account</router-link>
          </p>
          </div>
        </div>
      </div>
    </div>
  `,
};
