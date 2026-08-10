export default {
  name: "NotFoundView",
  template: `
    <div class="text-center py-5 mt-4">
      <span class="stat-icon chip-orange d-block mx-auto mb-3" style="width:3.2rem;height:3.2rem;font-size:1.4rem;">
        <i class="bi bi-signpost-split"></i>
      </span>
      <h1 class="h4 mb-1">You've wandered off the trail</h1>
      <p class="text-muted small mb-4">This page doesn't exist. Let's get you back to base camp.</p>
      <router-link to="/" class="btn btn-primary btn-sm">
        <i class="bi bi-house me-1"></i>Back to base camp
      </router-link>
    </div>
  `,
};
