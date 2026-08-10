import { api } from "../../api.js";

const DIFFICULTIES = ["easy", "moderate", "hard"];
const DIFFICULTY_BADGE = { easy: "text-bg-success", moderate: "text-bg-warning", hard: "text-bg-danger" };
const TREK_STATUS_BADGE = {
  pending: "text-bg-secondary",
  approved: "text-bg-info",
  open: "text-bg-success",
  closed: "text-bg-dark",
  completed: "text-bg-primary",
};

export default {
  name: "UserTreks",
  data() {
    return {
      treks: [],
      loading: true,
      error: "",
      searchQuery: "",
      difficultyFilter: "",
      minDuration: "",
      maxDuration: "",
      difficulties: DIFFICULTIES,
      difficultyBadge: DIFFICULTY_BADGE,
      trekStatusBadge: TREK_STATUS_BADGE,
      searchTimer: null,
      bookingId: null,
    };
  },
  async created() {
    await this.fetchTreks();
  },
  methods: {
    async fetchTreks() {
      this.loading = true;
      this.error = "";
      try {
        const params = {};
        if (this.searchQuery.trim()) params.q = this.searchQuery.trim();
        if (this.difficultyFilter) params.difficulty = this.difficultyFilter;
        if (this.minDuration !== "") params.min_duration = this.minDuration;
        if (this.maxDuration !== "") params.max_duration = this.maxDuration;
        const { data } = await api.get("/user/treks", { params });
        this.treks = data.treks;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load treks.";
      } finally {
        this.loading = false;
      }
    },
    onSearchInput() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => this.fetchTreks(), 300);
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleDateString();
    },
    canBook(trek) {
      return trek.status === "open" && trek.available_slots > 0 && trek.user_booking_status !== "booked";
    },
    async bookTrek(trek) {
      this.bookingId = trek.id;
      try {
        const { data } = await api.post(`/user/treks/${trek.id}/book`);
        window.showToast(data.message || "Trek booked successfully!", "success");
        await this.fetchTreks();
      } catch (err) {
        window.showToast(
          err.response?.data?.message || "Could not book this trek.",
          "danger"
        );
      } finally {
        this.bookingId = null;
      }
    },
  },
  template: `
    <div>
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h1 class="h4 mb-0">Browse Treks</h1>
      </div>

      <div class="row g-2 mb-3">
        <div class="col-12 col-md-4">
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            type="search"
            class="form-control"
            placeholder="Search by name or location..."
          />
        </div>
        <div class="col-6 col-md-2">
          <select v-model="difficultyFilter" @change="fetchTreks" class="form-select">
            <option value="">All difficulties</option>
            <option v-for="d in difficulties" :key="d" :value="d">{{ d }}</option>
          </select>
        </div>
        <div class="col-6 col-md-3">
          <input
            v-model="minDuration"
            @input="onSearchInput"
            type="number"
            min="0"
            class="form-control"
            placeholder="Min duration (days)"
          />
        </div>
        <div class="col-6 col-md-3">
          <input
            v-model="maxDuration"
            @input="onSearchInput"
            type="number"
            min="0"
            class="form-control"
            placeholder="Max duration (days)"
          />
        </div>
      </div>

      <div v-if="loading" class="text-muted">Loading...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded">
        <div v-if="treks.length === 0" class="p-4 text-secondary text-center">
          No treks match your search right now. Try adjusting your filters.
        </div>
        <div v-else class="table-responsive">
          <table class="table table-borderless mb-0 align-middle">
            <thead class="border-bottom">
              <tr>
                <th>Name</th>
                <th>Difficulty</th>
                <th>Duration</th>
                <th>Dates</th>
                <th>Slots</th>
                <th>Status</th>
                <th class="text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="trek in treks" :key="trek.id">
                <td>
                  <div class="fw-medium">{{ trek.name }}</div>
                  <div class="small text-muted" v-if="trek.location">{{ trek.location }}</div>
                </td>
                <td><span class="badge" :class="difficultyBadge[trek.difficulty]">{{ trek.difficulty }}</span></td>
                <td>{{ trek.duration_days }}d</td>
                <td class="small">{{ formatDate(trek.start_date) }} &ndash; {{ formatDate(trek.end_date) }}</td>
                <td>{{ trek.available_slots }}</td>
                <td><span class="badge" :class="trekStatusBadge[trek.status]">{{ trek.status }}</span></td>
                <td class="text-center" style="white-space: nowrap;">
                  <span v-if="trek.user_booking_status === 'booked'" class="badge text-bg-info">Booked</span>
                  <span v-else-if="trek.user_booking_status === 'completed'" class="badge text-bg-primary">Completed</span>
                  <span v-else-if="trek.status !== 'open'" class="text-muted small">Not open yet</span>
                  <span v-else-if="trek.available_slots <= 0" class="badge text-bg-secondary">Full</span>
                  <button
                    v-else
                    class="btn btn-sm btn-primary"
                    :disabled="bookingId === trek.id"
                    @click="bookTrek(trek)"
                  >
                    {{ bookingId === trek.id ? "Booking..." : "Book" }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
};
