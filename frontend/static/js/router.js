import LoginView from "./views/Login.js";
import RegisterView from "./views/Register.js";
import PublicLanding from "./views/PublicLanding.js";
import AdminLayout from "./views/admin/AdminLayout.js";
import AdminOverview from "./views/admin/AdminOverview.js";
import AdminTreks from "./views/admin/AdminTreks.js";
import AdminStaff from "./views/admin/AdminStaff.js";
import AdminUsers from "./views/admin/AdminUsers.js";
import AdminBookings from "./views/admin/AdminBookings.js";
import AdminAnalytics from "./views/admin/AdminAnalytics.js";
import StaffDashboardView from "./views/StaffDashboard.js";
import UserLayout from "./views/user/UserLayout.js";
import UserOverview from "./views/user/UserOverview.js";
import UserTreks from "./views/user/UserTreks.js";
import UserBookings from "./views/user/UserBookings.js";
import UserProfile from "./views/user/UserProfile.js";
import NotFoundView from "./views/NotFound.js";
import { authState, fetchCurrentUser, dashboardPathForRole } from "./auth.js";

const { createRouter, createWebHashHistory } = VueRouter;

const routes = [
  { path: "/", name: "home", component: PublicLanding },
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
      { path: "analytics", name: "admin-analytics", component: AdminAnalytics },
    ],
  },
  { path: "/staff", name: "staff", component: StaffDashboardView, meta: { role: "staff" } },
  {
    path: "/user",
    component: UserLayout,
    meta: { role: "user" },
    children: [
      { path: "", name: "user-overview", component: UserOverview },
      { path: "treks", name: "user-treks", component: UserTreks },
      { path: "bookings", name: "user-bookings", component: UserBookings },
      { path: "profile", name: "user-profile", component: UserProfile },
    ],
  },
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