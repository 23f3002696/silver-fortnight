import { register, dashboardPathForRole } from "../auth.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      touched: { username: false, email: false, password: false, confirmPassword: false },
      loading: false,
    };
  },
  computed: {
    usernameError() {
      if (!this.touched.username) return null;
      if (!this.username.trim()) return "Username is required.";
      if (this.username.trim().length < 3) return "Must be at least 3 characters.";
      return null;
    },
    emailError() {
      if (!this.touched.email) return null;
      if (!this.email.trim()) return "Email is required.";
      if (!EMAIL_RE.test(this.email.trim())) return "Enter a valid email address.";
      return null;
    },
    passwordError() {
      if (!this.touched.password) return null;
      if (!this.password) return "Password is required.";
      if (this.password.length < 6) return "Must be at least 6 characters.";
      return null;
    },
    confirmPasswordError() {
      if (!this.touched.confirmPassword) return null;
      if (this.confirmPassword !== this.password) return "Passwords do not match.";
      return null;
    },
    canSubmit() {
      return (
        this.username.trim().length >= 3 &&
        EMAIL_RE.test(this.email.trim()) &&
        this.password.length >= 6 &&
        this.password === this.confirmPassword &&
        !this.loading
      );
    },
  },
  methods: {
    touch(field) {
      this.touched[field] = true;
    },
    async handleSubmit() {
      Object.keys(this.touched).forEach((k) => (this.touched[k] = true));
      if (!this.canSubmit) return;

      this.error = "";
      this.fieldErrors = {};
      this.loading = true;
      try {
        const user = await register(this.username.trim(), this.email.trim(), this.password);
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
      <div class="col-12 col-sm-9 col-md-7 col-lg-5">
        <div class="card shadow-sm mt-4">
          <div class="card-body p-4 p-md-5">

            <div class="text-center mb-4">
              <span class="stat-icon chip-green d-block mx-auto mb-3" style="width:3rem;height:3rem;font-size:1.3rem;">
                <i class="bi bi-person-plus"></i>
              </span>
              <h1 class="h5 mb-1">Join the community</h1>
              <p class="text-muted small mb-0">
                Create your trekker account in under a minute. Trek staff and
                admin accounts are created by an administrator.
              </p>
            </div>

            <div v-if="error" class="alert alert-danger py-2 small">{{ error }}</div>

            <form @submit.prevent="handleSubmit" novalidate>

              <div class="mb-3">
                <label class="form-label" for="reg-username">Username</label>
                <input
                  id="reg-username"
                  v-model.trim="username"
                  @blur="touch('username')"
                  class="form-control"
                  :class="{
                    'is-invalid': usernameError || fieldErrors.username,
                    'is-valid':   touched.username && !usernameError && !fieldErrors.username && username.length >= 3
                  }"
                  placeholder="At least 3 characters"
                  autocomplete="username"
                  autofocus
                />
                <div class="invalid-feedback">{{ usernameError || fieldErrors.username }}</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="reg-email">Email</label>
                <input
                  id="reg-email"
                  v-model.trim="email"
                  @blur="touch('email')"
                  type="email"
                  class="form-control"
                  :class="{
                    'is-invalid': emailError || fieldErrors.email,
                    'is-valid':   touched.email && !emailError && !fieldErrors.email && email.trim()
                  }"
                  placeholder="you@example.com"
                  autocomplete="email"
                />
                <div class="invalid-feedback">{{ emailError || fieldErrors.email }}</div>
              </div>

              <div class="mb-3">
                <label class="form-label" for="reg-password">Password</label>
                <input
                  id="reg-password"
                  v-model="password"
                  @blur="touch('password')"
                  type="password"
                  class="form-control"
                  :class="{
                    'is-invalid': passwordError || fieldErrors.password,
                    'is-valid':   touched.password && !passwordError && !fieldErrors.password && password.length >= 6
                  }"
                  placeholder="At least 6 characters"
                  autocomplete="new-password"
                />
                <div class="invalid-feedback">{{ passwordError || fieldErrors.password }}</div>
              </div>

              <div class="mb-4">
                <label class="form-label" for="reg-confirm">Confirm password</label>
                <input
                  id="reg-confirm"
                  v-model="confirmPassword"
                  @blur="touch('confirmPassword')"
                  @input="touched.confirmPassword && touch('confirmPassword')"
                  type="password"
                  class="form-control"
                  :class="{
                    'is-invalid': touched.confirmPassword && confirmPasswordError,
                    'is-valid':   touched.confirmPassword && !confirmPasswordError && confirmPassword
                  }"
                  placeholder="Repeat your password"
                  autocomplete="new-password"
                />
                <div class="invalid-feedback">{{ confirmPasswordError }}</div>
              </div>

              <button type="submit" class="btn btn-primary w-100" :disabled="loading">
                <span v-if="loading" class="spinner-border spinner-border-sm me-2" role="status"></span>
                {{ loading ? "Creating account..." : "Join Silver Fortnight" }}
              </button>
            </form>

            <p class="text-center small mt-4 mb-0">
              Already part of the community?
              <router-link to="/login">Sign in</router-link>
            </p>
          </div>
        </div>
      </div>
    </div>
  `,
};
