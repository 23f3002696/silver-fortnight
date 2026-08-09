import { register, dashboardPathForRole } from "../auth.js";

export default {
  name: "RegisterView",
  data() {
    return {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      error: "",
      fieldErrors: {},
      loading: false,
    };
  },
  methods: {
    async handleSubmit() {
      this.error = "";
      this.fieldErrors = {};

      if (this.password !== this.confirmPassword) {
        this.error = "Passwords do not match.";
        return;
      }

      this.loading = true;
      try {
        const user = await register(this.username, this.email, this.password);
        this.$router.push(dashboardPathForRole(user.role));
      } catch (err) {
        const data = err.response?.data;
        this.error = data?.message || "Registration failed. Please try again.";
        this.fieldErrors = data?.errors || {};
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
          <h1 class="h4 mb-1 text-center">Create your trekker account</h1>
          <p class="text-muted text-center small mb-4">
            Admin and Trek Staff accounts are created for you &mdash; this form is for Trekkers only.
          </p>

          <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

          <form @submit.prevent="handleSubmit" novalidate>
            <div class="mb-3">
              <label class="form-label" for="username">Username</label>
              <input
                id="username"
                v-model.trim="username"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors.username }"
                required
                autofocus
              />
              <div class="invalid-feedback" v-if="fieldErrors.username">{{ fieldErrors.username }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="email">Email</label>
              <input
                id="email"
                v-model.trim="email"
                type="email"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors.email }"
                required
              />
              <div class="invalid-feedback" v-if="fieldErrors.email">{{ fieldErrors.email }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="password">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                class="form-control"
                :class="{ 'is-invalid': fieldErrors.password }"
                required
                minlength="6"
              />
              <div class="invalid-feedback" v-if="fieldErrors.password">{{ fieldErrors.password }}</div>
            </div>
            <div class="mb-3">
              <label class="form-label" for="confirmPassword">Confirm password</label>
              <input
                id="confirmPassword"
                v-model="confirmPassword"
                type="password"
                class="form-control"
                required
                minlength="6"
              />
            </div>
            <button type="submit" class="btn btn-primary w-100" :disabled="loading">
              {{ loading ? "Creating account..." : "Create account" }}
            </button>
          </form>

          <p class="text-center small mt-3 mb-0">
            Already have an account?
            <router-link to="/login">Sign in</router-link>
          </p>
          </div>
        </div>
      </div>
    </div>
  `,
};
