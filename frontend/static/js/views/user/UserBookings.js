import { api } from "../../api.js";

const STATUSES = ["booked", "cancelled", "completed"];
const STATUS_BADGE = {
  booked: "text-bg-info",
  cancelled: "text-bg-danger",
  completed: "text-bg-success",
};
const DIFFICULTY_BADGE = { easy: "text-bg-success", moderate: "text-bg-warning", hard: "text-bg-danger" };
const PAYMENT_BADGE = {
  paid: "text-bg-success",
  pending: "text-bg-warning",
  failed: "text-bg-danger",
  not_required: "text-bg-secondary",
};
const PAYABLE_STATUSES = ["pending", "failed"];

export default {
  name: "UserBookings",
  data() {
    return {
      bookings: [],
      loading: true,
      error: "",
      statusFilter: "",
      statuses: STATUSES,
      statusBadge: STATUS_BADGE,
      difficultyBadge: DIFFICULTY_BADGE,
      paymentBadge: PAYMENT_BADGE,
      cancellingId: null,
      exporting: false,
      exportStatus: "", 
      exportMessage: "",
      payment: {
        show: false,
        booking: null,
        cardName: "",
        cardNumber: "",
        expiry: "",
        cvv: "",
        errors: {},
        paying: false,
      },
    };
  },
  async created() {
    await this.fetchBookings();
  },
  methods: {
    async fetchBookings() {
      this.loading = true;
      this.error = "";
      try {
        const params = {};
        if (this.statusFilter) params.status = this.statusFilter;
        const { data } = await api.get("/user/bookings", { params });
        this.bookings = data.bookings;
      } catch (err) {
        this.error = err.response?.data?.message || "Could not load your trekking history.";
      } finally {
        this.loading = false;
      }
    },
    formatDate(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleString();
    },
    formatDay(value) {
      if (!value) return "\u2014";
      return new Date(value).toLocaleDateString();
    },
    async cancelBooking(booking) {
      const confirmed = await window.showConfirm(
        `Cancel your booking for "${booking.trek_name}"?`
      );
      if (!confirmed) return;
      this.cancellingId = booking.id;
      try {
        await api.post(`/user/bookings/${booking.id}/cancel`);
        window.showToast("Booking cancelled.", "warning");
        await this.fetchBookings();
      } catch (err) {
        window.showToast(
          err.response?.data?.message || "Could not cancel this booking.",
          "danger"
        );
      } finally {
        this.cancellingId = null;
      }
    },

    async exportCsv() {
      this.exporting = true;
      this.exportStatus = "";
      this.exportMessage = "";
      try {
        const { data } = await api.post("/user/bookings/export");
        await this.pollExportStatus(data.task_id);
      } catch (err) {
        this.exporting = false;
        this.exportStatus = "error";
        this.exportMessage = err.response?.data?.message || "Could not start the export.";
      }
    },
    async pollExportStatus(taskId) {
      try {
        const { data } = await api.get(`/user/bookings/export/${taskId}`);
        if (!data.ready) {
          setTimeout(() => this.pollExportStatus(taskId), 1500);
          return;
        }
        if (data.status === "FAILURE" || !data.filename) {
          this.exporting = false;
          this.exportStatus = "error";
          this.exportMessage = data.message || "The export failed. Please try again.";
          window.showToast(this.exportMessage, "danger");
          return;
        }
        await this.downloadCsv(taskId);
        this.exporting = false;
        this.exportStatus = "ready";
        this.exportMessage = "Download started \u2014 we also emailed you a confirmation.";
        window.showToast(this.exportMessage, "success");
      } catch (err) {
        this.exporting = false;
        this.exportStatus = "error";
        this.exportMessage = "Could not check the export status.";
        window.showToast(this.exportMessage, "danger");
      }
    },
    async downloadCsv(taskId) {
      const response = await api.get(`/user/bookings/export/${taskId}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "my-trekking-history.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    },

    canPay(booking) {
      return booking.status === "booked" && PAYABLE_STATUSES.includes(booking.payment_status);
    },
    formatPaymentStatus(status) {
      return (status || "").replace("_", " ");
    },
    openPayment(booking) {
      this.payment = {
        show: true,
        booking,
        cardName: "",
        cardNumber: "",
        expiry: "",
        cvv: "",
        errors: {},
        paying: false,
      };
    },
    closePayment() {
      if (this.payment.paying) return;
      this.payment.show = false;
      this.payment.booking = null;
    },
    validatePayment() {
      const errors = {};
      const cardNumber = this.payment.cardNumber.replace(/[\s-]/g, "");
      if (!/^\d{16}$/.test(cardNumber)) {
        errors.card_number = "Card number must be exactly 16 digits.";
      }
      if (!this.payment.cardName.trim()) {
        errors.card_name = "Name on card is required.";
      }
      const expiryMatch = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(this.payment.expiry.trim());
      if (!expiryMatch) {
        errors.expiry = "Expiry must be in MM/YY format.";
      } else {
        const now = new Date();
        const expYear = 2000 + parseInt(expiryMatch[2], 10);
        const expMonth = parseInt(expiryMatch[1], 10);
        if (expYear < now.getFullYear() || (expYear === now.getFullYear() && expMonth < now.getMonth() + 1)) {
          errors.expiry = "This card has expired.";
        }
      }
      if (!/^\d{3,4}$/.test(this.payment.cvv.trim())) {
        errors.cvv = "CVV must be 3 or 4 digits.";
      }
      this.payment.errors = errors;
      return Object.keys(errors).length === 0;
    },
    async submitPayment() {
      if (!this.validatePayment()) return;
      this.payment.paying = true;
      try {
        const { data } = await api.post(`/user/bookings/${this.payment.booking.id}/pay`, {
          card_name: this.payment.cardName.trim(),
          card_number: this.payment.cardNumber,
          expiry: this.payment.expiry.trim(),
          cvv: this.payment.cvv.trim(),
        });
        this.payment.show = false;
        this.payment.booking = null;
        window.showToast(data.message, "success");
        await this.fetchBookings();
      } catch (err) {
        const body = err.response?.data;
        if (body?.booking) {
          // Keep the row's payment badge in sync (e.g. declined -> failed).
          const row = this.bookings.find((b) => b.id === body.booking.id);
          if (row) row.payment_status = body.booking.payment_status;
        }
        if (body?.errors) {
          this.payment.errors = body.errors;
        } else {
          window.showToast(body?.message || "Payment could not be processed.", "danger");
        }
      } finally {
        this.payment.paying = false;
      }
    },
  },
  template: `
    <div>
      <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
        <h1 class="h4 mb-0">My Bookings</h1>
        <div class="text-end">
          <button class="btn btn-sm btn-outline-primary" :disabled="exporting" @click="exportCsv">
            <span v-if="exporting" class="spinner-border spinner-border-sm me-1" role="status"></span>
            {{ exporting ? "Preparing export..." : "Export CSV" }}
          </button>
          <div v-if="exportStatus === 'ready'" class="small text-success mt-1">{{ exportMessage }}</div>
          <div v-if="exportStatus === 'error'" class="small text-danger mt-1">{{ exportMessage }}</div>
        </div>
      </div>

      <div class="mb-3">
        <select v-model="statusFilter" @change="fetchBookings" class="form-select" style="max-width: 220px;">
          <option value="">All statuses</option>
          <option v-for="s in statuses" :key="s" :value="s">{{ s }}</option>
        </select>
      </div>

      <div v-if="loading" class="text-muted">Loading...</div>
      <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
      <div v-else class="border rounded">
        <div v-if="bookings.length === 0" class="p-4 text-secondary text-center">
          No bookings yet. Head over to Browse Treks to plan your next adventure.
        </div>
        <div v-else class="table-responsive">
          <table class="table table-borderless mb-0 align-middle">
            <thead class="border-bottom">
              <tr>
                <th>Trek</th>
                <th>Difficulty</th>
                <th>Dates</th>
                <th>Booked On</th>
                <th>Status</th>
                <th>Payment</th>
                <th class="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="booking in bookings" :key="booking.id">
                <td>
                  <div class="fw-medium">{{ booking.trek_name }}</div>
                  <div class="small text-muted" v-if="booking.trek_location">{{ booking.trek_location }}</div>
                </td>
                <td><span class="badge" :class="difficultyBadge[booking.trek_difficulty]">{{ booking.trek_difficulty }}</span></td>
                <td class="small">{{ formatDay(booking.trek_start_date) }} &ndash; {{ formatDay(booking.trek_end_date) }}</td>
                <td>{{ formatDate(booking.booking_date) }}</td>
                <td><span class="badge" :class="statusBadge[booking.status]">{{ booking.status }}</span></td>
                <td><span class="badge" :class="paymentBadge[booking.payment_status]">{{ formatPaymentStatus(booking.payment_status) }}</span></td>
                <td class="text-center">
                  <template v-if="booking.status === 'booked'">
                    <button
                      v-if="canPay(booking)"
                      class="btn btn-sm btn-success me-1"
                      @click="openPayment(booking)"
                    >
                      <i class="bi bi-credit-card me-1"></i>Pay
                    </button>
                    <button
                      class="btn btn-sm btn-outline-danger"
                      :disabled="cancellingId === booking.id"
                      @click="cancelBooking(booking)"
                    >
                      {{ cancellingId === booking.id ? "Cancelling..." : "Cancel" }}
                    </button>
                  </template>
                  <span v-else class="text-muted small">&mdash;</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- ── Payment simulation modal ── -->
      <div
        v-if="payment.show"
        class="modal d-block"
        tabindex="-1"
        style="background: rgba(0,0,0,.45);"
        @keydown.esc="closePayment"
      >
        <div class="modal-dialog modal-dialog-centered">
          <div class="modal-content border-0 shadow-lg">
            <div class="modal-header border-0 pb-0">
              <h5 class="modal-title">
                <i class="bi bi-credit-card me-2 text-success"></i>Complete Payment
              </h5>
              <button type="button" class="btn-close" aria-label="Close" @click="closePayment"></button>
            </div>
            <div class="modal-body">
              <p class="text-muted small mb-3">
                Paying for <strong>{{ payment.booking?.trek_name }}</strong>.
                This is a <strong>payment simulation</strong> &mdash; no real money is charged.
                Use any 16-digit card number; a card ending in <code>0000</code> simulates a declined payment.
              </p>

              <form @submit.prevent="submitPayment">
                <div class="mb-3">
                  <label class="form-label">Name on Card</label>
                  <input
                    v-model.trim="payment.cardName"
                    class="form-control"
                    :class="{ 'is-invalid': payment.errors.card_name }"
                    placeholder="As printed on the card"
                  />
                  <div v-if="payment.errors.card_name" class="invalid-feedback">{{ payment.errors.card_name }}</div>
                </div>
                <div class="mb-3">
                  <label class="form-label">Card Number</label>
                  <input
                    v-model.trim="payment.cardNumber"
                    class="form-control"
                    :class="{ 'is-invalid': payment.errors.card_number }"
                    placeholder="1234 5678 9012 3456"
                    inputmode="numeric"
                    maxlength="19"
                  />
                  <div v-if="payment.errors.card_number" class="invalid-feedback">{{ payment.errors.card_number }}</div>
                </div>
                <div class="row g-2">
                  <div class="col-6">
                    <label class="form-label">Expiry (MM/YY)</label>
                    <input
                      v-model.trim="payment.expiry"
                      class="form-control"
                      :class="{ 'is-invalid': payment.errors.expiry }"
                      placeholder="09/28"
                      maxlength="5"
                    />
                    <div v-if="payment.errors.expiry" class="invalid-feedback">{{ payment.errors.expiry }}</div>
                  </div>
                  <div class="col-6">
                    <label class="form-label">CVV</label>
                    <input
                      v-model.trim="payment.cvv"
                      type="password"
                      class="form-control"
                      :class="{ 'is-invalid': payment.errors.cvv }"
                      placeholder="123"
                      inputmode="numeric"
                      maxlength="4"
                    />
                    <div v-if="payment.errors.cvv" class="invalid-feedback">{{ payment.errors.cvv }}</div>
                  </div>
                </div>
              </form>
            </div>
            <div class="modal-footer border-0 pt-0">
              <button class="btn btn-outline-secondary" :disabled="payment.paying" @click="closePayment">Cancel</button>
              <button class="btn btn-success" :disabled="payment.paying" @click="submitPayment">
                <span v-if="payment.paying" class="spinner-border spinner-border-sm me-1" role="status"></span>
                {{ payment.paying ? "Processing..." : "Pay Now" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};