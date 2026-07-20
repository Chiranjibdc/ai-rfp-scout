/* AI RFP Scout — Auth (JWT via REST API) */

const Auth = (function () {
  "use strict";

  const cfg = () =>
    window.APP_CONFIG || {
      SESSION_KEY: "ai-rfp-scout-session-v2",
      TOKEN_KEY: "ai-rfp-scout-access-token",
    };

  function getSession() {
    try {
      const raw = localStorage.getItem(cfg().SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.email) return null;
      if (!Api.getToken()) return null;
      if (session.expiresAt && Date.now() > session.expiresAt) {
        clearSession();
        return null;
      }
      return session;
    } catch (_) {
      return null;
    }
  }

  function setSession(user, remember) {
    const days = remember === false ? 1 : 14;
    const session = {
      userId: user.id,
      name: user.full_name || user.name || "",
      email: user.email,
      company: user.company_name || user.company || "",
      role: user.role || "User",
      loggedInAt: new Date().toISOString(),
      expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
    };
    localStorage.setItem(cfg().SESSION_KEY, JSON.stringify(session));
    return session;
  }

  function clearSession() {
    localStorage.removeItem(cfg().SESSION_KEY);
    if (typeof Api !== "undefined") Api.setToken("");
  }

  function isLoggedIn() {
    return !!(getSession() && Api.getToken());
  }

  function currentUser() {
    const s = getSession();
    if (!s) return null;
    return {
      id: s.userId,
      name: s.name,
      email: s.email,
      company: s.company,
      role: s.role,
    };
  }

  function initials(name) {
    const parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  async function login({ email, password, remember }) {
    try {
      const data = await Api.login(email, password);
      const user = data.user || data;
      setSession(
        {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          company_name: user.company_name,
          role: user.role,
        },
        remember !== false
      );
      return { ok: true, user: currentUser(), session: getSession() };
    } catch (err) {
      return { ok: false, error: err.message || "Login failed" };
    }
  }

  async function register({ name, email, password, confirmPassword, company, role }) {
    if (!name || String(name).trim().length < 2) {
      return { ok: false, error: "Please enter your full name." };
    }
    if (password !== confirmPassword) {
      return { ok: false, error: "Passwords do not match." };
    }
    try {
      const data = await Api.register({ name, email, password, company, role });
      const user = data.user || data;
      setSession(
        {
          id: user.id,
          full_name: user.full_name,
          email: user.email,
          company_name: user.company_name,
          role: user.role,
        },
        true
      );
      return { ok: true, user: currentUser(), session: getSession() };
    } catch (err) {
      return { ok: false, error: err.message || "Registration failed" };
    }
  }

  async function logout() {
    try {
      await Api.logout();
    } catch (_) {
      /* ignore */
    }
    clearSession();
  }

  return {
    login,
    register,
    logout,
    isLoggedIn,
    getSession,
    currentUser,
    initials,
    clearSession,
  };
})();
