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
  },
  template: `
    <div class="min-vh-100 bg-light">
      <nav class="navbar navbar-expand navbar-dark bg-dark mb-4" v-if="authState.user">
        <div class="container">
          <span class="navbar-brand fw-bold">Trekking Management</span>
          <div class="d-flex align-items-center text-white">
            <span class="me-3 small text-capitalize">
              {{ authState.user.username }} &middot; {{ authState.user.role }}
            </span>
            <button class="btn btn-sm btn-outline-light" @click="handleLogout">Log out</button>
          </div>
        </div>
      </nav>
      <div class="container" :class="{ 'pt-4': !authState.user }">
        <router-view />
      </div>
    </div>
  `,
};

const app = createApp(App);
app.use(router);

// Wait for the first navigation (which resolves the session inside our
// router guard) to finish before mounting, so there's no flash of the
// wrong screen on refresh.
router.isReady().then(() => {
  app.mount("#app");
});
