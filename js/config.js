/* AI RFP Scout API configuration */
(function () {
  "use strict";

  const existing = window.APP_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  const queryApiBase = params.get("apiBase");
  if (queryApiBase) {
    window.localStorage.setItem("ai-rfp-scout-api-base", queryApiBase);
  }
  const configuredApiBase =
    queryApiBase ||
    existing.API_BASE ||
    window.localStorage.getItem("ai-rfp-scout-api-base");

  // The production container serves the frontend and API from one origin.
  // Retain the localhost default only when the HTML file is opened directly.
  const defaultApiBase =
    window.location.protocol === "file:" ? "http://localhost:8000" : "";

  window.APP_CONFIG = {
    API_BASE: (configuredApiBase || defaultApiBase).replace(/\/$/, ""),
    TOKEN_KEY: "ai-rfp-scout-access-token",
    SESSION_KEY: "ai-rfp-scout-session-v2",
  };
})();
