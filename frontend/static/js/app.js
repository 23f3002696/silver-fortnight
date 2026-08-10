import router from "./router.js";
import { authState, logout } from "./auth.js";

const { createApp } = Vue;

let _nextToastId = 0;

const App = {
  name: "App",
  data() {
    return {
      authState,
      toasts: [],
      confirmState: { show: false, message: "", resolve: null },
    };
  },
  methods: {
    async handleLogout() {
      await logout();
      this.$router.push("/login");
    },
    closeMobileNav() {
      const el = this.$refs.navCollapse;
      if (el && el.classList.contains("show")) {
        bootstrap.Collapse.getOrCreateInstance(el).hide();
      }
    },
    showToast(message, type = "success") {
      const id = ++_nextToastId;
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 4500);
    },
    showConfirm(message) {
      return new Promise((resolve) => {
        this.confirmState = { show: true, message, resolve };
      });
    },
    _onConfirmYes() {
      if (this.confirmState.resolve) this.confirmState.resolve(true);
      this.confirmState = { show: false, message: "", resolve: null };
    },
    _onConfirmNo() {
      if (this.confirmState.resolve) this.confirmState.resolve(false);
      this.confirmState = { show: false, message: "", resolve: null };
    },
  },
  template: `
    <div class="min-vh-100">

      <nav class="navbar navbar-expand-lg sticky-top border-bottom shadow-sm">
        <div class="container">
          <router-link class="navbar-brand d-flex align-items-center gap-2" to="/">
            <span class="brand-icon"><i class="bi bi-compass"></i></span>
            <span class="fw-bold">Silver Fortnight</span>
          </router-link>

          <button
            class="navbar-toggler border-0"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span class="navbar-toggler-icon"></span>
          </button>

          <div class="collapse navbar-collapse" id="navbarNav" ref="navCollapse">
            <ul class="navbar-nav me-auto mb-2 mb-lg-0" @click="closeMobileNav">

              <template v-if="authState.user && authState.user.role === 'admin'">
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin" exact-active-class="active">
                    <i class="bi bi-speedometer2 me-1"></i>Overview
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/treks" active-class="active">
                    <i class="bi bi-map me-1"></i>Treks
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/staff" active-class="active">
                    <i class="bi bi-person-badge me-1"></i>Trek Staff
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/users" active-class="active">
                    <i class="bi bi-people me-1"></i>Trekkers
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/bookings" active-class="active">
                    <i class="bi bi-journal-check me-1"></i>Bookings
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/analytics" active-class="active">
                    <i class="bi bi-graph-up me-1"></i>Analytics
                  </router-link>
                </li>
              </template>

              <template v-else-if="authState.user && authState.user.role === 'staff'">
                <li class="nav-item">
                  <router-link class="nav-link" to="/staff" active-class="active">
                    <i class="bi bi-speedometer2 me-1"></i>Dashboard
                  </router-link>
                </li>
              </template>

              <template v-else-if="authState.user && authState.user.role === 'user'">
                <li class="nav-item">
                  <router-link class="nav-link" to="/user" exact-active-class="active">
                    <i class="bi bi-house me-1"></i>Overview
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/user/treks" active-class="active">
                    <i class="bi bi-compass me-1"></i>Explore Treks
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/user/bookings" active-class="active">
                    <i class="bi bi-bookmark me-1"></i>My Bookings
                  </router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/user/profile" active-class="active">
                    <i class="bi bi-person-circle me-1"></i>Profile
                  </router-link>
                </li>
              </template>

              <template v-else>
                <li class="nav-item">
                  <router-link class="nav-link" to="/login" active-class="active">Sign in</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/register" active-class="active">Sign up</router-link>
                </li>
              </template>
            </ul>

            <div class="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2 mt-3 mt-lg-0 ms-lg-3">
              <span v-if="authState.user" class="small text-muted d-flex align-items-center gap-2">
                <span class="avatar" style="width:1.9rem;height:1.9rem;font-size:0.8rem;">
                  {{ authState.user.username.charAt(0).toUpperCase() }}
                </span>
                <span class="fw-semibold text-body">{{ authState.user.username }}</span>
                <span class="badge bg-primary-subtle text-primary-emphasis rounded-pill text-capitalize">
                  {{ authState.user.role }}
                </span>
              </span>
              <button v-if="authState.user" class="btn btn-sm btn-outline-danger" @click="handleLogout">
                <i class="bi bi-box-arrow-right me-1"></i>Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main class="container py-4">
        <router-view />
      </main>

      <div class="position-fixed bottom-0 end-0 p-3" style="z-index: 1200;">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="toast show align-items-center border-0 mb-2 shadow-sm"
          :class="'text-bg-' + toast.type"
          role="alert"
          aria-live="assertive"
        >
          <div class="d-flex align-items-center">
            <div class="toast-body d-flex align-items-center gap-2">
              <i v-if="toast.type === 'success'" class="bi bi-check-circle-fill flex-shrink-0"></i>
              <i v-else-if="toast.type === 'danger'" class="bi bi-exclamation-circle-fill flex-shrink-0"></i>
              <i v-else-if="toast.type === 'warning'" class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
              <i v-else class="bi bi-info-circle-fill flex-shrink-0"></i>
              {{ toast.message }}
            </div>
            <button
              type="button"
              class="btn-close btn-close-white me-2 m-auto flex-shrink-0"
              @click="toasts = toasts.filter(t => t.id !== toast.id)"
              aria-label="Close"
            ></button>
          </div>
        </div>
      </div>

      <div
        v-if="confirmState.show"
        class="modal d-block"
        tabindex="-1"
        style="background: rgba(0,0,0,.45);"
        @keydown.esc="_onConfirmNo"
      >
        <div class="modal-dialog modal-dialog-centered modal-sm">
          <div class="modal-content border-0 shadow-lg" style="border-radius: 0.875rem;">
            <div class="modal-body text-center px-4 pt-4 pb-3">
              <i class="bi bi-question-circle-fill text-warning fs-1 d-block mb-3"></i>
              <p class="mb-0 fw-medium">{{ confirmState.message }}</p>
            </div>
            <div class="modal-footer border-0 justify-content-center pt-0 pb-4 gap-2">
              <button class="btn btn-outline-secondary px-4" @click="_onConfirmNo">Cancel</button>
              <button class="btn btn-danger px-4" @click="_onConfirmYes">Confirm</button>
            </div>
          </div>
        </div>
      </div>

    </div>
  `,
};

const app = createApp(App);
app.use(router);

router.isReady().then(() => {
  const instance = app.mount("#app");
  window.showToast = (msg, type) => instance.showToast(msg, type);
  window.showConfirm = (msg) => instance.showConfirm(msg);
});
