import LoginView from "./views/Login.js";
import RegisterView from "./views/Register.js";
import AdminDashboardView from "./views/AdminDashboard.js";
import StaffDashboardView from "./views/StaffDashboard.js";
import UserDashboardView from "./views/UserDashboard.js";
import NotFoundView from "./views/NotFound.js";
import { authState, fetchCurrentUser, dashboardPathForRole } from "./auth.js";

const { createRouter, createWebHashHistory } = VueRouter;

// Hash-based routing (e.g. /#/login) so Flask only ever has to serve one
// real route ("/") -- no server-side catch-all needed for a page refresh.
const routes = [
  { path: "/", redirect: "/login" },
  { path: "/login", name: "login", component: LoginView, meta: { guestOnly: true } },
  { path: "/register", name: "register", component: RegisterView, meta: { guestOnly: true } },
  { path: "/admin", name: "admin", component: AdminDashboardView, meta: { role: "admin" } },
  { path: "/staff", name: "staff", component: StaffDashboardView, meta: { role: "staff" } },
  { path: "/user", name: "user", component: UserDashboardView, meta: { role: "user" } },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  // Resolve the session (token -> GET /api/auth/me) once, before the very
  // first navigation decision -- this is what makes a page refresh keep
  // you logged in instead of bouncing to /login.
  if (!authState.ready) {
    await fetchCurrentUser();
  }

  const isLoggedIn = !!authState.user;

  // Logged-in users shouldn't see the login/register forms again.
  if (to.meta.guestOnly && isLoggedIn) {
    return dashboardPathForRole(authState.user.role);
  }

  if (to.meta.role) {
    if (!isLoggedIn) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }
    // Logged in, but the wrong role for this route (e.g. a Trekker
    // hitting /admin directly) -- send them to their own dashboard
    // instead of a dead end.
    if (authState.user.role !== to.meta.role) {
      return dashboardPathForRole(authState.user.role);
    }
  }

  return true;
});

export default router;
