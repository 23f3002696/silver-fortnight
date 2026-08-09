import { api, getToken, setToken } from "./api.js";

const { reactive } = Vue;

// Single shared, reactive piece of state for the whole app -- simple
// alternative to Pinia/Vuex that needs no build step.
const authState = reactive({
  user: null, // { id, username, email, role, is_active, created_at }
  ready: false, // true once we've checked localStorage for an existing session
});

// Called once, before the first route resolves, so refreshing the page
// doesn't bounce a logged-in user back to /login.
async function fetchCurrentUser() {
  const token = getToken();
  if (!token) {
    authState.user = null;
    authState.ready = true;
    return;
  }

  try {
    const { data } = await api.get("/auth/me");
    authState.user = data.user;
  } catch (err) {
    authState.user = null;
    setToken(null);
  } finally {
    authState.ready = true;
  }
}

async function login(username, password) {
  const { data } = await api.post("/auth/login", { username, password });
  setToken(data.access_token);
  authState.user = data.user;
  return data.user;
}

async function register(username, email, password) {
  const { data } = await api.post("/auth/register", { username, email, password });
  setToken(data.access_token);
  authState.user = data.user;
  return data.user;
}

async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (err) {
    // Even if this fails (e.g. token already expired), still clear
    // things client-side below.
  }
  setToken(null);
  authState.user = null;
}

function dashboardPathForRole(role) {
  switch (role) {
    case "admin":
      return "/admin";
    case "staff":
      return "/staff";
    case "user":
      return "/user";
    default:
      return "/login";
  }
}

export { authState, fetchCurrentUser, login, register, logout, dashboardPathForRole };
