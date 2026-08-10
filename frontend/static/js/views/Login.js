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
      if (!this.username.trim() || !this.password) {
        this.error = "Please enter your username and password.";
        return;
      }
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
        <div class="card shadow-sm mt-5 border-0">
          <div class="card-body p-4">

            <div class="text-center mb-4">
              <i class="bi bi-compass text-primary fs-2 d-block mb-2"></i>
              <h1 class="h5 mb-1">Sign in</h1>
              <p class="text-muted small mb-0">Trekkers, Trek Staff, and Admin all sign in here.</p>
            </div>

            <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>

            <form @submit.prevent="handleSubmit">
              <div class="mb-3">
                <label class="form-label" for="login-username">Username</label>
                <input
                  id="login-username"
                  v-model.trim="username"
                  class="form-control"
                  placeholder="Your username"
                  autocomplete="username"
                  autofocus
                />
              </div>
              <div class="mb-4">
                <label class="form-label" for="login-password">Password</label>
                <input
                  id="login-password"
                  v-model="password"
                  type="password"
                  class="form-control"
                  placeholder="Your password"
                  autocomplete="current-password"
                />
              </div>
              <button type="submit" class="btn btn-primary w-100" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
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
