import { api } from "../../api.js";
import { authState, setCurrentUser } from "../../auth.js";

export default {
  name: "UserProfile",
  data() {
    return {
      authState,
      form: {
        username: "",
        email: "",
        current_password: "",
        new_password: "",
        confirm_password: "",
      },
      fieldErrors: {},
      error: "",
      saving: false,
    };
  },
  created() {
    if (authState.user) {
      this.form.username = authState.user.username;
      this.form.email = authState.user.email;
    }
  },
  methods: {
    async submitForm() {
      this.error = "";
      this.fieldErrors = {};

      if (this.form.new_password && this.form.new_password !== this.form.confirm_password) {
        this.error = "New passwords do not match.";
        return;
      }

      const payload = { username: this.form.username, email: this.form.email };
      if (this.form.new_password) {
        payload.new_password = this.form.new_password;
        payload.current_password = this.form.current_password;
      }

      this.saving = true;
      try {
        const { data } = await api.put("/user/profile", payload);
        setCurrentUser(data.user);
        window.showToast("Your profile is up to date.", "success");
        this.form.current_password = "";
        this.form.new_password = "";
        this.form.confirm_password = "";
      } catch (err) {
        const data = err.response?.data;
        this.fieldErrors = data?.errors || {};
        if (!data?.errors) {
          this.error = data?.message || "We couldn't update your profile. Please try again.";
        }
      } finally {
        this.saving = false;
      }
    },
  },
  template: `
    <div class="row justify-content-center">
      <div class="col-12 col-md-8 col-lg-6">
        <h1 class="h4 mb-3">My Profile</h1>
        <p class="text-muted small mb-3">Keep your trail identity up to date &mdash; this is how the trek team reaches you.</p>

        <div class="card shadow-sm">
          <div class="card-body p-4 p-md-5">
            <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>

            <form @submit.prevent="submitForm">
              <div class="mb-3">
                <label class="form-label" for="username">Username</label>
                <input
                  id="username"
                  v-model.trim="form.username"
                  class="form-control"
                  :class="{ 'is-invalid': fieldErrors.username }"
                  required
                />
                <div class="invalid-feedback">{{ fieldErrors.username }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label" for="email">Email</label>
                <input
                  id="email"
                  v-model.trim="form.email"
                  type="email"
                  class="form-control"
                  :class="{ 'is-invalid': fieldErrors.email }"
                  required
                />
                <div class="invalid-feedback">{{ fieldErrors.email }}</div>
              </div>

              <hr class="my-4" />
              <h6 class="fw-semibold mb-3">
                <i class="bi bi-shield-lock me-2 text-primary"></i>Change Password
                <span class="text-muted small fw-normal">(optional)</span>
              </h6>

              <div class="mb-3">
                <label class="form-label" for="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  v-model="form.current_password"
                  type="password"
                  class="form-control"
                  :class="{ 'is-invalid': fieldErrors.current_password }"
                  placeholder="Only needed when changing your password"
                />
                <div class="invalid-feedback">{{ fieldErrors.current_password }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label" for="newPassword">New Password</label>
                <input
                  id="newPassword"
                  v-model="form.new_password"
                  type="password"
                  class="form-control"
                  :class="{ 'is-invalid': fieldErrors.new_password }"
                  minlength="6"
                />
                <div class="invalid-feedback">{{ fieldErrors.new_password }}</div>
              </div>
              <div class="mb-3">
                <label class="form-label" for="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  v-model="form.confirm_password"
                  type="password"
                  class="form-control"
                  minlength="6"
                />
              </div>

              <button type="submit" class="btn btn-primary w-100" :disabled="saving">
                <span v-if="saving" class="spinner-border spinner-border-sm me-2" role="status"></span>
                {{ saving ? "Saving..." : "Save Changes" }}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `,
};
