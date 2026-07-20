/* AI RFP Scout — REST client (fetch) */

const Api = (function () {
  "use strict";

  const cfg = () => window.APP_CONFIG || { API_BASE: "http://localhost:8000", TOKEN_KEY: "ai-rfp-scout-access-token" };

  function getToken() {
    return localStorage.getItem(cfg().TOKEN_KEY) || "";
  }

  function setToken(token) {
    if (token) localStorage.setItem(cfg().TOKEN_KEY, token);
    else localStorage.removeItem(cfg().TOKEN_KEY);
  }

  function showSpinner(show, message) {
    let el = document.getElementById("global-spinner");
    if (!el) {
      el = document.createElement("div");
      el.id = "global-spinner";
      el.className = "global-spinner";
      el.innerHTML =
        '<div class="global-spinner-card"><div class="global-spinner-ring"></div><div class="global-spinner-text" id="global-spinner-text">Loading…</div></div>';
      document.body.appendChild(el);
    }
    const text = document.getElementById("global-spinner-text");
    if (text) text.textContent = message || "Loading…";
    el.hidden = !show;
    el.setAttribute("aria-hidden", show ? "false" : "true");
  }

  class ApiError extends Error {
    constructor(message, status, code, details) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  async function request(path, options = {}) {
    const base = cfg().API_BASE.replace(/\/$/, "");
    const url = path.startsWith("http") ? path : base + path;
    const headers = Object.assign({}, options.headers || {});

    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }

    const token = getToken();
    if (token && !options.skipAuth) {
      headers["Authorization"] = "Bearer " + token;
    }

    let res;
    try {
      res = await fetch(url, Object.assign({}, options, { headers }));
    } catch (err) {
      throw new ApiError(
        "Cannot reach the API server. Is it running at " + base + "?",
        0,
        "network_error"
      );
    }

    let body = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        body = await res.json();
      } catch (_) {
        body = null;
      }
    }

    if (res.status === 401 && !options.skipAuth) {
      setToken("");
      localStorage.removeItem((cfg().SESSION_KEY) || "ai-rfp-scout-session-v2");
    }

    if (!res.ok) {
      const errObj = body && body.error ? body.error : null;
      const msg =
        (errObj && errObj.message) ||
        (body && body.message) ||
        res.statusText ||
        "Request failed";
      throw new ApiError(msg, res.status, (errObj && errObj.code) || "http_error", errObj && errObj.details);
    }

    return body;
  }

  // --- Auth ---
  async function login(email, password) {
    const body = await request("/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ email, password }),
    });
    // APIResponse: { success, data: { user, token } }
    const data = body.data || body;
    const token = data.token && data.token.access_token;
    if (token) setToken(token);
    return data;
  }

  async function register(payload) {
    const body = await request("/register", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({
        full_name: payload.name || payload.full_name,
        email: payload.email,
        password: payload.password,
        company_name: payload.company || payload.company_name || null,
        role: payload.role || "User",
      }),
    });
    const data = body.data || body;
    const token = data.token && data.token.access_token;
    if (token) setToken(token);
    return data;
  }

  async function me() {
    const body = await request("/me");
    return body.data || body;
  }

  async function logout() {
    try {
      await request("/logout", { method: "POST" });
    } catch (_) {
      /* ignore network errors on logout */
    }
    setToken("");
  }

  // --- Company ---
  function mapCompanyFromApi(c) {
    if (!c) return null;
    return {
      apiId: c.id,
      name: c.name || "",
      countriesServed: c.countries_served || [],
      servicesOffered: c.services || [],
      industryExpertise: c.industries || [],
      certifications: c.certifications || [],
      employees: c.employee_count || "",
      annualRevenue: c.revenue || "",
      technologyPartnerships: c.technology_expertise || [],
      website: c.website || "",
      description: c.description || "",
      caseStudies: [],
      lastSaved: c.updated_at || null,
    };
  }

  function mapCompanyToApi(p) {
    return {
      name: p.name || "",
      countries_served: p.countriesServed || [],
      industries: p.industryExpertise || [],
      services: p.servicesOffered || [],
      technology_expertise: p.technologyPartnerships || [],
      certifications: p.certifications || [],
      revenue: p.annualRevenue || null,
      employee_count: p.employees || null,
      website: p.website || null,
      description: p.description || null,
    };
  }

  async function getMyCompany() {
    const body = await request("/company");
    return mapCompanyFromApi(body.data);
  }

  async function createCompany(profile) {
    const body = await request("/company", {
      method: "POST",
      body: JSON.stringify(mapCompanyToApi(profile)),
    });
    return mapCompanyFromApi(body.data);
  }

  async function updateCompany(id, profile) {
    const body = await request("/company/" + id, {
      method: "PUT",
      body: JSON.stringify(mapCompanyToApi(profile)),
    });
    return mapCompanyFromApi(body.data);
  }

  async function saveCompany(profile) {
    if (profile && profile.apiId) {
      return updateCompany(profile.apiId, profile);
    }
    const existing = await getMyCompany();
    if (existing && existing.apiId) {
      return updateCompany(existing.apiId, profile);
    }
    return createCompany(profile);
  }

  // --- Dashboard ---
  async function getDashboard() {
    const body = await request("/dashboard");
    return body.data || body;
  }

  async function getDashboardKpis() {
    const body = await request("/dashboard/kpis");
    return body.data || body;
  }

  // --- RFPs ---
  function mapRfpFromApi(r) {
    if (!r) return null;
    return {
      id: r.external_id || String(r.id),
      apiId: r.id,
      title: r.title || "",
      buyer: r.customer || "",
      industry: r.industry || "",
      type: r.service_category || "",
      value: r.estimated_value || "",
      valueMid: 0,
      deadline: r.closing_date || "",
      posted: r.submission_date || "",
      status: r.status || "New",
      matchScore: r.match_score != null ? r.match_score : 0,
      source: "API",
      location: r.country || "",
      country: r.country || "",
      naics: "",
      setAside: "None",
      summary: r.description || "",
      requirements: Array.isArray(r.requirements) ? r.requirements : [],
      contacts: Array.isArray(r.contacts) ? r.contacts : [],
      risks: Array.isArray(r.risks) ? r.risks : [],
      aiInsights: Array.isArray(r.ai_insights) ? r.ai_insights : [],
      matchBreakdown: Array.isArray(r.match_breakdown) ? r.match_breakdown : [],
    };
  }

  function mapRfpToApi(data) {
    return {
      title: data.title,
      customer: data.buyer || data.customer,
      country: data.country || null,
      industry: data.industry || null,
      service_category: data.type || data.service_category || null,
      estimated_value: data.value || data.estimated_value || null,
      closing_date: data.deadline || data.closing_date || null,
      submission_date: data.posted || data.submission_date || null,
      description: data.summary || data.description || null,
      status: data.status || "New",
      external_id: data.id && String(data.id).startsWith("RFP-") ? data.id : null,
      requirements: data.requirements || [],
      contacts: data.contacts || [],
      risks: data.risks || [],
    };
  }

  async function listRfps(params) {
    const q = new URLSearchParams();
    if (params) {
      Object.keys(params).forEach((k) => {
        if (params[k] != null && params[k] !== "") q.set(k, params[k]);
      });
    }
    if (!q.has("page_size")) q.set("page_size", "100");
    const body = await request("/rfps?" + q.toString());
    const data = body.data || body;
    const items = (data.items || data || []).map(mapRfpFromApi);
    return {
      items,
      total: data.total != null ? data.total : items.length,
      page: data.page || 1,
      page_size: data.page_size || items.length,
      raw: data,
    };
  }

  async function createRfp(formData) {
    const body = await request("/rfps", {
      method: "POST",
      body: JSON.stringify(mapRfpToApi(formData)),
    });
    return mapRfpFromApi(body.data || body);
  }

  async function getRfp(apiId) {
    const body = await request("/rfps/" + apiId);
    return mapRfpFromApi(body.data || body);
  }

  /**
   * POST /analyze — runs the server-side AI provider (OpenAI when AI_PROVIDER=openai).
   * Body: { rfp_id: number }  // database id, not external RFP-YYYY-...
   * Returns: { match_score, summary, recommendation, risk }
   */
  async function analyzeRfp(rfpApiId) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("RFP has no server id yet — save it to the API first.", 400, "invalid_rfp_id");
    }
    // Endpoint returns AnalyzeResponse at root (not always wrapped in { data })
    const body = await request("/analyze", {
      method: "POST",
      body: JSON.stringify({ rfp_id: id }),
    });
    if (body && body.data && body.match_score == null) {
      return body.data;
    }
    return body;
  }

  async function getAiProviders() {
    const body = await request("/ai/providers");
    return body.data || body;
  }

  /**
   * POST /bid-advisor/evaluate
   * @param {number} rfpApiId - server RFP id
   * @param {object} [inputs] - manager inputs (resources, revenue target, etc.)
   * @param {boolean} [persist=true]
   */
  async function evaluateBidAdvisor(rfpApiId, inputs, persist) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request("/bid-advisor/evaluate", {
      method: "POST",
      body: JSON.stringify({
        rfp_id: id,
        inputs: inputs || {},
        persist: persist !== false,
      }),
    });
    return body.data || body;
  }

  async function getBidAdvisor(rfpApiId) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) return null;
    const body = await request("/bid-advisor/" + id);
    return body.data || null;
  }

  async function generateWinThemes(rfpApiId, inputs, persist) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request("/win-themes/generate", {
      method: "POST",
      body: JSON.stringify({
        rfp_id: id,
        inputs: inputs || {},
        persist: persist !== false,
      }),
    });
    return body.data || body;
  }

  async function regenerateWinThemes(rfpApiId, options) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const opts = options || {};
    const body = await request("/win-themes/regenerate", {
      method: "POST",
      body: JSON.stringify({
        rfp_id: id,
        inputs: opts.inputs || {},
        section: opts.section || null,
        existing: opts.existing || null,
        persist: opts.persist !== false,
      }),
    });
    return body.data || body;
  }

  async function getWinThemes(rfpApiId) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) return null;
    const body = await request("/win-themes/" + id);
    return body.data || null;
  }

  async function saveWinThemes(rfpApiId, content) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request("/win-themes/" + id, {
      method: "PUT",
      body: JSON.stringify({ content }),
    });
    return body.data || body;
  }

  async function generateClarifications(rfpApiId, options) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const opts = options || {};
    const body = await request("/clarifications/generate", {
      method: "POST",
      body: JSON.stringify({
        rfp_id: id,
        document_ids: opts.document_ids || null,
        extra_context: opts.extra_context || null,
        persist: opts.persist !== false,
      }),
    });
    return body.data || body;
  }

  async function getClarifications(rfpApiId) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) return null;
    const body = await request("/clarifications/" + id);
    return body.data || null;
  }

  async function saveClarifications(rfpApiId, pack) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request("/clarifications/" + id, {
      method: "PUT",
      body: JSON.stringify({ pack }),
    });
    return body.data || body;
  }

  async function updateClarificationQuestion(rfpApiId, questionId, update) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request(
      "/clarifications/" + id + "/questions/" + encodeURIComponent(questionId),
      {
        method: "PATCH",
        body: JSON.stringify(update || {}),
      }
    );
    return body.data || body;
  }

  async function exportClarifications(rfpApiId, format, includePending) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const q = new URLSearchParams();
    q.set("format", format || "email");
    if (includePending === false) q.set("include_pending", "false");
    const body = await request("/clarifications/" + id + "/export?" + q.toString());
    return body.data || body;
  }

  async function listProposalTemplates() {
    const body = await request("/proposal-drafts/templates");
    return body.data || body || [];
  }

  async function generateProposalDraft(rfpApiId, options) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const opts = options || {};
    const body = await request("/proposal-drafts/generate", {
      method: "POST",
      body: JSON.stringify({
        rfp_id: id,
        template_id: opts.template_id || "enterprise_standard",
        inputs: opts.inputs || {},
        include_win_themes: opts.include_win_themes !== false,
        persist: opts.persist !== false,
      }),
    });
    return body.data || body;
  }

  async function regenerateProposalSection(rfpApiId, sectionId, options) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const opts = options || {};
    const body = await request("/proposal-drafts/regenerate-section", {
      method: "POST",
      body: JSON.stringify({
        rfp_id: id,
        section_id: sectionId,
        template_id: opts.template_id || null,
        inputs: opts.inputs || null,
        existing: opts.existing || null,
        guidance: opts.guidance || null,
        persist: opts.persist !== false,
      }),
    });
    return body.data || body;
  }

  async function getProposalDraft(rfpApiId) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) return null;
    const body = await request("/proposal-drafts/" + id);
    return body.data || null;
  }

  async function saveProposalDraft(rfpApiId, draft) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request("/proposal-drafts/" + id, {
      method: "PUT",
      body: JSON.stringify({ draft }),
    });
    return body.data || body;
  }

  async function updateProposalSection(rfpApiId, sectionId, update) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const body = await request(
      "/proposal-drafts/" + id + "/sections/" + encodeURIComponent(sectionId),
      {
        method: "PATCH",
        body: JSON.stringify(update || {}),
      }
    );
    return body.data || body;
  }

  /**
   * Download proposal export (docx | pdf | markdown) as a browser file.
   */
  async function exportProposalDraft(rfpApiId, format) {
    const id = Number(rfpApiId);
    if (!id || Number.isNaN(id)) {
      throw new ApiError("Select an RFP saved on the server first.", 400, "invalid_rfp_id");
    }
    const base = (window.APP_CONFIG && window.APP_CONFIG.API_BASE
      ? window.APP_CONFIG.API_BASE
      : "http://localhost:8000"
    ).replace(/\/$/, "");
    const url = base + "/proposal-drafts/" + id + "/export?format=" + encodeURIComponent(format || "docx");
    const token = getToken();
    const res = await fetch(url, {
      headers: token ? { Authorization: "Bearer " + token } : {},
    });
    if (!res.ok) {
      let msg = res.statusText || "Export failed";
      try {
        const j = await res.json();
        msg = (j.error && j.error.message) || j.message || msg;
      } catch (_) {}
      throw new ApiError(msg, res.status, "export_error");
    }
    const blob = await res.blob();
    let filename = "proposal." + (format === "pdf" ? "pdf" : format === "markdown" || format === "md" ? "md" : "docx");
    const cd = res.headers.get("content-disposition") || "";
    const m = cd.match(/filename=\"?([^\";]+)\"?/i);
    if (m) filename = m[1];
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return { filename, size: blob.size };
  }

  return {
    ApiError,
    getToken,
    setToken,
    showSpinner,
    request,
    login,
    register,
    me,
    logout,
    getMyCompany,
    saveCompany,
    getDashboard,
    getDashboardKpis,
    listRfps,
    createRfp,
    getRfp,
    analyzeRfp,
    getAiProviders,
    evaluateBidAdvisor,
    getBidAdvisor,
    generateWinThemes,
    regenerateWinThemes,
    getWinThemes,
    saveWinThemes,
    generateClarifications,
    getClarifications,
    saveClarifications,
    updateClarificationQuestion,
    exportClarifications,
    listProposalTemplates,
    generateProposalDraft,
    regenerateProposalSection,
    getProposalDraft,
    saveProposalDraft,
    updateProposalSection,
    exportProposalDraft,
    mapCompanyFromApi,
    mapRfpFromApi,
  };
})();
