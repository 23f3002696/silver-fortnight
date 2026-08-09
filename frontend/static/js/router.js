import LoginView from "./views/Login.js";
import RegisterView from "./views/Register.js";
import AdminLayout from "./views/admin/AdminLayout.js";
import AdminOverview from "./views/admin/AdminOverview.js";
import AdminTreks from "./views/admin/AdminTreks.js";
import AdminStaff from "./views/admin/AdminStaff.js";
import AdminUsers from "./views/admin/AdminUsers.js";
import AdminBookings from "./views/admin/AdminBookings.js";
import StaffDashboardView from "./views/StaffDashboard.js";
import UserDashboardView from "./views/UserDashboard.js";
import NotFoundView from "./views/NotFound.js";
import { authState, fetchCurrentUser, dashboardPathForRole } from "./auth.js";

const { createRouter, createWebHashHistory } = VueRouter;

const routes = [
  { path: "/", redirect: "/login" },
  { path: "/login", name: "login", component: LoginView, meta: { guestOnly: true } },
  { path: "/register", name: "register", component: RegisterView, meta: { guestOnly: true } },
  {
    path: "/admin",
    component: AdminLayout,
    meta: { role: "admin" },
    children: [
      { path: "", name: "admin-overview", component: AdminOverview },
      { path: "treks", name: "admin-treks", component: AdminTreks },
      { path: "staff", name: "admin-staff", component: AdminStaff },
      { path: "users", name: "admin-users", component: AdminUsers },
      { path: "bookings", name: "admin-bookings", component: AdminBookings },
    ],
  },
  { path: "/staff", name: "staff", component: StaffDashboardView, meta: { role: "staff" } },
  { path: "/user", name: "user", component: UserDashboardView, meta: { role: "user" } },
  { path: "/:pathMatch(.*)*", name: "not-found", component: NotFoundView },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to) => {
  if (!authState.ready) {
    await fetchCurrentUser();
  }

  const isLoggedIn = !!authState.user;

  if (to.meta.guestOnly && isLoggedIn) {
    return dashboardPathForRole(authState.user.role);
  }

  if (to.meta.role) {
    if (!isLoggedIn) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }
    if (authState.user.role !== to.meta.role) {
      return dashboardPathForRole(authState.user.role);
    }
  }

  return true;
});

export default router;
