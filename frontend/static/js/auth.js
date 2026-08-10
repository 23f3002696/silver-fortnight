import { api, getToken, setToken } from "./api.js";

const { reactive } = Vue;

const authState = reactive({
  user: null,
  ready: false,
});


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
  }
  setToken(null);
  authState.user = null;
}


function setCurrentUser(user) {
  authState.user = user;
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

export { authState, fetchCurrentUser, login, register, logout, setCurrentUser, dashboardPathForRole };