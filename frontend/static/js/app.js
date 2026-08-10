import router from "./router.js";
import { authState, logout } from "./auth.js";

const { createApp } = Vue;

const App = {
  name: "App",
  data() {
    return { authState };
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
  },
  template: `
    <div class="min-vh-100 bg-light">
      <nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom mb-4">
        <div class="container">
          <router-link class="navbar-brand" to="/">
            Trek<span class="text-muted"><i>ON</i> <i class="bi bi-compass"></i></span>
          </router-link>
          <button
            class="navbar-toggler"
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
                  <router-link class="nav-link" to="/admin" exact-active-class="active">Overview</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/treks" active-class="active">Treks</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/staff" active-class="active">Trek Staff</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/users" active-class="active">Trekkers</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/admin/bookings" active-class="active">Bookings</router-link>
                </li>
              </template>
              <template v-else-if="authState.user && authState.user.role === 'staff'">
                <li class="nav-item">
                  <router-link class="nav-link" to="/staff" active-class="active">Dashboard</router-link>
                </li>
              </template>
              <template v-else-if="authState.user && authState.user.role === 'user'">
                <li class="nav-item">
                  <router-link class="nav-link" to="/user" exact-active-class="active">Overview</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/user/treks" active-class="active">Browse Treks</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/user/bookings" active-class="active">My Bookings</router-link>
                </li>
                <li class="nav-item">
                  <router-link class="nav-link" to="/user/profile" active-class="active">Profile</router-link>
                </li>
              </template>
              <template v-else>
                <li class="nav-item">
                  <router-link class="nav-link" to="/register" active-class="active">Register</router-link>
                </li>
              </template>
            </ul>

            <div class="d-flex flex-column flex-lg-row align-items-stretch align-items-lg-center gap-2 mt-2 mt-lg-0 ms-lg-auto">
              <span v-if="authState.user" class="small text-muted text-capitalize d-flex align-items-center">
                {{ authState.user.username }} &middot; {{ authState.user.role }}
              </span>
              <button v-if="authState.user" class="btn btn-outline-danger fw-bold" @click="handleLogout">
                <i class="bi bi-box-arrow-in-left"></i> Logout
              </button>
            </div>
          </div>
        </div>
      </nav>
      <div class="container">
        <router-view />
      </div>
    </div>
  `,
};

const app = createApp(App);
app.use(router);

router.isReady().then(() => {
  app.mount("#app");
});