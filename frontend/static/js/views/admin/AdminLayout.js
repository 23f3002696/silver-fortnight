const NAV_LINKS = [
  { to: "/admin", label: "Overview" },
  { to: "/admin/treks", label: "Treks" },
  { to: "/admin/staff", label: "Trek Staff" },
  { to: "/admin/users", label: "Trekkers" },
  { to: "/admin/bookings", label: "Bookings" },
];

export default {
  name: "AdminLayout",
  data() {
    return { navLinks: NAV_LINKS };
  },
  template: `
    <div>
      <ul class="nav nav-pills mb-4 flex-wrap gap-2">
        <li class="nav-item" v-for="link in navLinks" :key="link.to">
          <router-link :to="link.to" class="nav-link" active-class="active" exact-active-class="active">
            {{ link.label }}
          </router-link>
        </li>
      </ul>
      <router-view />
    </div>
  `,
};
