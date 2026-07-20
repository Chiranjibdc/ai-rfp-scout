/* AI RFP Scout — Application Logic */

(function () {
  "use strict";

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

  const PROFILE_STORAGE_KEY = "ai-rfp-scout-company-profile-v1";
  const RFPS_STORAGE_KEY = "ai-rfp-scout-rfps-v1";
  const DEFAULT_COMPANY_SEED = JSON.parse(JSON.stringify(APP_DATA.company));

  const SEARCH_PAGE_SIZE = 5;
  const SERVICE_CATEGORY_OPTIONS = [
    "MSP / Cloud",
    "BPO / CX",
    "MSP / Service Desk",
    "Cybersecurity",
    "Data & Analytics",
    "Automation",
    "ERP / Consulting",
    "Other",
  ];
  const INDUSTRY_OPTIONS = [
    "Banking & Financial Services",
    "Insurance",
    "Healthcare",
    "Government",
    "Technology",
    "Retail",
    "Manufacturing",
    "Telecom",
    "Energy & Utilities",
    "Travel & Hospitality",
    "Other",
  ];
  const STATUS_OPTIONS = ["New", "Qualifying", "Proposal", "Submitted", "No-Go", "Won", "Lost"];

  const DEFAULT_SEARCH_FILTERS = {
    country: "",
    industry: "",
    service: "",
    valueRange: "",
    deadline: "",
    keywords: "",
  };

  let state = {
    page: "dashboard",
    selectedRfpId: null,
    searchQuery: "",
    filters: { ...DEFAULT_SEARCH_FILTERS },
    searchSort: { key: "matchScore", dir: "desc" },
    searchPage: 1,
    searchPageSize: SEARCH_PAGE_SIZE,
    proposalOpen: {},
    settings: JSON.parse(JSON.stringify(APP_DATA.settings)),
    profile: null,
    profileDirty: false,
    /** @type {object|null} Last GET /dashboard payload (API KPIs + charts) */
    dashboardApi: null,
    /** True while bootstrapping company / RFPs / dashboard from the API */
    bootstrapping: false,
    compliance: {
      rows: null,
      uploadedFile: null,
      filterStatus: "",
      filterOwner: "",
      extracting: false,
    },
    proposal: {
      sections: null,
      activeId: "executive-summary",
      dirty: false,
      lastSaved: null,
    },
    showAddRfpForm: false,
    /** Latest Bid/No-Bid Advisor result for decision dashboard */
    bidAdvisor: {
      result: null,
      loading: false,
      error: null,
      inputs: {
        available_resources: "",
        revenue_target: "",
        customer_profile: "",
        past_projects: "",
        geographic_notes: "",
        certification_notes: "",
        competition_notes: "",
        strategic_notes: "",
      },
    },
    winThemes: {
      result: null,
      dirty: false,
      loading: false,
      error: null,
      inputs: {
        customer_industry: "",
        business_challenges: "",
        rfp_scope: "",
        company_capabilities: "",
        competitor_landscape: "",
        extra_notes: "",
      },
    },
    clarifications: {
      pack: null,
      filterCategory: "",
      filterStatus: "",
      error: null,
      extraContext: "",
      exportPreview: null,
    },
    proposalDraft: {
      draft: null,
      templates: [],
      templatesLoaded: false,
      templateId: "enterprise_standard",
      activeSectionId: "executive_summary",
      dirty: false,
      error: null,
      includeWinThemes: true,
      pastLibraryText: "",
      tone: "professional",
      emphasis: "",
      extraNotes: "",
    },
  };

  const PROPOSAL_STORAGE_KEY = "ai-rfp-scout-proposal-workspace-v1";
  const PROPOSAL_SECTION_DEFS = [
    { id: "executive-summary", title: "Executive Summary" },
    { id: "win-themes", title: "Win Themes" },
    { id: "solution-overview", title: "Solution Overview" },
    { id: "delivery-model", title: "Delivery Model" },
    { id: "governance", title: "Governance" },
    { id: "pricing-assumptions", title: "Pricing Assumptions" },
    { id: "risks", title: "Risks" },
    { id: "clarifications", title: "Clarifications" },
  ];

  const COMPLIANCE_STORAGE_KEY = "ai-rfp-scout-compliance-matrix-v1";
  const RESPONSE_STATUSES = () =>
    APP_DATA.responseStatuses || ["Not Started", "In Progress", "Comply", "Partial", "Exception", "N/A"];
  const COMPLIANCE_OWNERS = () =>
    APP_DATA.complianceOwners ||
    (APP_DATA.settings?.team || []).map((t) => t.name).concat(["Unassigned"]);

  // ---------- Company Profile Store ----------
  const PROFILE_SUGGESTIONS = {
    countriesServed: [
      "United States",
      "Canada",
      "United Kingdom",
      "Ireland",
      "Germany",
      "India",
      "Philippines",
      "Mexico",
      "Brazil",
      "Australia",
      "Singapore",
      "UAE",
      "South Africa",
    ],
    servicesOffered: [
      "Managed Cloud Services",
      "Contact Center BPO",
      "Managed IT / MSP",
      "Cybersecurity",
      "Application Modernization",
      "Data & Analytics",
      "RPA & Intelligent Automation",
      "Service Desk / Help Desk",
      "NOC / SOC Operations",
      "Digital Transformation Consulting",
      "SAP / ERP Services",
      "FinOps",
    ],
    industryExpertise: [
      "Banking & Financial Services",
      "Insurance",
      "Healthcare",
      "Government",
      "Technology",
      "Retail",
      "Manufacturing",
      "Telecom",
      "Energy & Utilities",
      "Education",
    ],
    certifications: [
      "ISO 27001",
      "ISO 9001",
      "ISO 20000",
      "SOC 2 Type II",
      "CMMI Level 3",
      "PCI DSS",
      "HIPAA Compliant",
      "HITRUST",
      "FedRAMP Ready",
      "GDPR",
    ],
    technologyPartnerships: [
      "AWS Advanced Partner",
      "AWS Premier Partner",
      "Microsoft Solutions Partner",
      "Azure Expert MSP",
      "Google Cloud Partner",
      "ServiceNow",
      "Salesforce",
      "UiPath",
      "Automation Anywhere",
      "Genesys",
      "NICE",
      "Snowflake",
      "Datadog",
    ],
  };

  function defaultProfile() {
    return JSON.parse(JSON.stringify(DEFAULT_COMPANY_SEED));
  }

  function normalizeProfile(raw) {
    const base = defaultProfile();
    const p = raw && typeof raw === "object" ? raw : {};
    return {
      apiId: p.apiId != null ? p.apiId : null,
      name: p.name != null ? String(p.name) : base.name,
      countriesServed: Array.isArray(p.countriesServed) ? p.countriesServed.map(String) : base.countriesServed,
      servicesOffered: Array.isArray(p.servicesOffered) ? p.servicesOffered.map(String) : base.servicesOffered,
      industryExpertise: Array.isArray(p.industryExpertise) ? p.industryExpertise.map(String) : base.industryExpertise,
      certifications: Array.isArray(p.certifications) ? p.certifications.map(String) : base.certifications,
      employees: p.employees != null ? String(p.employees) : base.employees,
      annualRevenue: p.annualRevenue != null ? String(p.annualRevenue) : base.annualRevenue,
      technologyPartnerships: Array.isArray(p.technologyPartnerships)
        ? p.technologyPartnerships.map(String)
        : base.technologyPartnerships,
      website: p.website != null ? String(p.website) : base.website || "",
      description: p.description != null ? String(p.description) : base.description || "",
      caseStudies: Array.isArray(p.caseStudies)
        ? p.caseStudies.map((cs) => ({
            client: cs.client || "",
            domain: cs.domain || "",
            value: cs.value || "",
            year: cs.year != null ? String(cs.year) : "",
            summary: cs.summary || "",
          }))
        : base.caseStudies,
      lastSaved: p.lastSaved || null,
    };
  }

  function loadProfile() {
    try {
      const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (raw) return normalizeProfile(JSON.parse(raw));
    } catch (_) {
      /* ignore corrupt storage */
    }
    return defaultProfile();
  }

  /** Local cache only — prefer Api.saveCompany for durable storage. */
  function cacheProfileLocally(profile) {
    const normalized = normalizeProfile(profile);
    try {
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(normalized));
    } catch (_) {
      /* ignore quota */
    }
    state.profile = normalized;
    APP_DATA.company = normalized;
    state.profileDirty = false;
    applyProfileMatchScores();
    return normalized;
  }

  async function persistProfile(profile) {
    const normalized = normalizeProfile(profile);
    if (typeof Api === "undefined") {
      normalized.lastSaved = new Date().toISOString();
      return cacheProfileLocally(normalized);
    }
    Api.showSpinner(true, "Saving company profile…");
    try {
      const saved = await Api.saveCompany(normalized);
      const merged = normalizeProfile(
        Object.assign({}, normalized, saved || {}, {
          apiId: (saved && saved.apiId) || normalized.apiId,
          lastSaved: (saved && saved.lastSaved) || new Date().toISOString(),
          caseStudies: normalized.caseStudies,
        })
      );
      return cacheProfileLocally(merged);
    } finally {
      Api.showSpinner(false);
    }
  }

  function getProfile() {
    if (!state.profile) state.profile = loadProfile();
    return state.profile;
  }

  function profileCompleteness(p) {
    const checks = [
      !!p.name?.trim(),
      (p.countriesServed || []).length > 0,
      (p.servicesOffered || []).length > 0,
      (p.industryExpertise || []).length > 0,
      (p.certifications || []).length > 0,
      !!String(p.employees || "").trim(),
      !!String(p.annualRevenue || "").trim(),
      (p.technologyPartnerships || []).length > 0,
      (p.caseStudies || []).some((cs) => cs.client?.trim()),
    ];
    const done = checks.filter(Boolean).length;
    return Math.round((done / checks.length) * 100);
  }

  function tokenize(text) {
    return String(text || "")
      .toLowerCase()
      .replace(/[^a-z0-9+./\s-]/g, " ")
      .split(/[\s,/|]+/)
      .filter((t) => t.length > 2);
  }

  function listOverlapScore(list, haystack, weight) {
    if (!list?.length || !haystack) return 0;
    const h = haystack.toLowerCase();
    let hits = 0;
    for (const item of list) {
      const tokens = tokenize(item);
      const full = item.toLowerCase();
      if (h.includes(full) || tokens.some((t) => t.length > 3 && h.includes(t))) hits += 1;
    }
    if (!hits) return 0;
    return Math.min(weight, Math.round((hits / Math.max(list.length, 1)) * weight * 1.8));
  }

  function computeMatchScore(rfp, profile) {
    const p = profile || getProfile();
    const rfpText = [
      rfp.title,
      rfp.type,
      rfp.industry,
      rfp.summary,
      rfp.location,
      ...(rfp.requirements || []),
    ]
      .join(" ")
      .toLowerCase();

    let score = 28;
    const breakdown = [];

    // Services vs type/title
    const serviceScore = listOverlapScore(p.servicesOffered, rfpText, 22);
    score += serviceScore;
    if (serviceScore) breakdown.push({ label: "Services fit", points: serviceScore });

    // Industry expertise
    const indScore = listOverlapScore(p.industryExpertise, rfp.industry + " " + rfpText, 16);
    score += indScore;
    if (indScore) breakdown.push({ label: "Industry expertise", points: indScore });

    // Certifications vs requirements
    const certScore = listOverlapScore(p.certifications, rfpText, 14);
    score += certScore;
    if (certScore) breakdown.push({ label: "Certifications", points: certScore });

    // Technology partnerships
    const partnerScore = listOverlapScore(p.technologyPartnerships, rfpText, 14);
    score += partnerScore;
    if (partnerScore) breakdown.push({ label: "Tech partnerships", points: partnerScore });

    // Countries / geography
    const geoScore = listOverlapScore(p.countriesServed, rfp.location + " " + rfpText, 10);
    score += geoScore;
    if (geoScore) breakdown.push({ label: "Geography coverage", points: geoScore });

    // Case studies / past domain experience
    const caseBlob = (p.caseStudies || [])
      .map((cs) => `${cs.client} ${cs.domain} ${cs.summary}`)
      .join(" ");
    const caseScore = listOverlapScore(
      (p.caseStudies || []).map((cs) => cs.domain).filter(Boolean),
      rfpText + " " + caseBlob,
      10
    );
    // Boost if case study domain tokens appear in RFP
    let caseBoost = 0;
    for (const cs of p.caseStudies || []) {
      const domainTokens = tokenize(cs.domain + " " + cs.summary);
      if (domainTokens.some((t) => rfpText.includes(t))) caseBoost += 2;
    }
    const caseTotal = Math.min(12, caseScore + caseBoost);
    score += caseTotal;
    if (caseTotal) breakdown.push({ label: "Case study relevance", points: caseTotal });

    // Scale / capacity soft signal from employees
    const emp = parseInt(String(p.employees || "").replace(/,/g, ""), 10);
    if (!Number.isNaN(emp) && emp >= 500) {
      score += 3;
      breakdown.push({ label: "Delivery scale", points: 3 });
    }

    score = Math.max(20, Math.min(99, Math.round(score)));
    return { score, breakdown };
  }

  function applyProfileMatchScores() {
    const profile = getProfile();
    for (const rfp of APP_DATA.rfps) {
      const result = computeMatchScore(rfp, profile);
      rfp.matchScore = result.score;
      rfp.matchBreakdown = result.breakdown;
      rfp.qualifiedAgainstProfile = profile.name || "Your company";
    }
    // Refresh high-match stat
    APP_DATA.stats.highMatch = APP_DATA.rfps.filter((r) => r.matchScore >= 85).length;
  }

  // ---------- Helpers ----------
  function daysUntil(dateStr) {
    const d = Math.ceil((new Date(dateStr) - new Date()) / 86400000);
    return d;
  }

  function formatDate(dateStr) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function scoreClass(score) {
    if (score >= 85) return "high";
    if (score >= 70) return "med";
    return "low";
  }

  function statusBadge(status) {
    const map = {
      New: "badge-sky",
      Qualifying: "badge-blue",
      Proposal: "badge-amber",
      "No-Go": "badge-gray",
      Submitted: "badge-green",
      Won: "badge-green",
      Lost: "badge-red",
    };
    return `<span class="badge ${map[status] || "badge-gray"}">${status}</span>`;
  }

  function riskBadge(level) {
    const map = { Low: "badge-green", Medium: "badge-amber", High: "badge-red" };
    return `<span class="badge ${map[level] || "badge-gray"}">${level}</span>`;
  }

  function responseClass(r) {
    if (r === "Comply") return "comp-yes";
    if (r === "Partial" || r === "In Progress") return "comp-partial";
    if (r === "Exception") return "comp-no";
    if (r === "Not Started") return "comp-todo";
    return "comp-na";
  }

  function normalizeComplianceRow(row, idx) {
    return {
      id: row.id != null ? row.id : idx + 1,
      requirement: row.requirement || "",
      pageNumber: row.pageNumber != null ? String(row.pageNumber) : "",
      responseStatus: row.responseStatus || row.response || "Not Started",
      assignedOwner: row.assignedOwner || row.owner || "Unassigned",
      dueDate: row.dueDate || "",
      comments: row.comments != null ? row.comments : row.notes || "",
    };
  }

  function defaultComplianceRows() {
    return (APP_DATA.complianceMatrix || []).map((row, i) => normalizeComplianceRow(row, i));
  }

  function loadComplianceRows() {
    try {
      const raw = localStorage.getItem(COMPLIANCE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.rows) && parsed.rows.length) {
          state.compliance.rows = parsed.rows.map((r, i) => normalizeComplianceRow(r, i));
          state.compliance.uploadedFile = parsed.uploadedFile || null;
          return state.compliance.rows;
        }
      }
    } catch (_) {
      /* ignore */
    }
    state.compliance.rows = defaultComplianceRows();
    return state.compliance.rows;
  }

  function getComplianceRows() {
    if (!state.compliance.rows) loadComplianceRows();
    return state.compliance.rows;
  }

  function persistComplianceRows() {
    const payload = {
      rows: getComplianceRows(),
      uploadedFile: state.compliance.uploadedFile,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(COMPLIANCE_STORAGE_KEY, JSON.stringify(payload));
  }

  function nextComplianceId() {
    const rows = getComplianceRows();
    return rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
  }

  function buildRowsFromRequirements(requirements, opts = {}) {
    const owners = COMPLIANCE_OWNERS().filter((o) => o !== "Unassigned");
    const rfp = getRfp(state.selectedRfpId);
    const baseDue = rfp?.deadline || addDaysIso(new Date().toISOString().slice(0, 10), 14);
    return (requirements || []).map((req, i) => {
      const text = typeof req === "string" ? req : req.requirement || "";
      const page =
        typeof req === "object" && req.pageNumber
          ? String(req.pageNumber)
          : String((opts.pageStart || 10) + Math.floor(i * 1.4));
      return normalizeComplianceRow(
        {
          id: i + 1,
          requirement: text,
          pageNumber: page,
          responseStatus: "Not Started",
          assignedOwner: owners[i % owners.length] || "Unassigned",
          dueDate: addDaysIso(baseDue, -Math.max(3, 12 - i)),
          comments: opts.source ? `Extracted from ${opts.source}` : "",
        },
        i
      );
    });
  }

  function extractRequirementsFromText(text, fileName) {
    const lines = String(text || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const reqs = [];
    for (const line of lines) {
      // Numbered / bulleted requirement-like lines
      const m = line.match(/^(?:req(?:uirement)?\s*)?(?:\d+[\.\):]\s*|[\-\*•]\s+)(.+)$/i);
      if (m && m[1].length > 12) {
        reqs.push(m[1].trim());
        continue;
      }
      if (
        /must|shall|required|mandatory|provide|demonstrate|certif|compliant|minimum|experience/i.test(line) &&
        line.length > 20 &&
        line.length < 280
      ) {
        reqs.push(line.replace(/^\d+[\.\)]\s*/, ""));
      }
    }

    // Deduplicate
    const seen = new Set();
    const unique = [];
    for (const r of reqs) {
      const key = r.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(r);
      }
    }

    if (unique.length >= 3) {
      return buildRowsFromRequirements(unique.slice(0, 40), { source: fileName, pageStart: 8 });
    }

    // Fallback: use selected RFP requirements
    const rfp = getRfp(state.selectedRfpId);
    const fallback = rfp.requirements || defaultComplianceRows().map((x) => x.requirement);
    return buildRowsFromRequirements(fallback, { source: fileName || "RFP", pageStart: 10 });
  }

  function escapeXml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function exportComplianceToExcel() {
    const rows = getComplianceRows();
    const rfp = getRfp(state.selectedRfpId);
    const headers = [
      "Requirement",
      "Page Number",
      "Response Status",
      "Assigned Owner",
      "Due Date",
      "Comments",
    ];

    const cell = (val, style) =>
      `<Cell${style ? ` ss:StyleID="${style}"` : ""}><Data ss:Type="String">${escapeXml(val)}</Data></Cell>`;

    const headerRow = `<Row>${headers.map((h) => cell(h, "Header")).join("")}</Row>`;
    const dataRows = rows
      .map(
        (r) =>
          `<Row>${[
            r.requirement,
            r.pageNumber,
            r.responseStatus,
            r.assignedOwner,
            r.dueDate,
            r.comments,
          ]
            .map((v) => cell(v))
            .join("")}</Row>`
      )
      .join("");

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>Compliance Matrix — ${escapeXml(rfp.title)}</Title>
  <Author>AI RFP Scout</Author>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1E5A9E" ss:Pattern="Solid"/>
   <Alignment ss:Vertical="Center" ss:WrapText="1"/>
  </Style>
  <Style ss:ID="Default">
   <Alignment ss:Vertical="Top" ss:WrapText="1"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Compliance Matrix">
  <Table>
   <Column ss:Width="320"/>
   <Column ss:Width="80"/>
   <Column ss:Width="110"/>
   <Column ss:Width="130"/>
   <Column ss:Width="90"/>
   <Column ss:Width="220"/>
   ${headerRow}
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeName = (rfp.id || "matrix").replace(/[^\w\-]+/g, "_");
    a.href = url;
    a.download = `Compliance_Matrix_${safeName}.xls`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} requirements to Excel`);
  }

  function icon(name) {
    const icons = {
      dashboard: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
      search: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>`,
      opportunity: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>`,
      company: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><path d="M9 9v.01"/><path d="M9 12v.01"/><path d="M9 15v.01"/><path d="M9 18v.01"/></svg>`,
      proposal: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
      compliance: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
      "bid-advisor": `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M5 21h14"/><path d="M5 7h14"/><path d="M6 7l-3 6h6l-3-6z"/><path d="M18 7l-3 6h6l-3-6z"/></svg>`,
      "win-themes": `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 9a4 4 0 0 0 4-4V4h-4"/><path d="M7 9a4 4 0 0 1-4-4V4h4"/></svg>`,
      clarifications: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
      "proposal-draft": `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h6"/></svg>`,
      settings: `<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>`,
      bell: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
      menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>`,
      trendUp: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m18 15-6-6-6 6"/></svg>`,
      spark: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/></svg>`,
    };
    return icons[name] || "";
  }

  function toast(msg) {
    const container = $("#toast-container");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = msg;
    container.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  function emptyRfpPlaceholder() {
    return {
      id: "",
      title: "No RFP selected",
      buyer: "—",
      industry: "—",
      type: "—",
      value: "—",
      valueMid: 0,
      deadline: new Date().toISOString().slice(0, 10),
      posted: new Date().toISOString().slice(0, 10),
      status: "New",
      matchScore: 0,
      source: "—",
      location: "—",
      country: "—",
      naics: "—",
      setAside: "None",
      summary: "Add RFPs via RFP Search or import to get started.",
      requirements: [],
      contacts: [],
      risks: [],
      aiInsights: [],
      matchBreakdown: [],
    };
  }

  function getRfp(id) {
    if (!APP_DATA.rfps || !APP_DATA.rfps.length) return emptyRfpPlaceholder();
    return APP_DATA.rfps.find((r) => r.id === id) || APP_DATA.rfps[0] || emptyRfpPlaceholder();
  }

  // ---------- Navigation ----------
  const PAGES = [
    { id: "dashboard", label: "Dashboard", section: "Overview" },
    { id: "search", label: "RFP Search", section: "Overview", badge: () => APP_DATA.rfps.filter((r) => r.status === "New").length || null },
    { id: "opportunity", label: "Opportunity Details", section: "Pipeline" },
    { id: "bid-advisor", label: "Bid / No-Bid Advisor", section: "Pipeline" },
    { id: "win-themes", label: "Win Theme Generator", section: "Pipeline" },
    { id: "clarifications", label: "Clarification Questions", section: "Pipeline" },
    { id: "proposal-draft", label: "Proposal Draft Generator", section: "Pipeline" },
    { id: "proposal", label: "Proposal Workspace", section: "Pipeline" },
    { id: "compliance", label: "Compliance Matrix", section: "Pipeline" },
    { id: "company", label: "Company Profile", section: "Organization" },
    { id: "settings", label: "Settings", section: "Organization" },
  ];

  const PAGE_META = {
    dashboard: { title: "Dashboard", subtitle: "KPIs, deadlines, and pipeline analytics" },
    search: { title: "RFP Search", subtitle: "Discover and filter opportunities" },
    opportunity: { title: "Opportunity Details", subtitle: "Go/No-Go worksheet, requirements, and bid decision" },
    "bid-advisor": {
      title: "AI Bid / No-Bid Advisor",
      subtitle: "Scorecards, risks, and recommendation for pursuit decisions",
    },
    "win-themes": {
      title: "AI Win Theme Generator",
      subtitle: "Strategic themes, value props, and executive messaging",
    },
    clarifications: {
      title: "AI Clarification Questions",
      subtitle: "Gaps, grouped questions, approve/edit/reject, and email export",
    },
    "proposal-draft": {
      title: "AI Proposal Draft Generator",
      subtitle: "Multi-section drafts, templates, edit, Word & PDF export",
    },
    company: { title: "Company Profile", subtitle: "Enter capabilities used to qualify RFPs" },
    proposal: { title: "Proposal Workspace", subtitle: "Rich-text sections and document export" },
    compliance: { title: "Compliance Matrix", subtitle: "Upload RFP, track responses, export to Excel" },
    settings: { title: "Settings", subtitle: "Notifications, search, and team" },
  };

  function navigate(page, rfpId) {
    state.page = page;
    if (rfpId) state.selectedRfpId = rfpId;
    location.hash = page === "opportunity" && rfpId ? `${page}/${rfpId}` : page;
    closeSidebar();
    render();
  }

  function parseHash() {
    const hash = (location.hash || "#dashboard").slice(1);
    const [page, id] = hash.split("/");
    if (PAGES.some((p) => p.id === page)) {
      state.page = page;
      if (id) state.selectedRfpId = id;
    }
  }

  // ---------- Sidebar ----------
  function renderSidebar() {
    const nav = $("#sidebar-nav");
    let html = "";
    let lastSection = "";
    for (const p of PAGES) {
      if (p.section !== lastSection) {
        html += `<div class="nav-section-label">${p.section}</div>`;
        lastSection = p.section;
      }
      const badge = p.badge ? p.badge() : null;
      const iconKey = {
        dashboard: "dashboard",
        search: "search",
        opportunity: "opportunity",
        "bid-advisor": "bid-advisor",
        "win-themes": "win-themes",
        clarifications: "clarifications",
        "proposal-draft": "proposal-draft",
        company: "company",
        proposal: "proposal",
        compliance: "compliance",
        settings: "settings",
      }[p.id];
      html += `
        <button class="nav-item ${state.page === p.id ? "active" : ""}" data-page="${p.id}">
          ${icon(iconKey)}
          <span>${p.label}</span>
          ${badge ? `<span class="badge">${badge}</span>` : ""}
        </button>`;
    }
    nav.innerHTML = html;
    $$(".nav-item", nav).forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.page));
    });
  }

  function closeSidebar() {
    $("#sidebar").classList.remove("open");
    $("#sidebar-overlay").classList.remove("open");
  }

  // ---------- Pages ----------
  function groupCount(items, keyFn) {
    const map = {};
    for (const item of items) {
      const k = keyFn(item) || "Unknown";
      map[k] = (map[k] || 0) + 1;
    }
    return Object.entries(map)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }

  function renderHBarChart(rows, opts = {}) {
    const max = Math.max(...rows.map((r) => r.value), 1);
    const color = opts.color || "primary";
    if (!rows.length) {
      return `<div class="empty-state" style="padding:24px">No data</div>`;
    }
    return `
      <div class="bar-chart dash-bar-chart">
        ${rows
          .map((b) => {
            const pct = Math.max(8, Math.round((b.value / max) * 100));
            return `
            <div class="bar-row">
              <div class="bar-label" title="${escapeAttr(b.label)}">${escapeHtml(b.label)}</div>
              <div class="bar-track">
                <div class="bar-value bar-${color}" style="width:${pct}%">${b.value}</div>
              </div>
            </div>`;
          })
          .join("")}
      </div>`;
  }

  function renderDonutChart(segments, centerLabel, centerValue) {
    const total = segments.reduce((s, x) => s + x.value, 0) || 1;
    const size = 160;
    const stroke = 22;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const colors = {
      New: "#0ea5e9",
      Qualifying: "#2563eb",
      Proposal: "#d97706",
      "No-Go": "#94a3b8",
      Submitted: "#059669",
      Won: "#059669",
      Lost: "#dc2626",
    };
    const palette = ["#2563eb", "#0ea5e9", "#d97706", "#059669", "#8b5cf6", "#94a3b8", "#dc2626"];

    const arcs = segments
      .map((seg, i) => {
        const len = (seg.value / total) * c;
        const dash = `${len} ${c - len}`;
        const el = `
          <circle class="donut-seg" cx="${size / 2}" cy="${size / 2}" r="${r}"
            fill="none" stroke="${seg.color || colors[seg.label] || palette[i % palette.length]}"
            stroke-width="${stroke}" stroke-dasharray="${dash}"
            stroke-dashoffset="${-offset}" stroke-linecap="butt" />`;
        offset += len;
        return el;
      })
      .join("");

    return `
      <div class="donut-wrap">
        <div class="donut-chart" style="width:${size}px;height:${size}px">
          <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
            <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--gray-200)" stroke-width="${stroke}" />
            <g transform="rotate(-90 ${size / 2} ${size / 2})">${arcs}</g>
          </svg>
          <div class="donut-center">
            <div class="donut-value">${escapeHtml(String(centerValue))}</div>
            <div class="donut-label">${escapeHtml(centerLabel)}</div>
          </div>
        </div>
        <div class="donut-legend">
          ${segments
            .map((seg, i) => {
              const col = seg.color || colors[seg.label] || palette[i % palette.length];
              const pct = Math.round((seg.value / total) * 100);
              return `
              <div class="legend-row">
                <span class="legend-swatch" style="background:${col}"></span>
                <span class="legend-name">${escapeHtml(seg.label)}</span>
                <span class="legend-val">${seg.value} <span class="text-muted">(${pct}%)</span></span>
              </div>`;
            })
            .join("")}
        </div>
      </div>`;
  }

  function renderSparkGauge(score) {
    const s = Math.max(0, Math.min(100, Math.round(score)));
    const cls = scoreClass(s);
    const size = 88;
    const stroke = 8;
    const radius = (size - stroke) / 2;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (s / 100) * circ;
    const center = size / 2;
    return `
      <div class="kpi-gauge ${cls}">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
          <circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="var(--gray-200)" stroke-width="${stroke}" />
          <circle cx="${center}" cy="${center}" r="${radius}" fill="none"
            stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
            transform="rotate(-90 ${center} ${center})" />
        </svg>
        <div class="kpi-gauge-label">
          <div class="kpi-gauge-num">${s}</div>
          <div class="kpi-gauge-unit">/ 100</div>
        </div>
      </div>`;
  }

  /** Normalize API chart points to { label, value }[] used by chart renderers. */
  function chartPointsToRows(points) {
    return (points || [])
      .filter((p) => p && p.label != null)
      .map((p) => ({ label: String(p.label), value: Number(p.value) || 0 }))
      .sort((a, b) => b.value - a.value);
  }

  function renderDashboard() {
    const rfps = APP_DATA.rfps || [];
    const activeRfps = rfps.filter((r) => r.status !== "No-Go" && r.status !== "Lost");
    const apiDash = state.dashboardApi;
    // Prefer live API metrics; ignore legacy "sample" payloads so zeros stay zeros
    const useApi =
      apiDash &&
      apiDash.data_source === "live" &&
      (apiDash.kpis || apiDash.charts);
    const kpis = useApi && apiDash.kpis ? apiDash.kpis : null;
    const charts = useApi && apiDash.charts ? apiDash.charts : null;
    const fromApi = !!useApi;

    // Local (loaded RFP list) is the source of truth when API is sample/missing
    const totalActive = kpis
      ? Number(kpis.open_opportunities) || 0
      : activeRfps.length;
    const highMatch = activeRfps.filter((r) => (r.matchScore || 0) >= 85);
    const highMatchCount = charts
      ? Number(charts.high_match_count) || 0
      : highMatch.length;
    const upcomingDeadlines = [...activeRfps]
      .filter((r) => {
        const d = daysUntil(r.deadline);
        return d >= 0 && d <= 30;
      })
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
    const upcomingCount = kpis
      ? Number(kpis.upcoming_deadlines) || 0
      : upcomingDeadlines.length;
    const dueThisWeek = upcomingDeadlines.filter((r) => daysUntil(r.deadline) <= 7);
    const proposalStatuses =
      charts && charts.by_status && charts.by_status.length
        ? chartPointsToRows(charts.by_status)
        : groupCount(rfps, (r) => r.status);
    const inProposal =
      charts && charts.by_status
        ? proposalStatuses
            .filter((s) => s.label === "Proposal" || s.label === "Submitted")
            .reduce((sum, s) => sum + s.value, 0)
        : rfps.filter((r) => r.status === "Proposal" || r.status === "Submitted").length;
    const avgScore = kpis
      ? Math.round(Number(kpis.average_match_score) || 0)
      : rfps.length
        ? Math.round(rfps.reduce((s, r) => s + (Number(r.matchScore) || 0), 0) / rfps.length)
        : 0;
    const byCountry =
      charts && charts.by_country && charts.by_country.length
        ? chartPointsToRows(charts.by_country)
        : groupCount(activeRfps.length ? activeRfps : rfps, (r) => rfpCountry(r));
    const byIndustry =
      charts && charts.by_industry && charts.by_industry.length
        ? chartPointsToRows(charts.by_industry)
        : groupCount(activeRfps.length ? activeRfps : rfps, (r) => r.industry);
    const topMatches = [...activeRfps].sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
    let pipelineLabel = "—";
    if (charts && charts.pipeline_value_usd_millions != null) {
      const pv = Number(charts.pipeline_value_usd_millions) || 0;
      pipelineLabel = pv > 0 ? `$${pv.toFixed(1)}M` : "—";
    } else {
      const pipelineValue = rfps
        .filter((r) => r.status !== "No-Go" && r.status !== "Lost")
        .reduce((s, r) => s + (Number(r.valueMid) || 0), 0);
      pipelineLabel = pipelineValue >= 1 ? `$${pipelineValue.toFixed(1)}M` : "—";
    }
    const totalInSystem = kpis ? Number(kpis.total_rfps) || 0 : rfps.length;
    const dataSourceNote = fromApi
      ? "Live metrics from your RFP pipeline"
      : rfps.length
        ? "Computed from loaded RFPs"
        : "No RFPs yet — metrics are zero until you add opportunities";

    // Sync high-level stats for any other consumers
    APP_DATA.stats.activeRfps = totalActive;
    APP_DATA.stats.highMatch = highMatchCount;
    APP_DATA.stats.proposalsInProgress = inProposal;
    APP_DATA.stats.dueThisWeek = dueThisWeek.length;
    APP_DATA.stats.pipelineValue = pipelineLabel;

    return `
      <div class="dash-intro mb-20">
        <div class="alert alert-info" style="margin-bottom:0">
          ${icon("spark")}
          <div>
            <strong>Live pipeline intelligence</strong> —
            ${escapeHtml(dataSourceNote)}.
            <button type="button" class="btn btn-sm btn-secondary" data-nav="search" style="margin-left:8px">Browse RFPs</button>
            <button type="button" class="btn btn-sm btn-ghost" id="btn-refresh-dashboard" style="margin-left:4px">Refresh</button>
          </div>
        </div>
      </div>

      <div class="stat-grid dash-kpi-grid">
        <div class="stat-card">
          <div class="stat-icon">${icon("opportunity")}</div>
          <div class="stat-label">Total Active RFPs</div>
          <div class="stat-value">${totalActive}</div>
          <div class="stat-change neutral">${totalInSystem} total in system · excl. No-Go</div>
        </div>
        <div class="stat-card success">
          <div class="stat-icon">${icon("spark")}</div>
          <div class="stat-label">High Match Opportunities</div>
          <div class="stat-value">${highMatchCount}</div>
          <div class="stat-change up">Match score ≥ 85 / 100</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-icon">${icon("proposal")}</div>
          <div class="stat-label">Upcoming Submission Deadlines</div>
          <div class="stat-value">${upcomingCount}</div>
          <div class="stat-change ${dueThisWeek.length ? "down" : "neutral"}">${dueThisWeek.length} within 7 days · 30-day window</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-icon">${icon("compliance")}</div>
          <div class="stat-label">Proposal Status</div>
          <div class="stat-value">${inProposal}</div>
          <div class="stat-change neutral">In Proposal / Submitted · pipeline ${pipelineLabel}</div>
        </div>
        <div class="stat-card dash-kpi-score ${scoreClass(avgScore) === "high" ? "success" : scoreClass(avgScore) === "med" ? "warning" : ""}">
          <div class="stat-label">Average Match Score</div>
          <div class="dash-avg-score">
            ${renderSparkGauge(avgScore)}
            <div>
              <div class="stat-value" style="font-size:1.5rem">${avgScore}<span class="text-sm text-muted"> / 100</span></div>
              <div class="stat-change ${scoreClass(avgScore) === "high" ? "up" : "neutral"}">
                ${scoreClass(avgScore) === "high" ? "Strong overall fit" : scoreClass(avgScore) === "med" ? "Moderate overall fit" : "Review company profile"}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="dash-charts-grid">
        <div class="card">
          <div class="card-header">
            <h3>Proposal Status</h3>
            <span class="badge badge-blue">${rfps.length} RFPs</span>
          </div>
          <div class="card-body">
            ${renderDonutChart(proposalStatuses, "Total", rfps.length)}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Opportunities by Country</h3>
            <span class="badge badge-sky">${byCountry.length} markets</span>
          </div>
          <div class="card-body">
            ${renderHBarChart(byCountry, { color: "primary" })}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>Opportunities by Industry</h3>
            <span class="badge badge-blue">${byIndustry.length} verticals</span>
          </div>
          <div class="card-body">
            ${renderHBarChart(byIndustry, { color: "accent" })}
          </div>
        </div>
      </div>

      <div class="grid-2-1 mt-20">
        <div class="card">
          <div class="card-header">
            <h3>Upcoming Submission Deadlines</h3>
            <span class="badge badge-amber">${upcomingDeadlines.length} in 30 days</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>RFP Title</th>
                  <th>Organization</th>
                  <th>Closing Date</th>
                  <th>Match</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${
                  upcomingDeadlines.length
                    ? upcomingDeadlines
                        .slice(0, 8)
                        .map((r) => {
                          const d = daysUntil(r.deadline);
                          return `
                    <tr class="clickable" data-open-rfp="${r.id}">
                      <td>
                        <div class="fw-600">${escapeHtml(r.title)}</div>
                        <div class="text-xs text-muted">${escapeHtml(r.id)}</div>
                      </td>
                      <td>${escapeHtml(r.buyer)}</td>
                      <td>
                        ${formatDate(r.deadline)}
                        <div class="text-xs ${d <= 7 ? "fw-600 deadline-urgent" : "text-muted"}">${d} days left</div>
                      </td>
                      <td><span class="score-pill score-${scoreClass(r.matchScore)}"><span class="score-dot"></span>${r.matchScore}</span></td>
                      <td>${statusBadge(r.status)}</td>
                      <td><button class="btn btn-sm btn-primary" data-open-rfp="${r.id}">Open</button></td>
                    </tr>`;
                        })
                        .join("")
                    : `<tr><td colspan="6"><div class="empty-state">No submissions due in the next 30 days.</div></td></tr>`
                }
              </tbody>
            </table>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3>High Match Opportunities</h3>
            <button class="btn btn-sm btn-secondary" data-nav="search">View all</button>
          </div>
          <div class="card-body">
            ${
              highMatch.length
                ? highMatch
                    .sort((a, b) => b.matchScore - a.matchScore)
                    .slice(0, 6)
                    .map(
                      (r) => `
                <div class="dash-match-row" data-open-rfp="${r.id}">
                  <div class="dash-match-main">
                    <div class="text-sm fw-600">${escapeHtml(r.title)}</div>
                    <div class="text-xs text-muted">${escapeHtml(r.buyer)} · ${escapeHtml(rfpCountry(r))}</div>
                  </div>
                  <div class="dash-match-score">
                    <span class="score-pill score-${scoreClass(r.matchScore)}"><span class="score-dot"></span>${r.matchScore}</span>
                    ${statusBadge(r.status)}
                  </div>
                </div>`
                    )
                    .join("")
                : `<div class="empty-state" style="padding:20px">No opportunities at ≥85 match. Update your company profile to improve scores.</div>`
            }
          </div>
        </div>
      </div>

      <div class="card mt-20">
        <div class="card-header">
          <h3>Top AI Matches (all active)</h3>
          <span class="badge badge-green">Avg ${avgScore}/100</span>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Opportunity</th>
                <th>Organization</th>
                <th>Country</th>
                <th>Industry</th>
                <th>Deadline</th>
                <th>Match Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${topMatches
                .map(
                  (r) => `
                <tr class="clickable" data-open-rfp="${r.id}">
                  <td>
                    <div class="fw-600">${escapeHtml(r.title)}</div>
                    <div class="text-xs text-muted">${escapeHtml(r.type)}</div>
                  </td>
                  <td>${escapeHtml(r.buyer)}</td>
                  <td>${escapeHtml(rfpCountry(r))}</td>
                  <td class="text-sm">${escapeHtml(r.industry)}</td>
                  <td>${formatDate(r.deadline)}</td>
                  <td>
                    <div class="match-meter">
                      <div class="mini-score-bar">
                        <div class="mini-score-fill score-fill-${scoreClass(r.matchScore)}" style="width:${r.matchScore}%"></div>
                      </div>
                      <span class="score-pill score-${scoreClass(r.matchScore)}"><span class="score-dot"></span>${r.matchScore}</span>
                    </div>
                  </td>
                  <td>${statusBadge(r.status)}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function rfpCountry(r) {
    return r.country || "United States";
  }

  /** Offline/local cache fallback (used after API load and for go/no-go drafts). */
  function loadSavedRfpsFromLocal() {
    try {
      const raw = localStorage.getItem(RFPS_STORAGE_KEY);
      if (!raw) return;
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        APP_DATA.rfps = list;
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function loadSavedRfps() {
    if (typeof Api === "undefined" || !Api.getToken()) {
      loadSavedRfpsFromLocal();
      return APP_DATA.rfps || [];
    }
    try {
      const result = await Api.listRfps({ page_size: 100 });
      const items = result.items || [];
      APP_DATA.rfps = items;
      persistRfps();
      return items;
    } catch (err) {
      console.error("Failed to load RFPs from API:", err);
      loadSavedRfpsFromLocal();
      throw err;
    }
  }

  function persistRfps() {
    try {
      localStorage.setItem(RFPS_STORAGE_KEY, JSON.stringify(APP_DATA.rfps || []));
    } catch (_) {
      /* ignore */
    }
  }

  function nextRfpId() {
    const year = new Date().getFullYear();
    const n = (APP_DATA.rfps || []).length + 1;
    let id = `RFP-${year}-${String(n).padStart(4, "0")}`;
    while ((APP_DATA.rfps || []).some((r) => r.id === id)) {
      id = `RFP-${year}-${String(Date.now()).slice(-6)}`;
    }
    return id;
  }

  function parseValueMid(valueText) {
    const nums = String(valueText || "").match(/[\d.]+/g);
    if (!nums || !nums.length) return 0;
    const vals = nums.map(Number).filter((n) => !Number.isNaN(n));
    if (!vals.length) return 0;
    if (vals.length === 1) return vals[0];
    return (vals[0] + vals[1]) / 2;
  }

  function createRfpFromForm(data) {
    const requirements = String(data.requirements || "")
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rfp = {
      id: data.id?.trim() || nextRfpId(),
      title: data.title.trim(),
      buyer: data.buyer.trim(),
      industry: data.industry.trim() || "Other",
      type: data.type.trim() || "Other",
      value: data.value.trim() || "TBD",
      valueMid: parseValueMid(data.value),
      deadline: data.deadline || addDaysIso(new Date().toISOString().slice(0, 10), 30),
      posted: data.posted || new Date().toISOString().slice(0, 10),
      status: data.status || "New",
      matchScore: 0,
      source: data.source?.trim() || "Manual entry",
      location: data.location?.trim() || "",
      country: data.country?.trim() || "",
      naics: data.naics?.trim() || "",
      setAside: data.setAside?.trim() || "None",
      summary: data.summary?.trim() || "",
      requirements,
      contacts: [],
      risks: [],
      aiInsights: ["Manually added RFP — match score calculated from company profile."],
    };

    if (data.contactName || data.contactEmail) {
      rfp.contacts.push({
        role: data.contactRole?.trim() || "Contact",
        name: data.contactName?.trim() || "—",
        email: data.contactEmail?.trim() || "",
      });
    }

    const scored = computeMatchScore(rfp, getProfile());
    rfp.matchScore = scored.score;
    rfp.matchBreakdown = scored.breakdown;
    return rfp;
  }

  function renderAddRfpForm() {
    if (!state.showAddRfpForm) return "";
    const today = new Date().toISOString().slice(0, 10);
    return `
      <div class="card mb-20 add-rfp-card" id="add-rfp-panel">
        <div class="card-header">
          <h3>Add RFP details</h3>
          <button type="button" class="btn btn-sm btn-ghost" id="btn-cancel-add-rfp">Close</button>
        </div>
        <div class="card-body">
          <p class="form-hint mb-16">Enter opportunity details here. They appear in Search, Dashboard, Opportunity Details, Proposal, and Compliance.</p>
          <div id="add-rfp-error" class="auth-error" hidden></div>
          <form id="add-rfp-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-title">RFP title <span class="required-mark">*</span></label>
                <input class="form-input" id="rfp-title" required placeholder="e.g. Managed Cloud Services RFP" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-buyer">Organization / buyer <span class="required-mark">*</span></label>
                <input class="form-input" id="rfp-buyer" required placeholder="e.g. Acme Corp" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-country">Country <span class="required-mark">*</span></label>
                <input class="form-input" id="rfp-country" required placeholder="e.g. United States" list="country-suggestions" />
                <datalist id="country-suggestions">
                  <option value="United States"><option value="United Kingdom"><option value="Canada">
                  <option value="India"><option value="Germany"><option value="Singapore">
                  <option value="Philippines"><option value="Mexico"><option value="UAE">
                </datalist>
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-location">City / location</label>
                <input class="form-input" id="rfp-location" placeholder="e.g. New York, NY" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-industry">Industry</label>
                <select class="form-select" id="rfp-industry">
                  ${INDUSTRY_OPTIONS.map((i) => `<option value="${escapeAttr(i)}">${escapeHtml(i)}</option>`).join("")}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-type">Service category</label>
                <select class="form-select" id="rfp-type">
                  ${SERVICE_CATEGORY_OPTIONS.map((s) => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-value">Estimated value</label>
                <input class="form-input" id="rfp-value" placeholder="e.g. $2M – $4M" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-deadline">Submission deadline <span class="required-mark">*</span></label>
                <input class="form-input" id="rfp-deadline" type="date" required value="${addDaysIso(today, 30)}" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-posted">Posted date</label>
                <input class="form-input" id="rfp-posted" type="date" value="${today}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-status">Status</label>
                <select class="form-select" id="rfp-status">
                  ${STATUS_OPTIONS.map((s) => `<option value="${escapeAttr(s)}" ${s === "New" ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-source">Source</label>
                <input class="form-input" id="rfp-source" placeholder="e.g. SAM.gov, client portal, referral" value="Manual entry" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-id">RFP ID (optional)</label>
                <input class="form-input" id="rfp-id" placeholder="Auto-generated if blank" />
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-naics">NAICS / category code</label>
                <input class="form-input" id="rfp-naics" placeholder="e.g. 541512" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-setaside">Set-aside</label>
                <input class="form-input" id="rfp-setaside" value="None" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="rfp-summary">Executive summary / description <span class="required-mark">*</span></label>
              <textarea class="form-textarea" id="rfp-summary" required rows="3" placeholder="What is the buyer asking for?"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label" for="rfp-requirements">Mandatory requirements (one per line)</label>
              <textarea class="form-textarea" id="rfp-requirements" rows="4" placeholder="ISO 27001&#10;24x7 support&#10;AWS partner status"></textarea>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label" for="rfp-contact-name">Contact name</label>
                <input class="form-input" id="rfp-contact-name" placeholder="Optional" />
              </div>
              <div class="form-group">
                <label class="form-label" for="rfp-contact-email">Contact email</label>
                <input class="form-input" id="rfp-contact-email" type="email" placeholder="optional@buyer.com" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="rfp-contact-role">Contact role</label>
              <input class="form-input" id="rfp-contact-role" placeholder="e.g. Contracting Officer" />
            </div>
            <div class="flex gap-8 flex-wrap mt-16">
              <button type="submit" class="btn btn-primary">Save RFP</button>
              <button type="button" class="btn btn-secondary" id="btn-cancel-add-rfp-2">Cancel</button>
            </div>
          </form>
        </div>
      </div>`;
  }

  function matchesValueRange(r, range) {
    if (!range) return true;
    const v = Number(r.valueMid) || 0;
    if (range === "under2") return v < 2;
    if (range === "2to5") return v >= 2 && v < 5;
    if (range === "5to10") return v >= 5 && v < 10;
    if (range === "over10") return v >= 10;
    return true;
  }

  function matchesDeadlineFilter(r, deadline) {
    if (!deadline) return true;
    const days = daysUntil(r.deadline);
    if (deadline === "overdue") return days < 0;
    const n = Number(deadline);
    if (!Number.isNaN(n)) return days >= 0 && days <= n;
    return true;
  }

  function matchesKeywords(r, keywords) {
    if (!keywords || !keywords.trim()) return true;
    const terms = keywords
      .toLowerCase()
      .split(/[\s,;]+/)
      .filter(Boolean);
    if (!terms.length) return true;
    const blob = [
      r.title,
      r.buyer,
      r.id,
      r.industry,
      r.type,
      r.country,
      r.location,
      r.summary,
      r.source,
      r.status,
      ...(r.requirements || []),
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => blob.includes(t));
  }

  function getFilteredSortedRfps() {
    const f = state.filters;
    const q = (state.searchQuery || "").toLowerCase().trim();

    let list = APP_DATA.rfps.filter((r) => {
      const matchSearch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.buyer.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.industry.toLowerCase().includes(q) ||
        rfpCountry(r).toLowerCase().includes(q) ||
        (r.summary || "").toLowerCase().includes(q);

      return (
        matchSearch &&
        (!f.country || rfpCountry(r) === f.country) &&
        (!f.industry || r.industry === f.industry) &&
        (!f.service || r.type === f.service) &&
        matchesValueRange(r, f.valueRange) &&
        matchesDeadlineFilter(r, f.deadline) &&
        matchesKeywords(r, f.keywords)
      );
    });

    const { key, dir } = state.searchSort;
    const mult = dir === "asc" ? 1 : -1;
    list = list.slice().sort((a, b) => {
      let av;
      let bv;
      switch (key) {
        case "title":
          av = a.title.toLowerCase();
          bv = b.title.toLowerCase();
          break;
        case "organization":
          av = a.buyer.toLowerCase();
          bv = b.buyer.toLowerCase();
          break;
        case "country":
          av = rfpCountry(a).toLowerCase();
          bv = rfpCountry(b).toLowerCase();
          break;
        case "deadline":
          av = a.deadline;
          bv = b.deadline;
          break;
        case "value":
          av = Number(a.valueMid) || 0;
          bv = Number(b.valueMid) || 0;
          break;
        case "status":
          av = a.status.toLowerCase();
          bv = b.status.toLowerCase();
          break;
        case "matchScore":
        default:
          av = Number(a.matchScore) || 0;
          bv = Number(b.matchScore) || 0;
          break;
      }
      if (av < bv) return -1 * mult;
      if (av > bv) return 1 * mult;
      return 0;
    });

    return list;
  }

  function sortHeader(label, key) {
    const active = state.searchSort.key === key;
    const arrow = !active ? "↕" : state.searchSort.dir === "asc" ? "↑" : "↓";
    return `
      <th class="sortable-th ${active ? "sorted" : ""}" data-sort-key="${key}" title="Sort by ${label}">
        <span class="th-sort-label">${label}</span>
        <span class="th-sort-icon">${arrow}</span>
      </th>`;
  }

  function renderPagination(total, page, pageSize) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    if (total === 0) {
      return `<div class="pagination-bar"><div class="text-sm text-muted">No results</div></div>`;
    }
    const start = (safePage - 1) * pageSize + 1;
    const end = Math.min(safePage * pageSize, total);

    let pagesHtml = "";
    const windowSize = 5;
    let from = Math.max(1, safePage - Math.floor(windowSize / 2));
    let to = Math.min(totalPages, from + windowSize - 1);
    from = Math.max(1, to - windowSize + 1);

    if (from > 1) {
      pagesHtml += `<button type="button" class="page-btn" data-page="1">1</button>`;
      if (from > 2) pagesHtml += `<span class="page-ellipsis">…</span>`;
    }
    for (let i = from; i <= to; i++) {
      pagesHtml += `<button type="button" class="page-btn ${i === safePage ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    if (to < totalPages) {
      if (to < totalPages - 1) pagesHtml += `<span class="page-ellipsis">…</span>`;
      pagesHtml += `<button type="button" class="page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }

    return `
      <div class="pagination-bar">
        <div class="text-sm text-muted">
          Showing <strong>${start}–${end}</strong> of <strong>${total}</strong>
        </div>
        <div class="pagination-controls">
          <button type="button" class="page-btn" data-page="${safePage - 1}" ${safePage <= 1 ? "disabled" : ""} aria-label="Previous page">‹ Prev</button>
          ${pagesHtml}
          <button type="button" class="page-btn" data-page="${safePage + 1}" ${safePage >= totalPages ? "disabled" : ""} aria-label="Next page">Next ›</button>
        </div>
        <div class="pagination-size">
          <label class="text-xs text-muted" for="page-size">Rows</label>
          <select id="page-size" class="form-select form-select-sm">
            ${[5, 10, 25].map((n) => `<option value="${n}" ${pageSize === n ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </div>
      </div>`;
  }

  function activeFilterCount() {
    const f = state.filters;
    let n = 0;
    if (f.country) n++;
    if (f.industry) n++;
    if (f.service) n++;
    if (f.valueRange) n++;
    if (f.deadline) n++;
    if (f.keywords?.trim()) n++;
    if (state.searchQuery?.trim()) n++;
    return n;
  }

  function renderSearch() {
    const countries = [...new Set(APP_DATA.rfps.map(rfpCountry))].sort();
    const industries = [...new Set(APP_DATA.rfps.map((r) => r.industry))].sort();
    const services = [...new Set(APP_DATA.rfps.map((r) => r.type))].sort();
    const f = state.filters;

    const list = getFilteredSortedRfps();
    const pageSize = state.searchPageSize || SEARCH_PAGE_SIZE;
    const totalPages = Math.max(1, Math.ceil(list.length / pageSize));
    if (state.searchPage > totalPages) state.searchPage = totalPages;
    if (state.searchPage < 1) state.searchPage = 1;
    const page = state.searchPage;
    const pageItems = list.slice((page - 1) * pageSize, page * pageSize);
    const activeFilters = activeFilterCount();

    return `
      <div class="alert alert-info">
        ${icon("spark")}
        <div>
          <strong>Add your RFPs here.</strong>
          Use <strong>Add RFP</strong> to enter opportunity details. Match scores use your saved company profile.
          After saving, open a row to see full Opportunity Details.
        </div>
      </div>

      <div class="flex-between mb-16 flex-wrap gap-8">
        <div>
          <button type="button" class="btn btn-primary" id="btn-show-add-rfp">+ Add RFP</button>
        </div>
        <div class="text-sm text-muted">${APP_DATA.rfps.length} RFP${APP_DATA.rfps.length === 1 ? "" : "s"} in your pipeline</div>
      </div>

      ${renderAddRfpForm()}

      ${
        !APP_DATA.rfps.length && !state.showAddRfpForm
          ? `<div class="card mb-20">
              <div class="empty-state">
                <p class="fw-600 mb-8">No RFPs yet</p>
                <p class="text-sm text-muted mb-16">This is where you add RFP details — title, buyer, country, deadline, requirements, and more.</p>
                <button type="button" class="btn btn-primary" id="btn-show-add-rfp-empty">+ Add your first RFP</button>
              </div>
            </div>`
          : ""
      }

      <div class="card mb-20 search-filters-card">
        <div class="card-header">
          <h3>Search &amp; Filters</h3>
          <div class="flex gap-8 flex-wrap">
            ${activeFilters ? `<span class="badge badge-blue">${activeFilters} active</span>` : ""}
            <button type="button" class="btn btn-sm btn-secondary" id="clear-filters">Clear all</button>
          </div>
        </div>
        <div class="card-body">
          <div class="search-filters-grid">
            <div class="form-group search-keywords-group">
              <label class="form-label" for="rfp-search-input">Search</label>
              <input class="form-input" id="rfp-search-input" type="search" placeholder="Search title, organization, ID..." value="${escapeAttr(state.searchQuery)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="filter-keywords">Keywords</label>
              <input class="form-input" id="filter-keywords" type="text" placeholder="e.g. cloud, SOC, ServiceNow" value="${escapeAttr(f.keywords || "")}" />
              <p class="form-hint">All terms must match (AND). Searches title, summary, and requirements.</p>
            </div>
            <div class="form-group">
              <label class="form-label" for="filter-country">Country</label>
              <select class="form-select" id="filter-country">
                <option value="">All countries</option>
                ${countries.map((c) => `<option value="${escapeAttr(c)}" ${f.country === c ? "selected" : ""}>${escapeHtml(c)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="filter-industry">Industry</label>
              <select class="form-select" id="filter-industry">
                <option value="">All industries</option>
                ${industries.map((i) => `<option value="${escapeAttr(i)}" ${f.industry === i ? "selected" : ""}>${escapeHtml(i)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="filter-service">Service category</label>
              <select class="form-select" id="filter-service">
                <option value="">All services</option>
                ${services.map((s) => `<option value="${escapeAttr(s)}" ${f.service === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="filter-value">Estimated value</label>
              <select class="form-select" id="filter-value">
                <option value="" ${!f.valueRange ? "selected" : ""}>Any value</option>
                <option value="under2" ${f.valueRange === "under2" ? "selected" : ""}>Under $2M</option>
                <option value="2to5" ${f.valueRange === "2to5" ? "selected" : ""}>$2M – $5M</option>
                <option value="5to10" ${f.valueRange === "5to10" ? "selected" : ""}>$5M – $10M</option>
                <option value="over10" ${f.valueRange === "over10" ? "selected" : ""}>Over $10M</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="filter-deadline">Submission deadline</label>
              <select class="form-select" id="filter-deadline">
                <option value="" ${!f.deadline ? "selected" : ""}>Any deadline</option>
                <option value="7" ${f.deadline === "7" ? "selected" : ""}>Next 7 days</option>
                <option value="14" ${f.deadline === "14" ? "selected" : ""}>Next 14 days</option>
                <option value="30" ${f.deadline === "30" ? "selected" : ""}>Next 30 days</option>
                <option value="60" ${f.deadline === "60" ? "selected" : ""}>Next 60 days</option>
                <option value="overdue" ${f.deadline === "overdue" ? "selected" : ""}>Overdue</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-between mb-16 flex-wrap gap-8">
        <div class="text-sm text-muted">
          <strong>${list.length}</strong> opportunit${list.length === 1 ? "y" : "ies"} found
          ${activeFilters ? ` · filtered` : ""}
          · sorted by <strong>${state.searchSort.key}</strong> (${state.searchSort.dir})
        </div>
        <div class="flex gap-8 flex-wrap">
          <button type="button" class="btn btn-sm btn-primary" id="btn-show-add-rfp-2">+ Add RFP</button>
          <button type="button" class="btn btn-sm btn-secondary" id="btn-export">Export CSV</button>
        </div>
      </div>

      <div class="card">
        <div class="table-wrap">
          <table class="rfp-search-table">
            <thead>
              <tr>
                ${sortHeader("RFP Title", "title")}
                ${sortHeader("Organization", "organization")}
                ${sortHeader("Country", "country")}
                ${sortHeader("Closing Date", "deadline")}
                ${sortHeader("Estimated Value", "value")}
                ${sortHeader("Match Score", "matchScore")}
                ${sortHeader("Status", "status")}
              </tr>
            </thead>
            <tbody>
              ${
                pageItems.length
                  ? pageItems
                      .map((r) => {
                        const days = daysUntil(r.deadline);
                        const urgent = days >= 0 && days <= 10;
                        return `
                <tr class="clickable" data-open-rfp="${r.id}">
                  <td>
                    <div class="fw-600">${escapeHtml(r.title)}</div>
                    <div class="text-xs text-muted">${escapeHtml(r.id)} · ${escapeHtml(r.type)}</div>
                  </td>
                  <td>
                    <div class="fw-600">${escapeHtml(r.buyer)}</div>
                    <div class="text-xs text-muted">${escapeHtml(r.industry)}</div>
                  </td>
                  <td>${escapeHtml(rfpCountry(r))}</td>
                  <td>
                    <div>${formatDate(r.deadline)}</div>
                    <div class="text-xs ${urgent ? "fw-600 deadline-urgent" : days < 0 ? "fw-600 deadline-overdue" : "text-muted"}">
                      ${days < 0 ? `${Math.abs(days)}d overdue` : `${days} days left`}
                    </div>
                  </td>
                  <td>${escapeHtml(r.value)}</td>
                  <td>
                    <span class="score-pill score-${scoreClass(r.matchScore)}">
                      <span class="score-dot"></span>${r.matchScore}%
                    </span>
                  </td>
                  <td>${statusBadge(r.status)}</td>
                </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="7"><div class="empty-state">No RFPs match your search and filters. Try clearing filters or broadening keywords.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
        ${renderPagination(list.length, page, pageSize)}
      </div>
    `;
  }

  // ---------- Opportunity detail enrichment ----------
  const CERT_PATTERNS = [
    { re: /iso\s*27001/i, label: "ISO 27001" },
    { re: /iso\s*9001/i, label: "ISO 9001" },
    { re: /iso\s*20000/i, label: "ISO 20000" },
    { re: /soc\s*2/i, label: "SOC 2 Type II" },
    { re: /pci\s*dss/i, label: "PCI DSS" },
    { re: /hipaa/i, label: "HIPAA" },
    { re: /hitrust/i, label: "HITRUST" },
    { re: /fedramp/i, label: "FedRAMP" },
    { re: /cmmi/i, label: "CMMI" },
    { re: /gdpr/i, label: "GDPR" },
    { re: /itil/i, label: "ITIL" },
    { re: /aws\s*(advanced|premier)/i, label: "AWS Partner" },
    { re: /azure\s*(expert|solutions)/i, label: "Microsoft Azure Partner" },
    { re: /finops/i, label: "FinOps Foundation" },
  ];

  function addDaysIso(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function extractCertifications(r) {
    if (Array.isArray(r.requiredCertifications) && r.requiredCertifications.length) {
      return r.requiredCertifications;
    }
    const blob = [r.summary, ...(r.requirements || [])].join(" ");
    const found = [];
    for (const p of CERT_PATTERNS) {
      if (p.re.test(blob) && !found.includes(p.label)) found.push(p.label);
    }
    if (!found.length) {
      found.push("Industry-standard security & quality certifications as specified in RFP");
    }
    return found;
  }

  function defaultScopeOfWork(r) {
    if (Array.isArray(r.scopeOfWork) && r.scopeOfWork.length) return r.scopeOfWork;
    const type = (r.type || "").toLowerCase();
    const base = [
      `Deliver ${r.type || "professional services"} for ${r.buyer} as described in the solicitation.`,
      `Operate under agreed SLAs for the contract term with clear governance and reporting.`,
      `Support transition from incumbent or internal teams with a documented knowledge-transfer plan.`,
    ];
    if (type.includes("cloud") || type.includes("msp")) {
      base.push("Provide 24×7 monitoring, incident response, and capacity/performance management.");
      base.push("Implement cost optimization / FinOps practices where cloud spend is in scope.");
    }
    if (type.includes("bpo") || type.includes("cx")) {
      base.push("Staff, train, and quality-manage contact center or BPO operations to volume targets.");
      base.push("Deploy omnichannel tooling, WFM, and continuous improvement programs.");
    }
    if (type.includes("cyber")) {
      base.push("Design, implement, and/or operate security controls aligned to stated frameworks.");
    }
    if (type.includes("automation") || type.includes("rpa")) {
      base.push("Build, test, and operate automation bots with CoE governance and change control.");
    }
    if (type.includes("data")) {
      base.push("Modernize or support data platform pipelines, models, and analytics consumption.");
    }
    return base;
  }

  function defaultTimeline(r) {
    if (Array.isArray(r.submissionTimeline) && r.submissionTimeline.length) {
      return r.submissionTimeline;
    }
    const posted = r.posted || addDaysIso(r.deadline, -45);
    const deadline = r.deadline;
    const qAndA = addDaysIso(deadline, -21);
    const intent = addDaysIso(deadline, -14);
    const finalQuestions = addDaysIso(deadline, -7);
    return [
      { date: posted, title: "RFP released", description: "Solicitation published and available to vendors.", status: "done" },
      { date: qAndA, title: "Questions due", description: "Submit clarifying questions to the contracting officer.", status: "auto" },
      { date: intent, title: "Intent to bid (recommended)", description: "Internal go/no-go and optional notice of intent.", status: "auto" },
      { date: finalQuestions, title: "Final Q&A responses", description: "Buyer publishes answers; proposal freeze approaches.", status: "auto" },
      { date: deadline, title: "Proposal submission deadline", description: "Hard close for electronic or portal submission.", status: "auto" },
      {
        date: addDaysIso(deadline, 14),
        title: "Evaluation / shortlist (est.)",
        description: "Buyer evaluates technical and commercial responses.",
        status: "upcoming",
      },
      {
        date: addDaysIso(deadline, 35),
        title: "Award decision (est.)",
        description: "Contract award notification and transition kickoff.",
        status: "upcoming",
      },
    ];
  }

  function resolveTimelineStatus(item, timeline, index) {
    if (item.status && item.status !== "auto") return item.status;
    const days = daysUntil(item.date);
    if (days < 0) return "done";
    const firstUpcoming = timeline.findIndex((s) => daysUntil(s.date) >= 0);
    if (index === firstUpcoming) return "current";
    return "upcoming";
  }

  function defaultEligibility(r) {
    if (Array.isArray(r.eligibilityCriteria) && r.eligibilityCriteria.length) {
      return r.eligibilityCriteria;
    }
    const items = [
      `Vendor must be able to deliver in ${rfpCountry(r)}${r.location ? ` (${r.location})` : ""}.`,
      `Demonstrated experience in ${r.industry || "the buyer’s industry"} preferred.`,
      `Capability to perform ${r.type || "the required services"} at the stated scale.`,
    ];
    if (r.setAside && r.setAside !== "None") {
      items.push(`Set-aside / preference: ${r.setAside}.`);
    } else {
      items.push("Open competition — no small-business set-aside unless otherwise stated.");
    }
    items.push("Financial capacity and references for similar contract values may be required.");
    items.push("Compliance with buyer security, privacy, and subcontracting rules.");
    return items;
  }

  // ---------- Go / No-Go worksheet ----------
  const GONOGO_CRITERIA = [
    {
      id: "strategic",
      label: "Strategic fit",
      weight: 15,
      help: "Aligns with target markets, services, and growth strategy?",
    },
    {
      id: "capability",
      label: "Capability / solution fit",
      weight: 20,
      help: "Can we meet mandatory requirements and deliver quality?",
    },
    {
      id: "capacity",
      label: "Capacity & delivery readiness",
      weight: 15,
      help: "Do we have people, seats, and bandwidth before the deadline?",
    },
    {
      id: "commercial",
      label: "Commercial / margin attractiveness",
      weight: 15,
      help: "Deal size, margin potential, payment terms, contract risk?",
    },
    {
      id: "risk",
      label: "Risk & compliance",
      weight: 15,
      help: "Certifications, legal/liability, delivery, reputation risk?",
    },
    {
      id: "relationship",
      label: "Customer relationship",
      weight: 10,
      help: "Existing relationship, access to decision-makers, buyer preference?",
    },
    {
      id: "competitive",
      label: "Competitive / incumbent position",
      weight: 10,
      help: "Incumbent strength, our differentiators, win probability?",
    },
  ];

  const SCORE_LABELS = {
    1: "Very weak",
    2: "Weak",
    3: "Neutral",
    4: "Strong",
    5: "Very strong",
  };

  function defaultGoNoGo(rfp) {
    const match = Number(rfp?.matchScore) || 0;
    // Seed scores lightly from match score so worksheet isn't blank
    const seed = match >= 85 ? 4 : match >= 70 ? 3 : match >= 50 ? 2 : 1;
    const scores = {};
    const notes = {};
    GONOGO_CRITERIA.forEach((c) => {
      scores[c.id] = seed;
      notes[c.id] = "";
    });
    // Capability nudged by match
    scores.capability = Math.min(5, Math.max(1, seed + (match >= 80 ? 1 : 0)));
    return {
      scores,
      notes,
      finalDecision: "Pending",
      rationale: "",
      conditions: "",
      approver: "",
      decidedBy: "",
      decidedAt: null,
      history: [],
    };
  }

  function getGoNoGo(rfp) {
    if (!rfp || !rfp.id) return defaultGoNoGo(rfp);
    if (!rfp.goNoGo) rfp.goNoGo = defaultGoNoGo(rfp);
    // Ensure all criteria keys exist
    GONOGO_CRITERIA.forEach((c) => {
      if (rfp.goNoGo.scores[c.id] == null) rfp.goNoGo.scores[c.id] = 3;
      if (rfp.goNoGo.notes[c.id] == null) rfp.goNoGo.notes[c.id] = "";
    });
    return rfp.goNoGo;
  }

  function calcGoNoGoWeighted(gng) {
    let totalWeight = 0;
    let weighted = 0;
    for (const c of GONOGO_CRITERIA) {
      const s = Number(gng.scores[c.id]) || 0;
      weighted += s * c.weight;
      totalWeight += c.weight;
    }
    // Convert 1–5 weighted average to 0–100
    const avg1to5 = totalWeight ? weighted / totalWeight : 0;
    const score100 = Math.round(((avg1to5 - 1) / 4) * 100);
    return { avg1to5: Math.round(avg1to5 * 100) / 100, score100: Math.max(0, Math.min(100, score100)) };
  }

  function recommendFromGoNoGo(score100, gng) {
    const lowScores = GONOGO_CRITERIA.filter((c) => (Number(gng.scores[c.id]) || 0) <= 2);
    if (score100 >= 75 && lowScores.length === 0) {
      return {
        verdict: "Go",
        tone: "go",
        title: "Worksheet recommendation: Go",
        rationale: `Weighted go/no-go score is ${score100}/100 with no weak criteria (≤2). Pursuit is justified if capacity and commercials are confirmed.`,
      };
    }
    if (score100 >= 55) {
      return {
        verdict: "Conditional Go",
        tone: "conditional",
        title: "Worksheet recommendation: Conditional Go",
        rationale: `Weighted score is ${score100}/100. ${
          lowScores.length
            ? `Weak areas: ${lowScores.map((c) => c.label).join(", ")}. `
            : ""
        }Proceed only with clear conditions and risk owners.`,
      };
    }
    return {
      verdict: "No-Go",
      tone: "nogo",
      title: "Worksheet recommendation: No-Go",
      rationale: `Weighted score is ${score100}/100 — below the typical pursuit threshold (~55). Preserve bid capacity unless there is a strategic override with executive approval.`,
    };
  }

  function computeBidDecision(r) {
    // Prefer saved formal decision
    const gng = r.goNoGo;
    if (gng && gng.finalDecision && gng.finalDecision !== "Pending") {
      const tone =
        gng.finalDecision === "Go" ? "go" : gng.finalDecision === "Conditional Go" ? "conditional" : "nogo";
      return {
        verdict: gng.finalDecision,
        tone,
        title: `Recorded decision: ${gng.finalDecision}`,
        rationale:
          gng.rationale ||
          `Approved by ${gng.approver || "—"} on ${gng.decidedAt ? new Date(gng.decidedAt).toLocaleString() : "—"}.`,
        formal: true,
      };
    }

    if (gng && Object.keys(gng.scores || {}).length) {
      const { score100 } = calcGoNoGoWeighted(gng);
      return recommendFromGoNoGo(score100, gng);
    }

    const score = Number(r.matchScore) || 0;
    const highRisks = (r.risks || []).filter((x) => x.level === "High").length;
    const profileName = getProfile().name || "your company";

    if (score >= 85 && highRisks === 0) {
      return {
        verdict: "Go",
        tone: "go",
        title: "AI profile hint: Pursue (Go)",
        rationale: `Profile match is ${score}/100 against ${profileName}. Complete the Go/No-Go worksheet to formalize the decision.`,
      };
    }
    if (score >= 70) {
      return {
        verdict: "Conditional Go",
        tone: "conditional",
        title: "AI profile hint: Conditional Go",
        rationale: `Profile match is ${score}/100. Use the worksheet to rate capacity, commercial, and competitive factors before committing.`,
      };
    }
    return {
      verdict: "No-Go",
      tone: "nogo",
      title: "AI profile hint: No-Go",
      rationale: `Profile match is ${score}/100. Worksheet may still override with strategic rationale and approver sign-off.`,
    };
  }

  function decisionTone(verdict) {
    if (verdict === "Go") return "go";
    if (verdict === "Conditional Go") return "conditional";
    if (verdict === "No-Go") return "nogo";
    return "pending";
  }

  function renderGoNoGoWorksheet(r) {
    if (!r.id) {
      return `
        <div class="card mb-20 detail-section" id="gonogo">
          <div class="card-header"><h3><span class="section-num">G</span> Go / No-Go Worksheet</h3></div>
          <div class="card-body"><p class="text-sm text-muted">Add an RFP first, then complete the go/no-go assessment.</p></div>
        </div>`;
    }

    const gng = getGoNoGo(r);
    const { score100, avg1to5 } = calcGoNoGoWeighted(gng);
    const rec = recommendFromGoNoGo(score100, gng);
    const team = (APP_DATA.settings?.team || []).map((t) => t.name);
    const user = typeof Auth !== "undefined" ? Auth.currentUser() : null;
    const defaultDecider = user?.name || team[0] || "";

    const historyHtml =
      (gng.history || []).length > 0
        ? `
      <div class="mt-20">
        <div class="text-xs text-muted fw-600 mb-8">DECISION HISTORY</div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Decision</th>
                <th>Score</th>
                <th>Approver</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              ${[...gng.history]
                .reverse()
                .slice(0, 8)
                .map(
                  (h) => `
                <tr>
                  <td class="text-sm">${h.at ? new Date(h.at).toLocaleString() : "—"}</td>
                  <td><span class="badge ${h.decision === "Go" ? "badge-green" : h.decision === "Conditional Go" ? "badge-amber" : "badge-red"}">${escapeHtml(h.decision)}</span></td>
                  <td class="text-sm fw-600">${h.score100 ?? "—"}/100</td>
                  <td class="text-sm">${escapeHtml(h.approver || "—")}</td>
                  <td class="text-sm">${escapeHtml(h.decidedBy || "—")}</td>
                </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
      </div>`
        : "";

    return `
      <div class="card mb-20 detail-section" id="gonogo">
        <div class="card-header">
          <h3><span class="section-num">G</span> Go / No-Go Worksheet</h3>
          <span class="badge ${score100 >= 75 ? "badge-green" : score100 >= 55 ? "badge-amber" : "badge-red"}">
            Score ${score100}/100
          </span>
        </div>
        <div class="card-body">
          <p class="text-sm text-muted mb-16">
            Rate each criterion from <strong>1 (very weak)</strong> to <strong>5 (very strong)</strong>.
            Weights reflect typical bid-board practice. Save a formal decision with approver and rationale.
          </p>

          <div class="gonogo-summary mb-20">
            <div class="gonogo-meter">
              <div class="progress-bar" style="height:12px">
                <div class="progress-fill ${score100 >= 75 ? "green" : score100 >= 55 ? "amber" : ""}" style="width:${score100}%"></div>
              </div>
              <div class="flex-between mt-16 flex-wrap gap-8">
                <div>
                  <div class="text-xs text-muted">Weighted score</div>
                  <div class="fw-700" style="font-size:1.4rem;color:var(--primary-900)">${score100}<span class="text-sm text-muted"> / 100</span></div>
                  <div class="text-xs text-muted">Avg rating ${avg1to5} / 5</div>
                </div>
                <div class="bid-decision ${rec.tone}" style="margin:0;min-width:220px;padding:14px 16px">
                  <div class="decision-label">System recommendation</div>
                  <div class="decision-title" style="font-size:1.05rem">${escapeHtml(rec.verdict)}</div>
                </div>
                ${
                  gng.finalDecision && gng.finalDecision !== "Pending"
                    ? `<div class="bid-decision ${decisionTone(gng.finalDecision)}" style="margin:0;min-width:220px;padding:14px 16px">
                        <div class="decision-label">Formal decision</div>
                        <div class="decision-title" style="font-size:1.05rem">${escapeHtml(gng.finalDecision)}</div>
                        <div class="text-xs mt-8" style="opacity:0.9">${escapeHtml(gng.approver || "—")} · ${
                          gng.decidedAt ? new Date(gng.decidedAt).toLocaleDateString() : ""
                        }</div>
                      </div>`
                    : `<div class="badge badge-gray" style="align-self:center">No formal decision yet</div>`
                }
              </div>
            </div>
          </div>

          <div class="table-wrap gonogo-table-wrap">
            <table class="gonogo-table">
              <thead>
                <tr>
                  <th>Criterion</th>
                  <th style="width:70px">Weight</th>
                  <th style="width:200px">Score (1–5)</th>
                  <th>Notes / evidence</th>
                </tr>
              </thead>
              <tbody>
                ${GONOGO_CRITERIA.map((c) => {
                  const val = Number(gng.scores[c.id]) || 3;
                  return `
                  <tr data-criterion="${c.id}">
                    <td>
                      <div class="fw-600 text-sm">${escapeHtml(c.label)}</div>
                      <div class="text-xs text-muted">${escapeHtml(c.help)}</div>
                    </td>
                    <td class="text-sm fw-600">${c.weight}%</td>
                    <td>
                      <div class="gonogo-score-btns" data-score-for="${c.id}">
                        ${[1, 2, 3, 4, 5]
                          .map(
                            (n) => `
                          <button type="button" class="gonogo-score-btn ${val === n ? "active" : ""}" data-criterion="${c.id}" data-score="${n}" title="${SCORE_LABELS[n]}">${n}</button>`
                          )
                          .join("")}
                      </div>
                      <div class="text-xs text-muted mt-8">${SCORE_LABELS[val] || ""}</div>
                    </td>
                    <td>
                      <textarea class="form-textarea gonogo-note" data-note-for="${c.id}" rows="2" placeholder="Why this score?">${escapeHtml(gng.notes[c.id] || "")}</textarea>
                    </td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>

          <div class="grid-2 mt-24">
            <div class="form-group">
              <label class="form-label" for="gonogo-final">Final decision <span class="required-mark">*</span></label>
              <select class="form-select" id="gonogo-final">
                <option value="Pending" ${gng.finalDecision === "Pending" ? "selected" : ""}>Pending (not decided)</option>
                <option value="Go" ${gng.finalDecision === "Go" ? "selected" : ""}>Go — pursue</option>
                <option value="Conditional Go" ${gng.finalDecision === "Conditional Go" ? "selected" : ""}>Conditional Go</option>
                <option value="No-Go" ${gng.finalDecision === "No-Go" ? "selected" : ""}>No-Go — decline</option>
              </select>
              <p class="form-hint">You may override the system recommendation with a clear rationale.</p>
            </div>
            <div class="form-group">
              <label class="form-label" for="gonogo-approver">Approver <span class="required-mark">*</span></label>
              <select class="form-select" id="gonogo-approver">
                <option value="">Select approver…</option>
                ${team
                  .map(
                    (n) =>
                      `<option value="${escapeAttr(n)}" ${gng.approver === n ? "selected" : ""}>${escapeHtml(n)}</option>`
                  )
                  .join("")}
                ${
                  defaultDecider && !team.includes(defaultDecider)
                    ? `<option value="${escapeAttr(defaultDecider)}" ${gng.approver === defaultDecider ? "selected" : ""}>${escapeHtml(defaultDecider)}</option>`
                    : ""
                }
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="gonogo-rationale">Decision rationale <span class="required-mark">*</span></label>
            <textarea class="form-textarea" id="gonogo-rationale" rows="3" placeholder="Why Go / Conditional / No-Go? Reference criteria, risks, and strategic drivers.">${escapeHtml(gng.rationale || "")}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="gonogo-conditions">Conditions (required if Conditional Go)</label>
            <textarea class="form-textarea" id="gonogo-conditions" rows="2" placeholder="e.g. Partner for language coverage; price desk approval; named EM confirmed by Friday">${escapeHtml(gng.conditions || "")}</textarea>
          </div>

          <div id="gonogo-error" class="auth-error" hidden></div>

          <div class="flex gap-8 flex-wrap mt-16">
            <button type="button" class="btn btn-secondary" id="btn-gonogo-save-draft">Save scores (draft)</button>
            <button type="button" class="btn btn-primary" id="btn-gonogo-submit">Record formal decision</button>
            <button type="button" class="btn btn-ghost" id="btn-gonogo-reset">Reset scores</button>
          </div>

          <div class="alert alert-info mt-20" style="margin-bottom:0">
            <div class="text-sm">
              <strong>Tip:</strong> Go → status becomes <em>Proposal</em>.
              Conditional Go → <em>Qualifying</em>.
              No-Go → <em>No-Go</em>. Decision is stored on this RFP with history.
            </div>
          </div>

          ${historyHtml}
        </div>
      </div>`;
  }

  function enrichOpportunity(r) {
    const executiveSummary =
      r.executiveSummary ||
      r.summary ||
      `${r.buyer} has issued an RFP for ${r.title}. Estimated value ${r.value}; submissions due ${formatDate(r.deadline)}.`;

    // Ensure go/no-go object exists for real RFPs
    if (r.id) getGoNoGo(r);

    return {
      ...r,
      executiveSummary,
      scopeOfWork: defaultScopeOfWork(r),
      mandatoryRequirements: r.mandatoryRequirements || r.requirements || [],
      submissionTimeline: defaultTimeline(r),
      eligibilityCriteria: defaultEligibility(r),
      requiredCertifications: extractCertifications(r),
      risks: r.risks || [],
      recommendedBidDecision: computeBidDecision(r),
    };
  }

  function renderMatchScoreGauge(score, opts = {}) {
    const s = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
    const cls = scoreClass(s);
    const size = opts.size || 132;
    const stroke = opts.stroke || 10;
    const radius = (size - stroke) / 2;
    const circ = 2 * Math.PI * radius;
    const offset = circ - (s / 100) * circ;
    const light = !!opts.light;
    const center = size / 2;

    return `
      <div class="match-score-ring ${cls}" style="width:${size}px;height:${size}px">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
          <circle class="ring-bg" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke}"></circle>
          <circle class="ring-fg" cx="${center}" cy="${center}" r="${radius}" stroke-width="${stroke}"
            stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"></circle>
        </svg>
        <div class="match-score-center">
          <div class="score-num">${s}</div>
          <div class="score-of">out of 100</div>
        </div>
      </div>
      <div class="match-score-label">${opts.label || (s >= 85 ? "Strong match" : s >= 70 ? "Moderate match" : "Weak match")}</div>
    `;
  }

  function renderListItems(items, numbered) {
    if (!items?.length) {
      return `<p class="text-sm text-muted">No items listed for this section.</p>`;
    }
    return `
      <ul class="req-list">
        ${items
          .map(
            (item, i) => `
          <li>
            <span class="req-check">${numbered ? i + 1 : "✓"}</span>
            <span>${escapeHtml(item)}</span>
          </li>`
          )
          .join("")}
      </ul>`;
  }

  function renderOpportunity() {
    const raw = getRfp(state.selectedRfpId);
    const r = enrichOpportunity(raw);
    const decision = r.recommendedBidDecision;
    const score = Number(r.matchScore) || 0;
    const profile = getProfile();
    const others = APP_DATA.rfps.filter((x) => x.id !== r.id).slice(0, 4);
    const days = daysUntil(r.deadline);

    const gng = r.id ? getGoNoGo(raw) : null;
    const gngScore = gng ? calcGoNoGoWeighted(gng).score100 : null;
    const formalDecision = gng?.finalDecision && gng.finalDecision !== "Pending" ? gng.finalDecision : null;

    const sections = [
      { id: "gonogo", label: "Go / No-Go" },
      { id: "exec-summary", label: "Executive Summary" },
      { id: "scope", label: "Scope of Work" },
      { id: "mandatory", label: "Mandatory Requirements" },
      { id: "timeline", label: "Submission Timeline" },
      { id: "eligibility", label: "Eligibility" },
      { id: "certs", label: "Certifications" },
      { id: "risks", label: "Risks" },
      { id: "decision", label: "Decision Summary" },
    ];

    if (!APP_DATA.rfps.length) {
      return `
        <div class="card">
          <div class="empty-state">
            <p class="fw-600 mb-8">No opportunities yet</p>
            <p class="text-sm text-muted mb-16">Add an RFP first, then complete the Go/No-Go worksheet on that opportunity.</p>
            <button type="button" class="btn btn-primary" data-nav="search">Go to RFP Search</button>
          </div>
        </div>`;
    }

    return `
      <div class="mb-16 flex-between flex-wrap gap-8">
        <div style="flex:1;min-width:220px">
          <label class="form-label">Select opportunity</label>
          <select class="form-select" id="opp-selector" style="max-width:520px">
            ${APP_DATA.rfps
              .map(
                (x) =>
                  `<option value="${x.id}" ${x.id === r.id ? "selected" : ""}>${x.id} — ${escapeHtml(x.title)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>

      <div class="opp-hero">
        <div class="flex-between flex-wrap gap-8" style="align-items:center">
          <div style="flex:1;min-width:240px">
            <div class="flex-center gap-8 mb-8 flex-wrap">
              ${statusBadge(r.status)}
              ${
                formalDecision
                  ? `<span class="badge" style="background:rgba(255,255,255,0.2);color:#fff">${escapeHtml(formalDecision)}</span>`
                  : `<span class="badge" style="background:rgba(255,255,255,0.12);color:#fff">Go/No-Go pending</span>`
              }
              <span class="badge badge-blue" style="background:rgba(255,255,255,0.15);color:#fff">${escapeHtml(r.type)}</span>
              <span class="text-sm" style="opacity:0.8">${escapeHtml(r.id)}</span>
            </div>
            <h2>${escapeHtml(r.title)}</h2>
            <div class="meta mt-16">
              <span><strong>Organization:</strong> ${escapeHtml(r.buyer)}</span>
              <span><strong>Country:</strong> ${escapeHtml(rfpCountry(r))}</span>
              <span><strong>Value:</strong> ${escapeHtml(r.value)}</span>
              <span><strong>Deadline:</strong> ${formatDate(r.deadline)} (${days < 0 ? Math.abs(days) + "d overdue" : days + " days"})</span>
              <span><strong>Industry:</strong> ${escapeHtml(r.industry)}</span>
              <span><strong>Source:</strong> ${escapeHtml(r.source)}</span>
              ${gngScore != null ? `<span><strong>Go/No-Go score:</strong> ${gngScore}/100</span>` : ""}
            </div>
            <div class="flex gap-8 mt-16 flex-wrap">
              <button class="btn btn-primary" data-jump="gonogo" style="background:#fff;color:var(--primary-800)">Open Go/No-Go worksheet</button>
              <button class="btn btn-secondary" data-nav="bid-advisor" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4)">AI Bid / No-Bid Advisor</button>
              <button class="btn btn-secondary" data-nav="win-themes" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4)">Win Theme Generator</button>
              <button class="btn btn-secondary" data-nav="clarifications" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4)">Clarification Questions</button>
              <button class="btn btn-secondary" data-nav="proposal-draft" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4)">Proposal Draft Generator</button>
              <button class="btn btn-secondary" data-nav="proposal" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4)">Open Proposal</button>
              <button class="btn btn-secondary" data-nav="compliance" style="background:transparent;color:#fff;border-color:rgba(255,255,255,0.4)">Compliance Matrix</button>
            </div>
          </div>
          <div class="match-score-panel" title="Match score based on company profile">
            ${renderMatchScoreGauge(score, { label: "Match Score" })}
          </div>
        </div>
      </div>

      <nav class="opp-section-nav" aria-label="Opportunity sections">
        ${sections.map((s) => `<button type="button" class="opp-jump" data-jump="${s.id}">${s.label}</button>`).join("")}
      </nav>

      <div class="grid-2-1">
        <div>
          ${renderGoNoGoWorksheet(raw)}

          <div class="card mb-20 detail-section" id="exec-summary">
            <div class="card-header">
              <h3><span class="section-num">1</span> Executive Summary</h3>
            </div>
            <div class="card-body">
              <p class="text-sm" style="line-height:1.7">${escapeHtml(r.executiveSummary)}</p>
              <div class="grid-2 mt-20">
                <div>
                  <div class="text-xs text-muted fw-600 mb-8">SERVICE CATEGORY</div>
                  <div>${escapeHtml(r.type)}</div>
                </div>
                <div>
                  <div class="text-xs text-muted fw-600 mb-8">ESTIMATED VALUE</div>
                  <div>${escapeHtml(r.value)}</div>
                </div>
                <div>
                  <div class="text-xs text-muted fw-600 mb-8">POSTED</div>
                  <div>${formatDate(r.posted)}</div>
                </div>
                <div>
                  <div class="text-xs text-muted fw-600 mb-8">NAICS / SET-ASIDE</div>
                  <div>${escapeHtml(r.naics || "—")} · ${escapeHtml(r.setAside || "None")}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-20 detail-section" id="scope">
            <div class="card-header">
              <h3><span class="section-num">2</span> Scope of Work</h3>
            </div>
            <div class="card-body">
              ${renderListItems(r.scopeOfWork, true)}
            </div>
          </div>

          <div class="card mb-20 detail-section" id="mandatory">
            <div class="card-header">
              <h3><span class="section-num">3</span> Mandatory Requirements</h3>
              <span class="badge badge-blue">${(r.mandatoryRequirements || []).length} items</span>
            </div>
            <div class="card-body">
              ${renderListItems(r.mandatoryRequirements, true)}
            </div>
          </div>

          <div class="card mb-20 detail-section" id="timeline">
            <div class="card-header">
              <h3><span class="section-num">4</span> Submission Timeline</h3>
            </div>
            <div class="card-body">
              <div class="timeline-steps">
                ${r.submissionTimeline
                  .map((step, idx, arr) => {
                    const st = resolveTimelineStatus(step, arr, idx);
                    return `
                    <div class="timeline-step">
                      <div class="step-date">${formatDate(step.date)}</div>
                      <div class="step-rail">
                        <div class="step-dot ${st}"></div>
                        <div class="step-line"></div>
                      </div>
                      <div class="step-body">
                        <div class="step-title">${escapeHtml(step.title)}</div>
                        <div class="step-desc">${escapeHtml(step.description || "")}</div>
                      </div>
                    </div>`;
                  })
                  .join("")}
              </div>
            </div>
          </div>

          <div class="card mb-20 detail-section" id="eligibility">
            <div class="card-header">
              <h3><span class="section-num">5</span> Eligibility Criteria</h3>
            </div>
            <div class="card-body">
              ${renderListItems(r.eligibilityCriteria, true)}
            </div>
          </div>

          <div class="card mb-20 detail-section" id="certs">
            <div class="card-header">
              <h3><span class="section-num">6</span> Required Certifications</h3>
            </div>
            <div class="card-body">
              <div class="cert-grid">
                ${r.requiredCertifications
                  .map(
                    (c) => `
                  <span class="cert-chip">
                    <span class="cert-icon">◈</span>
                    ${escapeHtml(c)}
                  </span>`
                  )
                  .join("")}
              </div>
              <p class="form-hint mt-16">Compared against certifications on your company profile for match scoring.</p>
            </div>
          </div>

          <div class="card mb-20 detail-section" id="risks">
            <div class="card-header">
              <h3><span class="section-num">7</span> Risks</h3>
              <span class="badge badge-amber">${(r.risks || []).length} identified</span>
            </div>
            <div class="card-body">
              ${(r.risks || []).length
                ? r.risks
                    .map(
                      (risk) => `
                  <div class="risk-row">
                    <div>${riskBadge(risk.level)}</div>
                    <div class="text-sm">${escapeHtml(risk.text)}</div>
                  </div>`
                    )
                    .join("")
                : `<p class="text-sm text-muted">No specific risks flagged for this opportunity.</p>`}
            </div>
          </div>

          <div class="card mb-20 detail-section" id="decision">
            <div class="card-header">
              <h3><span class="section-num">8</span> Decision Summary</h3>
            </div>
            <div class="card-body">
              <div class="bid-decision ${decision.tone}">
                <div class="decision-label">${decision.formal ? "Formal recorded decision" : "Current recommendation"}</div>
                <div class="decision-title">${escapeHtml(decision.title)}</div>
                <div class="decision-rationale">${escapeHtml(decision.rationale)}</div>
                <div class="decision-actions">
                  <button type="button" class="btn btn-sm btn-primary" data-jump="gonogo">Edit Go/No-Go worksheet</button>
                  ${
                    formalDecision === "Go" || formalDecision === "Conditional Go"
                      ? `<button type="button" class="btn btn-sm btn-secondary" data-nav="proposal">Open proposal</button>`
                      : ""
                  }
                </div>
              </div>
              ${(r.aiInsights || []).length
                ? `<div class="mt-20">
                    <div class="text-xs text-muted fw-600 mb-8">SUPPORTING INSIGHTS</div>
                    ${r.aiInsights
                      .map(
                        (ins) => `
                      <div class="alert alert-info" style="margin-bottom:8px">
                        <div class="text-sm">${escapeHtml(ins)}</div>
                      </div>`
                      )
                      .join("")}
                  </div>`
                : ""}
            </div>
          </div>
        </div>

        <div>
          <div class="card mb-20">
            <div class="card-header"><h3>Match Score</h3></div>
            <div class="card-body match-score-card ${scoreClass(score)}">
              ${renderMatchScoreGauge(score, { light: true, label: "Profile fit" })}
              <p class="text-xs text-muted mt-16" style="line-height:1.5">
                Scored out of <strong>100</strong> using
                <strong>${escapeHtml(profile.name || "your company profile")}</strong>
                (services, industries, certs, partnerships, geography, case studies).
              </p>
              <button type="button" class="btn btn-sm btn-primary mt-16" id="btn-ai-analyze" ${r.apiId ? "" : "disabled title=\"Save this RFP to the API first\""}>
                ${icon("spark")} Run OpenAI analysis
              </button>
              <p class="text-xs text-muted mt-8">Calls <code>POST /analyze</code> with the server AI provider (OpenAI when configured).</p>
            </div>
          </div>

          <div class="card mb-20">
            <div class="card-header">
              <h3>${icon("spark")} Score breakdown</h3>
            </div>
            <div class="card-body">
              ${(r.matchBreakdown || [])
                .map(
                  (b) => `
                <div class="flex-between mb-8 text-sm">
                  <span>${escapeHtml(b.label)}</span>
                  <span class="fw-600" style="color:var(--success)">+${b.points}</span>
                </div>`
                )
                .join("") || `<p class="text-sm text-muted">Save your company profile to refine this score.</p>`}
              <div class="flex-between mt-16 text-sm fw-700" style="border-top:1px solid var(--gray-200);padding-top:12px">
                <span>Total match</span>
                <span>${score} / 100</span>
              </div>
              <button type="button" class="btn btn-sm btn-secondary mt-16" data-nav="company">Edit company profile</button>
            </div>
          </div>

          <div class="card mb-20">
            <div class="card-header"><h3>Contacts</h3></div>
            <div class="table-wrap">
              <table>
                <thead><tr><th>Role</th><th>Name</th></tr></thead>
                <tbody>
                  ${(r.contacts || [])
                    .map(
                      (c) => `
                    <tr>
                      <td class="text-sm">${escapeHtml(c.role)}</td>
                      <td>
                        <div class="fw-600 text-sm">${escapeHtml(c.name)}</div>
                        <a class="text-xs" href="mailto:${escapeAttr(c.email)}">${escapeHtml(c.email)}</a>
                      </td>
                    </tr>`
                    )
                    .join("") || `<tr><td colspan="2" class="text-sm text-muted">No contacts listed</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Other Opportunities</h3></div>
            <div class="card-body">
              ${others
                .map(
                  (o) => `
                <div class="flex-between mb-16" data-open-rfp="${o.id}" style="cursor:pointer;padding:8px;border-radius:8px"
                  onmouseover="this.style.background='var(--primary-50)'" onmouseout="this.style.background='transparent'">
                  <div style="min-width:0">
                    <div class="text-sm fw-600" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(o.title)}</div>
                    <div class="text-xs text-muted">${escapeHtml(o.buyer)}</div>
                  </div>
                  <span class="score-pill score-${scoreClass(o.matchScore)}"><span class="score-dot"></span>${o.matchScore}</span>
                </div>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderChipField(fieldKey, label, hint, required) {
    const items = getProfile()[fieldKey] || [];
    const suggestions = (PROFILE_SUGGESTIONS[fieldKey] || []).filter(
      (s) => !items.some((i) => i.toLowerCase() === s.toLowerCase())
    );
    return `
      <div class="form-group">
        <label class="form-label">${label}${required ? '<span class="required-mark">*</span>' : ""}</label>
        <div class="chip-field" data-chip-field="${fieldKey}">
          <div class="chip-list" id="chips-${fieldKey}">
            ${items
              .map(
                (item, idx) => `
              <span class="chip" data-chip-idx="${idx}">
                ${escapeHtml(item)}
                <button type="button" data-remove-chip="${fieldKey}" data-idx="${idx}" aria-label="Remove ${escapeAttr(item)}">×</button>
              </span>`
              )
              .join("")}
            <input
              class="chip-input"
              type="text"
              data-chip-input="${fieldKey}"
              placeholder="Type and press Enter"
              autocomplete="off"
            />
          </div>
        </div>
        ${hint ? `<p class="form-hint">${hint}</p>` : ""}
        ${
          suggestions.length
            ? `<div class="chip-suggestions" data-suggest-for="${fieldKey}">
                ${suggestions
                  .slice(0, 8)
                  .map(
                    (s) =>
                      `<button type="button" data-add-suggestion="${fieldKey}" data-value="${escapeAttr(s)}">+ ${escapeHtml(s)}</button>`
                  )
                  .join("")}
              </div>`
            : ""
        }
      </div>`;
  }

  function renderCaseStudyCard(cs, index) {
    return `
      <div class="case-study-card" data-case-index="${index}">
        <button type="button" class="btn btn-sm btn-ghost case-remove" data-remove-case="${index}" title="Remove case study">Remove</button>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Client name</label>
            <input class="form-input" data-case-field="client" data-case-index="${index}" value="${escapeAttr(cs.client || "")}" placeholder="e.g. Global Bank Corp" />
          </div>
          <div class="form-group">
            <label class="form-label">Domain / service area</label>
            <input class="form-input" data-case-field="domain" data-case-index="${index}" value="${escapeAttr(cs.domain || "")}" placeholder="e.g. Cloud Migration" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Contract value</label>
            <input class="form-input" data-case-field="value" data-case-index="${index}" value="${escapeAttr(cs.value || "")}" placeholder="e.g. $8.1M" />
          </div>
          <div class="form-group">
            <label class="form-label">Year</label>
            <input class="form-input" data-case-field="year" data-case-index="${index}" value="${escapeAttr(cs.year || "")}" placeholder="e.g. 2025" />
          </div>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">Summary</label>
          <textarea class="form-textarea" data-case-field="summary" data-case-index="${index}" rows="2" placeholder="Brief outcome and relevance for future RFPs...">${escapeHtml(cs.summary || "")}</textarea>
        </div>
      </div>`;
  }

  function renderCompany() {
    const p = getProfile();
    const completeness = profileCompleteness(p);
    const savedLabel = p.lastSaved
      ? `Last saved ${new Date(p.lastSaved).toLocaleString()}`
      : "Not saved yet — defaults loaded";
    const highMatches = APP_DATA.rfps.filter((r) => r.matchScore >= 85).length;

    return `
      <div class="alert alert-info">
        ${icon("spark")}
        <div>
          <strong>This profile powers RFP qualification.</strong>
          Match scores on Search, Dashboard, and Opportunity Details update when you save.
          Data is stored in this browser for future sessions.
        </div>
      </div>

      <div class="profile-save-bar">
        <div class="save-meta">
          <span class="dirty-dot ${state.profileDirty ? "" : "saved"}" id="profile-dirty-dot"></span>
          <strong id="profile-dirty-label">${state.profileDirty ? "Unsaved changes" : "Profile saved"}</strong>
          <span class="text-muted"> · ${savedLabel}</span>
          <div class="profile-completeness">
            <span class="text-xs text-muted">Completeness</span>
            <div class="progress-bar"><div class="progress-fill ${completeness >= 80 ? "green" : ""}" style="width:${completeness}%"></div></div>
            <span class="text-xs fw-600">${completeness}%</span>
          </div>
        </div>
        <div class="flex gap-8 flex-wrap">
          <button type="button" class="btn btn-secondary" id="btn-reset-profile">Reset to defaults</button>
          <button type="button" class="btn btn-primary" id="btn-save-profile">Save Profile</button>
        </div>
      </div>

      <div class="grid-2-1">
        <div>
          <div class="card mb-20">
            <div class="card-header">
              <h3>Company Overview</h3>
              <span class="badge badge-blue">Required for matching</span>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label" for="profile-name">Company name<span class="required-mark">*</span></label>
                <input class="form-input" id="profile-name" type="text" value="${escapeAttr(p.name || "")}" placeholder="Legal or trading name" />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="profile-employees">Number of employees<span class="required-mark">*</span></label>
                  <input class="form-input" id="profile-employees" type="text" value="${escapeAttr(p.employees || "")}" placeholder="e.g. 2400" />
                  <p class="form-hint">Used as a soft capacity signal when qualifying large RFPs.</p>
                </div>
                <div class="form-group">
                  <label class="form-label" for="profile-revenue">Annual revenue<span class="required-mark">*</span></label>
                  <input class="form-input" id="profile-revenue" type="text" value="${escapeAttr(p.annualRevenue || "")}" placeholder="e.g. $185M" />
                </div>
              </div>
            </div>
          </div>

          <div class="card mb-20">
            <div class="card-header"><h3>Markets & Capabilities</h3></div>
            <div class="card-body">
              ${renderChipField("countriesServed", "Countries served", "Where you can deliver or support work.", true)}
              ${renderChipField("servicesOffered", "Services offered", "Core service lines compared to RFP type and scope.", true)}
              ${renderChipField("industryExpertise", "Industry expertise", "Verticals where you have proven delivery experience.", true)}
            </div>
          </div>

          <div class="card mb-20">
            <div class="card-header"><h3>Credentials & Partnerships</h3></div>
            <div class="card-body">
              ${renderChipField("certifications", "Certifications", "Matched against mandatory RFP compliance requirements.", true)}
              ${renderChipField("technologyPartnerships", "Technology partnerships", "Cloud, platform, and ISV partnerships (AWS, Microsoft, ServiceNow, etc.).", true)}
            </div>
          </div>

          <div class="card mb-20">
            <div class="card-header">
              <h3>Case studies</h3>
              <button type="button" class="btn btn-sm btn-secondary" id="btn-add-case">+ Add case study</button>
            </div>
            <div class="card-body">
              <p class="form-hint mb-16">Past wins improve match scores when domain and industry align with a new RFP.</p>
              <div id="case-studies-list">
                ${(p.caseStudies || []).length
                  ? p.caseStudies.map((cs, i) => renderCaseStudyCard(cs, i)).join("")
                  : `<div class="empty-state" style="padding:24px">No case studies yet. Add at least one to strengthen qualification.</div>`}
              </div>
            </div>
          </div>
        </div>

        <div>
          <div class="card mb-20 profile-preview-card">
            <div class="card-header"><h3>Qualification Snapshot</h3></div>
            <div class="card-body">
              <div class="preview-row">
                <span class="preview-label">Company</span>
                <span class="preview-value">${escapeHtml(p.name || "—")}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Employees</span>
                <span class="preview-value">${escapeHtml(formatEmployees(p.employees))}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Revenue</span>
                <span class="preview-value">${escapeHtml(p.annualRevenue || "—")}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Countries</span>
                <span class="preview-value">${(p.countriesServed || []).length}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Services</span>
                <span class="preview-value">${(p.servicesOffered || []).length}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Industries</span>
                <span class="preview-value">${(p.industryExpertise || []).length}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Certifications</span>
                <span class="preview-value">${(p.certifications || []).length}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Partnerships</span>
                <span class="preview-value">${(p.technologyPartnerships || []).length}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">Case studies</span>
                <span class="preview-value">${(p.caseStudies || []).length}</span>
              </div>
              <div class="preview-row">
                <span class="preview-label">High matches (≥85%)</span>
                <span class="preview-value" style="color:var(--success)">${highMatches} RFPs</span>
              </div>
            </div>
          </div>

          <div class="card mb-20">
            <div class="card-header"><h3>How scoring uses this profile</h3></div>
            <div class="card-body text-sm" style="line-height:1.7">
              <ul style="padding-left:18px">
                <li><strong>Services</strong> → RFP type & scope</li>
                <li><strong>Industries</strong> → buyer vertical</li>
                <li><strong>Certifications</strong> → mandatory requirements</li>
                <li><strong>Partnerships</strong> → platform prerequisites</li>
                <li><strong>Countries</strong> → delivery location</li>
                <li><strong>Case studies</strong> → domain evidence</li>
              </ul>
              <button type="button" class="btn btn-sm btn-secondary mt-16" data-nav="search">View scored RFPs</button>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>Top matches (live)</h3></div>
            <div class="card-body">
              ${[...APP_DATA.rfps]
                .sort((a, b) => b.matchScore - a.matchScore)
                .slice(0, 4)
                .map(
                  (r) => `
                <div class="flex-between mb-16" style="gap:10px">
                  <div style="min-width:0">
                    <div class="text-sm fw-600" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.title)}</div>
                    <div class="text-xs text-muted">${escapeHtml(r.buyer)}</div>
                  </div>
                  <span class="score-pill score-${scoreClass(r.matchScore)}"><span class="score-dot"></span>${r.matchScore}%</span>
                </div>`
                )
                .join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function formatEmployees(val) {
    if (!val) return "—";
    const n = parseInt(String(val).replace(/,/g, ""), 10);
    if (!Number.isNaN(n)) return n.toLocaleString() + " employees";
    return String(val);
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // ---------- Proposal Workspace ----------
  function defaultProposalSections() {
    const seed = APP_DATA.proposalSections || [];
    return PROPOSAL_SECTION_DEFS.map((def, i) => {
      const found = seed.find((s) => s.id === def.id) || seed[i] || {};
      const html = found.content || "";
      return {
        id: def.id,
        title: def.title,
        owner: found.owner || (APP_DATA.settings?.team?.[i % 4]?.name) || "Unassigned",
        status: found.status || (html ? "wip" : "todo"),
        content: html,
      };
    });
  }

  function countWordsFromHtml(html) {
    const text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return 0;
    return text.split(/\s+/).length;
  }

  function deriveSectionStatus(html) {
    const words = countWordsFromHtml(html);
    if (words >= 40) return "done";
    if (words > 0) return "wip";
    return "todo";
  }

  function loadProposalSections() {
    try {
      const raw = localStorage.getItem(PROPOSAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.sections) && parsed.sections.length) {
          const byId = Object.fromEntries(parsed.sections.map((s) => [s.id, s]));
          state.proposal.sections = PROPOSAL_SECTION_DEFS.map((def) => {
            const s = byId[def.id] || {};
            return {
              id: def.id,
              title: def.title,
              owner: s.owner || "Unassigned",
              status: s.status || deriveSectionStatus(s.content),
              content: s.content || "",
            };
          });
          state.proposal.lastSaved = parsed.savedAt || null;
          if (parsed.activeId && PROPOSAL_SECTION_DEFS.some((d) => d.id === parsed.activeId)) {
            state.proposal.activeId = parsed.activeId;
          }
          return state.proposal.sections;
        }
      }
    } catch (_) {
      /* ignore */
    }
    state.proposal.sections = defaultProposalSections();
    return state.proposal.sections;
  }

  function getProposalSections() {
    if (!state.proposal.sections) loadProposalSections();
    return state.proposal.sections;
  }

  function getActiveProposalSection() {
    const sections = getProposalSections();
    let active = sections.find((s) => s.id === state.proposal.activeId);
    if (!active) {
      state.proposal.activeId = sections[0]?.id;
      active = sections[0];
    }
    return active;
  }

  function persistProposalWorkspace() {
    // Capture live editor HTML before save
    const editor = $("#proposal-editor");
    if (editor) {
      const sec = getActiveProposalSection();
      if (sec) {
        sec.content = editor.innerHTML;
        sec.status = deriveSectionStatus(sec.content);
      }
    }
    const savedAt = new Date().toISOString();
    state.proposal.lastSaved = savedAt;
    state.proposal.dirty = false;
    localStorage.setItem(
      PROPOSAL_STORAGE_KEY,
      JSON.stringify({
        sections: getProposalSections(),
        activeId: state.proposal.activeId,
        savedAt,
        rfpId: state.selectedRfpId,
      })
    );
    // Keep APP_DATA in sync for any legacy reads
    APP_DATA.proposalSections = getProposalSections();
  }

  function htmlToPlainText(html) {
    const div = document.createElement("div");
    div.innerHTML = html || "";
    return (div.innerText || div.textContent || "").trim();
  }

  function buildProposalDocumentHtml(opts = {}) {
    const r = getRfp(state.selectedRfpId);
    const company = getProfile();
    const sections = getProposalSections();
    const forWord = !!opts.forWord;

    const bodySections = sections
      .map(
        (s, i) => `
      <h2 style="color:#0d3b66;font-size:16pt;margin:28px 0 10px;border-bottom:1px solid #cbd5e1;padding-bottom:6px;">
        ${i + 1}. ${escapeHtml(s.title)}
      </h2>
      <div class="section-body" style="font-size:11pt;line-height:1.55;color:#1e293b;">
        ${s.content || "<p><em>(No content)</em></p>"}
      </div>`
      )
      .join("");

    const wordNs = forWord
      ? ` xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"`
      : "";

    return `<!DOCTYPE html>
<html${wordNs}>
<head>
  <meta charset="utf-8" />
  <title>Proposal — ${escapeHtml(r.title)}</title>
  ${
    forWord
      ? `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->`
      : ""
  }
  <style>
    body { font-family: Calibri, "Segoe UI", Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #1e293b; }
    h1 { color: #0a2540; font-size: 22pt; margin-bottom: 4px; }
    .meta { color: #64748b; font-size: 10pt; margin-bottom: 24px; }
    .cover { border-left: 4px solid #2563eb; padding-left: 16px; margin-bottom: 32px; }
    ul, ol { margin: 8px 0 8px 22px; }
    p { margin: 0 0 10px; }
    table.meta-table { border-collapse: collapse; width: 100%; margin: 12px 0 24px; font-size: 10pt; }
    table.meta-table td { padding: 6px 10px; border: 1px solid #e2e8f0; }
    table.meta-table td:first-child { background: #f1f5f9; font-weight: 600; width: 160px; }
  </style>
</head>
<body>
  <div class="cover">
    <h1>Proposal Response</h1>
    <div class="meta">${escapeHtml(company.name || "Vendor")} · Prepared for ${escapeHtml(r.buyer)}</div>
  </div>
  <table class="meta-table">
    <tr><td>Opportunity</td><td>${escapeHtml(r.title)}</td></tr>
    <tr><td>RFP ID</td><td>${escapeHtml(r.id)}</td></tr>
    <tr><td>Organization</td><td>${escapeHtml(r.buyer)}</td></tr>
    <tr><td>Estimated Value</td><td>${escapeHtml(r.value)}</td></tr>
    <tr><td>Submission Deadline</td><td>${escapeHtml(formatDate(r.deadline))}</td></tr>
    <tr><td>Match Score</td><td>${escapeHtml(String(r.matchScore))}/100</td></tr>
    <tr><td>Exported</td><td>${escapeHtml(new Date().toLocaleString())}</td></tr>
  </table>
  ${bodySections}
  <p style="margin-top:40px;font-size:9pt;color:#94a3b8;">Generated by AI RFP Scout · ${escapeHtml(company.name || "")}</p>
</body>
</html>`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function exportProposalDocument(format) {
    persistProposalWorkspace();
    const r = getRfp(state.selectedRfpId);
    const safe = (r.id || "proposal").replace(/[^\w\-]+/g, "_");
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === "word") {
      const html = buildProposalDocumentHtml({ forWord: true });
      // Word opens HTML saved as .doc
      const blob = new Blob(["\ufeff", html], { type: "application/msword" });
      downloadBlob(blob, `Proposal_${safe}_${stamp}.doc`);
      toast("Exported Word document (.doc)");
      return;
    }
    if (format === "html") {
      const html = buildProposalDocumentHtml({ forWord: false });
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      downloadBlob(blob, `Proposal_${safe}_${stamp}.html`);
      toast("Exported HTML document");
      return;
    }
    if (format === "txt") {
      const sections = getProposalSections();
      const rfp = getRfp(state.selectedRfpId);
      const lines = [
        `PROPOSAL RESPONSE`,
        `${rfp.title}`,
        `Prepared for: ${rfp.buyer}`,
        `Deadline: ${formatDate(rfp.deadline)}`,
        ``,
        ...sections.flatMap((s, i) => [
          `${"=".repeat(60)}`,
          `${i + 1}. ${s.title.toUpperCase()}`,
          `${"=".repeat(60)}`,
          htmlToPlainText(s.content) || "(No content)",
          ``,
        ]),
      ];
      const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
      downloadBlob(blob, `Proposal_${safe}_${stamp}.txt`);
      toast("Exported plain text document");
    }
  }

  function renderRichToolbar() {
    const cmds = [
      { cmd: "bold", label: "B", title: "Bold", style: "font-weight:700" },
      { cmd: "italic", label: "I", title: "Italic", style: "font-style:italic" },
      { cmd: "underline", label: "U", title: "Underline", style: "text-decoration:underline" },
      { cmd: "insertUnorderedList", label: "• List", title: "Bullet list" },
      { cmd: "insertOrderedList", label: "1. List", title: "Numbered list" },
      { cmd: "formatBlock:h3", label: "H", title: "Heading" },
      { cmd: "formatBlock:p", label: "¶", title: "Paragraph" },
      { cmd: "createLink", label: "Link", title: "Insert link" },
      { cmd: "removeFormat", label: "Clear", title: "Clear formatting" },
    ];
    return `
      <div class="rte-toolbar" id="rte-toolbar" role="toolbar" aria-label="Formatting">
        ${cmds
          .map(
            (c) => `
          <button type="button" class="rte-btn" data-rte-cmd="${c.cmd}" title="${c.title}" style="${c.style || ""}">${c.label}</button>`
          )
          .join("")}
        <span class="rte-sep"></span>
        <button type="button" class="rte-btn" data-rte-ai title="AI assist for this section">${icon("spark")} AI Assist</button>
      </div>`;
  }

  function renderProposal() {
    const r = getRfp(state.selectedRfpId);
    const sections = getProposalSections();
    const active = getActiveProposalSection();
    const done = sections.filter((s) => s.status === "done").length;
    const wip = sections.filter((s) => s.status === "wip").length;
    const pct = Math.round((done / Math.max(sections.length, 1)) * 100);
    const words = sections.reduce((sum, s) => sum + countWordsFromHtml(s.content), 0);
    const activeWords = countWordsFromHtml(active?.content);
    const savedLabel = state.proposal.lastSaved
      ? `Saved ${new Date(state.proposal.lastSaved).toLocaleString()}`
      : "Not saved yet";

    const statusLabel = { done: "Complete", wip: "In Progress", todo: "Not Started" };

    return `
      <div class="flex-between flex-wrap gap-8 mb-20">
        <div>
          <div class="text-sm text-muted mb-8">Working on</div>
          <select class="form-select" id="proposal-rfp" style="max-width:440px;font-weight:600">
            ${APP_DATA.rfps
              .map(
                (x) =>
                  `<option value="${x.id}" ${x.id === r.id ? "selected" : ""}>${escapeHtml(x.title)}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="flex gap-8 flex-wrap">
          <button type="button" class="btn btn-secondary" id="btn-save-proposal">Save draft</button>
          <div class="export-split">
            <button type="button" class="btn btn-primary" id="btn-export-word">Export Word</button>
            <button type="button" class="btn btn-secondary" id="btn-export-html">HTML</button>
            <button type="button" class="btn btn-secondary" id="btn-export-txt">TXT</button>
          </div>
          <button type="button" class="btn btn-success" id="btn-submit-review">Submit for Review</button>
        </div>
      </div>

      <div class="stat-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat-card">
          <div class="stat-label">Completion</div>
          <div class="stat-value">${pct}%</div>
          <div class="progress-bar mt-16"><div class="progress-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Sections complete</div>
          <div class="stat-value">${done} / ${sections.length}</div>
          <div class="stat-change neutral">${wip} in progress</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">Total words</div>
          <div class="stat-value" style="font-size:1.4rem">${words.toLocaleString()}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Deadline</div>
          <div class="stat-value" style="font-size:1.15rem">${formatDate(r.deadline)}</div>
          <div class="stat-change ${daysUntil(r.deadline) <= 10 ? "down" : "neutral"}">${daysUntil(r.deadline)} days left</div>
        </div>
      </div>

      <div class="proposal-workspace">
        <aside class="proposal-nav card">
          <div class="card-header">
            <h3>Sections</h3>
            <span class="badge badge-blue">${sections.length}</span>
          </div>
          <div class="proposal-nav-list">
            ${sections
              .map((s, i) => {
                const w = countWordsFromHtml(s.content);
                return `
                <button type="button" class="proposal-nav-item ${s.id === active.id ? "active" : ""}" data-proposal-section="${s.id}">
                  <span class="proposal-nav-index">${i + 1}</span>
                  <span class="proposal-nav-body">
                    <span class="proposal-nav-title">${escapeHtml(s.title)}</span>
                    <span class="proposal-nav-meta">
                      <span class="status-dot ${s.status}"></span>
                      ${statusLabel[s.status] || s.status} · ${w} words
                    </span>
                  </span>
                </button>`;
              })
              .join("")}
          </div>
          <div class="card-body" style="border-top:1px solid var(--gray-200)">
            <div class="text-xs text-muted mb-8">${state.proposal.dirty ? "Unsaved changes" : savedLabel}</div>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-reset-proposal" style="width:100%">Reset to defaults</button>
          </div>
        </aside>

        <div class="proposal-editor-panel card">
          <div class="card-header proposal-editor-header">
            <div>
              <h3>${escapeHtml(active.title)}</h3>
              <div class="text-xs text-muted mt-8">
                Owner: <strong>${escapeHtml(active.owner)}</strong>
                · <span id="active-word-count">${activeWords} words</span>
                · Rich text editor
              </div>
            </div>
            <div class="flex gap-8 flex-wrap">
              <select class="form-select" id="proposal-owner" style="width:auto;min-width:140px">
                ${(APP_DATA.settings.team || [])
                  .map(
                    (m) =>
                      `<option value="${escapeAttr(m.name)}" ${active.owner === m.name ? "selected" : ""}>${escapeHtml(m.name)}</option>`
                  )
                  .join("")}
                <option value="Unassigned" ${active.owner === "Unassigned" ? "selected" : ""}>Unassigned</option>
              </select>
              <select class="form-select" id="proposal-status" style="width:auto;min-width:130px">
                <option value="todo" ${active.status === "todo" ? "selected" : ""}>Not Started</option>
                <option value="wip" ${active.status === "wip" ? "selected" : ""}>In Progress</option>
                <option value="done" ${active.status === "done" ? "selected" : ""}>Complete</option>
              </select>
            </div>
          </div>
          ${renderRichToolbar()}
          <div
            id="proposal-editor"
            class="rte-editor"
            contenteditable="true"
            role="textbox"
            aria-multiline="true"
            aria-label="Edit ${escapeAttr(active.title)}"
            data-placeholder="Start writing this section… Use the toolbar for bold, lists, and headings."
          >${active.content || ""}</div>
          <div class="proposal-editor-footer">
            <div class="text-xs text-muted">Tip: Ctrl/Cmd+B bold · Ctrl/Cmd+I italic · paste keeps basic formatting</div>
            <div class="flex gap-8">
              <button type="button" class="btn btn-sm btn-secondary" id="btn-prev-section">← Previous</button>
              <button type="button" class="btn btn-sm btn-secondary" id="btn-next-section">Next →</button>
              <button type="button" class="btn btn-sm btn-primary" id="btn-save-section">Save section</button>
            </div>
          </div>
        </div>

        <aside class="proposal-side card">
          <div class="card-header"><h3>Opportunity</h3></div>
          <div class="card-body text-sm">
            <div class="mb-8"><span class="text-muted">Buyer:</span> <strong>${escapeHtml(r.buyer)}</strong></div>
            <div class="mb-8"><span class="text-muted">Industry:</span> ${escapeHtml(r.industry)}</div>
            <div class="mb-8"><span class="text-muted">Value:</span> ${escapeHtml(r.value)}</div>
            <div class="mb-8"><span class="text-muted">Country:</span> ${escapeHtml(rfpCountry(r))}</div>
            <div class="mb-8"><span class="text-muted">Match:</span>
              <span class="score-pill score-${scoreClass(r.matchScore)}"><span class="score-dot"></span>${r.matchScore}/100</span>
            </div>
            <button type="button" class="btn btn-sm btn-secondary mt-16" data-open-rfp="${r.id}">View opportunity</button>
          </div>
          <div class="card-header" style="border-top:1px solid var(--gray-200)"><h3>Export</h3></div>
          <div class="card-body text-sm" style="line-height:1.6">
            <p class="mb-8"><strong>Word (.doc)</strong> — opens in Microsoft Word / Google Docs</p>
            <p class="mb-8"><strong>HTML</strong> — web-ready full proposal</p>
            <p class="mb-16"><strong>TXT</strong> — plain text for email or portals</p>
            <button type="button" class="btn btn-sm btn-primary" id="btn-export-word-side" style="width:100%">Export full document</button>
          </div>
          <div class="card-header" style="border-top:1px solid var(--gray-200)"><h3>${icon("spark")} AI Tips</h3></div>
          <div class="card-body">
            <ul class="text-sm" style="padding-left:18px;line-height:1.75">
              <li>Lead Executive Summary with quantified outcomes</li>
              <li>Map Win Themes to buyer evaluation criteria</li>
              <li>Keep Pricing Assumptions explicit and auditable</li>
              <li>Log open Clarifications before submission</li>
            </ul>
          </div>
        </aside>
      </div>
    `;
  }

  function renderCompliance() {
    const r = getRfp(state.selectedRfpId);
    const allRows = getComplianceRows();
    const fStatus = state.compliance.filterStatus || "";
    const fOwner = state.compliance.filterOwner || "";
    const matrix = allRows.filter((m) => {
      if (fStatus && m.responseStatus !== fStatus) return false;
      if (fOwner && m.assignedOwner !== fOwner) return false;
      return true;
    });

    const comply = allRows.filter((m) => m.responseStatus === "Comply").length;
    const partial = allRows.filter((m) => m.responseStatus === "Partial").length;
    const inProgress = allRows.filter((m) => m.responseStatus === "In Progress").length;
    const exception = allRows.filter((m) => m.responseStatus === "Exception").length;
    const openItems = allRows.filter((m) =>
      ["Not Started", "In Progress", "Exception"].includes(m.responseStatus)
    ).length;
    const answered = allRows.filter((m) =>
      ["Comply", "Partial", "Exception", "N/A"].includes(m.responseStatus)
    ).length;
    const coverage = allRows.length ? Math.round((answered / allRows.length) * 100) : 0;
    const owners = COMPLIANCE_OWNERS();
    const statuses = RESPONSE_STATUSES();
    const uploaded = state.compliance.uploadedFile;
    const extracting = state.compliance.extracting;

    return `
      <div class="flex-between flex-wrap gap-8 mb-20">
        <div>
          <div class="text-sm text-muted mb-8">Linked opportunity</div>
          <select class="form-select" id="compliance-rfp" style="max-width:420px;font-weight:600">
            ${APP_DATA.rfps
              .map(
                (x) =>
                  `<option value="${x.id}" ${x.id === r.id ? "selected" : ""}>${escapeHtml(x.title)}</option>`
              )
              .join("")}
          </select>
        </div>
        <div class="flex gap-8 flex-wrap">
          <button type="button" class="btn btn-secondary" id="btn-add-req">+ Add requirement</button>
          <button type="button" class="btn btn-secondary" id="btn-reset-matrix">Reset matrix</button>
          <button type="button" class="btn btn-primary" id="btn-export-excel">⬇ Export to Excel</button>
        </div>
      </div>

      <div class="card mb-20 upload-card">
        <div class="card-header">
          <h3>Upload RFP Document</h3>
          <span class="badge badge-blue">PDF · DOCX · TXT</span>
        </div>
        <div class="card-body">
          <div class="upload-dropzone ${extracting ? "is-busy" : ""}" id="rfp-dropzone" tabindex="0" role="button" aria-label="Upload RFP document">
            <input type="file" id="rfp-file-input" accept=".pdf,.doc,.docx,.txt,.md,.rtf,application/pdf,text/plain" hidden />
            <div class="upload-icon">📄</div>
            <div class="upload-title">${extracting ? "Extracting requirements…" : "Drag & drop an RFP document here"}</div>
            <div class="upload-sub text-sm text-muted">
              ${
                extracting
                  ? "AI is parsing mandatory requirements and page references"
                  : "or click to browse — requirements are extracted into the matrix below"
              }
            </div>
            ${
              !extracting
                ? `<button type="button" class="btn btn-primary mt-16" id="btn-browse-rfp">Choose file</button>`
                : `<div class="progress-bar mt-16" style="max-width:280px;margin-left:auto;margin-right:auto"><div class="progress-fill" style="width:72%"></div></div>`
            }
          </div>
          ${
            uploaded
              ? `<div class="upload-file-meta mt-16">
                  <div class="flex-between flex-wrap gap-8">
                    <div>
                      <div class="fw-600 text-sm">${escapeHtml(uploaded.name)}</div>
                      <div class="text-xs text-muted">
                        ${(uploaded.size / 1024).toFixed(1)} KB · uploaded ${new Date(uploaded.uploadedAt).toLocaleString()}
                        ${uploaded.requirementCount != null ? ` · ${uploaded.requirementCount} requirements extracted` : ""}
                      </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-secondary" id="btn-clear-upload">Remove file</button>
                  </div>
                </div>`
              : `<p class="form-hint mt-16">Tip: upload a <strong>.txt</strong> RFP with numbered requirements for best extraction. PDF/DOCX use AI simulation mapped to the selected opportunity.</p>`
          }
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-card success">
          <div class="stat-label">Comply</div>
          <div class="stat-value">${comply}</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Partial / In progress</div>
          <div class="stat-value">${partial + inProgress}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Exceptions / Open</div>
          <div class="stat-value">${openItems}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">Response coverage</div>
          <div class="stat-value">${coverage}%</div>
          <div class="progress-bar mt-16"><div class="progress-fill green" style="width:${coverage}%"></div></div>
        </div>
      </div>

      ${
        exception > 0
          ? `<div class="alert alert-warning"><strong>${exception} exception(s)</strong> require commercial or technical risk review before submission.</div>`
          : ""
      }

      <div class="filters-bar compliance-filters">
        <div class="form-group">
          <label class="form-label" for="matrix-filter-status">Response status</label>
          <select class="form-select" id="matrix-filter-status">
            <option value="">All statuses</option>
            ${statuses.map((s) => `<option value="${escapeAttr(s)}" ${fStatus === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label" for="matrix-filter-owner">Assigned owner</label>
          <select class="form-select" id="matrix-filter-owner">
            <option value="">All owners</option>
            ${owners.map((o) => `<option value="${escapeAttr(o)}" ${fOwner === o ? "selected" : ""}>${escapeHtml(o)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="flex:0;min-width:auto;align-self:flex-end">
          <button type="button" class="btn btn-secondary" id="btn-clear-matrix-filters">Clear filters</button>
        </div>
        <div class="form-group" style="flex:1;min-width:160px;align-self:flex-end">
          <div class="text-sm text-muted" style="padding-bottom:8px">
            Showing <strong>${matrix.length}</strong> of <strong>${allRows.length}</strong> requirements
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Compliance Matrix</h3>
          <span class="badge badge-blue">${allRows.length} requirements</span>
        </div>
        <div class="table-wrap">
          <table class="compliance-table">
            <thead>
              <tr>
                <th style="width:36px">#</th>
                <th style="min-width:220px">Requirement</th>
                <th style="width:90px">Page Number</th>
                <th style="width:130px">Response Status</th>
                <th style="width:140px">Assigned Owner</th>
                <th style="width:130px">Due Date</th>
                <th style="min-width:160px">Comments</th>
                <th style="width:48px"></th>
              </tr>
            </thead>
            <tbody>
              ${
                matrix.length
                  ? matrix
                      .map((m) => {
                        const overdue =
                          m.dueDate && daysUntil(m.dueDate) < 0 && !["Comply", "N/A"].includes(m.responseStatus);
                        return `
                <tr data-row-id="${m.id}">
                  <td class="text-muted text-sm">${m.id}</td>
                  <td>
                    <textarea class="form-textarea matrix-input matrix-req" data-field="requirement" data-id="${m.id}" rows="2">${escapeHtml(m.requirement)}</textarea>
                  </td>
                  <td>
                    <input class="form-input matrix-input" data-field="pageNumber" data-id="${m.id}" value="${escapeAttr(m.pageNumber)}" placeholder="e.g. 12" />
                  </td>
                  <td>
                    <select class="form-select matrix-input matrix-status ${responseClass(m.responseStatus)}" data-field="responseStatus" data-id="${m.id}">
                      ${statuses
                        .map(
                          (s) =>
                            `<option value="${escapeAttr(s)}" ${m.responseStatus === s ? "selected" : ""}>${escapeHtml(s)}</option>`
                        )
                        .join("")}
                    </select>
                  </td>
                  <td>
                    <select class="form-select matrix-input" data-field="assignedOwner" data-id="${m.id}">
                      ${owners
                        .map(
                          (o) =>
                            `<option value="${escapeAttr(o)}" ${m.assignedOwner === o ? "selected" : ""}>${escapeHtml(o)}</option>`
                        )
                        .join("")}
                    </select>
                  </td>
                  <td>
                    <input class="form-input matrix-input ${overdue ? "input-overdue" : ""}" type="date" data-field="dueDate" data-id="${m.id}" value="${escapeAttr(m.dueDate)}" />
                  </td>
                  <td>
                    <textarea class="form-textarea matrix-input" data-field="comments" data-id="${m.id}" rows="2" placeholder="Notes…">${escapeHtml(m.comments)}</textarea>
                  </td>
                  <td>
                    <button type="button" class="btn btn-sm btn-ghost" data-delete-row="${m.id}" title="Remove row">✕</button>
                  </td>
                </tr>`;
                      })
                      .join("")
                  : `<tr><td colspan="8"><div class="empty-state">No requirements yet. Upload an RFP document or add a requirement manually.</div></td></tr>`
              }
            </tbody>
          </table>
        </div>
        <div class="card-body" style="border-top:1px solid var(--gray-200);padding-top:14px">
          <div class="flex-between flex-wrap gap-8">
            <div class="text-sm text-muted">Edits save automatically in this browser.</div>
            <button type="button" class="btn btn-primary" id="btn-export-excel-footer">Export to Excel</button>
          </div>
        </div>
      </div>

      <div class="grid-2 mt-24">
        <div class="card">
          <div class="card-header"><h3>Response status legend</h3></div>
          <div class="card-body text-sm">
            <div class="flex-center mb-16 gap-8"><span class="badge badge-gray">Not Started</span> Not yet assessed</div>
            <div class="flex-center mb-16 gap-8"><span class="badge badge-amber">In Progress</span> Owner drafting response</div>
            <div class="flex-center mb-16 gap-8"><span class="badge" style="background:var(--success-bg);color:var(--success)">Comply</span> Fully meet with evidence</div>
            <div class="flex-center mb-16 gap-8"><span class="badge" style="background:var(--warning-bg);color:var(--warning)">Partial</span> Meet with conditions</div>
            <div class="flex-center mb-16 gap-8"><span class="badge" style="background:var(--danger-bg);color:var(--danger)">Exception</span> Cannot meet — waiver needed</div>
            <div class="flex-center gap-8"><span class="badge badge-gray">N/A</span> Not applicable to this bid</div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>${icon("spark")} How upload works</h3></div>
          <div class="card-body text-sm" style="line-height:1.7">
            <p class="mb-8">1. Select the related opportunity (optional but recommended).</p>
            <p class="mb-8">2. Upload the RFP — text files are parsed for numbered/mandatory language; PDF/DOCX simulate extraction from the opportunity requirements with page numbers.</p>
            <p class="mb-8">3. Assign owners, set due dates, and update response status.</p>
            <p>4. <strong>Export to Excel</strong> downloads a spreadsheet you can share with the bid team.</p>
          </div>
        </div>
      </div>
    `;
  }

  function renderSettings() {
    const s = state.settings;
    return `
      <div class="tabs" id="settings-tabs">
        <button class="tab active" data-tab="notifications">Notifications</button>
        <button class="tab" data-tab="search-prefs">Search Preferences</button>
        <button class="tab" data-tab="team">Team</button>
        <button class="tab" data-tab="integrations">Integrations</button>
      </div>

      <div id="tab-notifications" class="settings-panel">
        <div class="card">
          <div class="card-header"><h3>Notification Preferences</h3></div>
          <div class="card-body">
            ${renderToggle("newRfpMatch", "New high-match RFP alerts", "Email + in-app when match ≥ threshold", s.notifications.newRfpMatch)}
            ${renderToggle("deadlineReminders", "Deadline reminders", "3 days and 1 day before proposal due dates", s.notifications.deadlineReminders)}
            ${renderToggle("proposalUpdates", "Proposal collaboration updates", "When teammates edit shared sections", s.notifications.proposalUpdates)}
            ${renderToggle("weeklyDigest", "Weekly pipeline digest", "Monday morning summary of pipeline health", s.notifications.weeklyDigest)}
            ${renderToggle("competitorAlerts", "Competitor / incumbent alerts", "AI flags known incumbents on new RFPs", s.notifications.competitorAlerts)}
          </div>
        </div>
      </div>

      <div id="tab-search-prefs" class="settings-panel" style="display:none">
        <div class="card">
          <div class="card-header"><h3>Search & Matching</h3></div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Minimum match score for alerts</label>
              <input class="form-input" type="number" id="min-match" min="0" max="100" value="${s.search.minMatchScore}" style="max-width:120px">
              <p class="form-hint">RFPs below this score will still appear in search but won't trigger alerts.</p>
            </div>
            <div class="settings-row">
              <div>
                <div class="fw-600 text-sm">Auto-qualify high matches</div>
                <div class="text-xs text-muted">Automatically set status to Qualifying when score ≥ 90%</div>
              </div>
              <div class="toggle ${s.search.autoQualify ? "on" : ""}" data-toggle-auto="autoQualify"></div>
            </div>
            <div class="form-group mt-20">
              <label class="form-label">Monitored sources</label>
              <div class="tag-list">
                ${s.search.sources.map((src) => `<span class="tag">${src}</span>`).join("")}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Target industries</label>
              <div class="tag-list">
                ${s.search.industries.map((ind) => `<span class="tag">${ind}</span>`).join("")}
              </div>
            </div>
            <button class="btn btn-primary mt-16" id="btn-save-search">Save Preferences</button>
          </div>
        </div>
      </div>

      <div id="tab-team" class="settings-panel" style="display:none">
        <div class="card">
          <div class="card-header">
            <h3>Team Members</h3>
            <button class="btn btn-sm btn-primary" id="btn-invite">Invite Member</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Actions</th></tr></thead>
              <tbody>
                ${s.team
                  .map(
                    (m) => `
                  <tr>
                    <td class="fw-600">${m.name}</td>
                    <td><span class="badge badge-blue">${m.role}</span></td>
                    <td>${m.email}</td>
                    <td><button class="btn btn-sm btn-ghost" data-edit-member="${m.email}">Edit</button></td>
                  </tr>`
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="tab-integrations" class="settings-panel" style="display:none">
        <div class="card">
          <div class="card-header"><h3>Connected Integrations</h3></div>
          <div class="card-body">
            ${[
              { name: "SAM.gov", status: "Connected", desc: "Federal opportunity feed" },
              { name: "GovWin IQ", status: "Connected", desc: "Government pipeline intelligence" },
              { name: "ServiceNow", status: "Connected", desc: "Sync won deals to delivery" },
              { name: "Microsoft 365", status: "Connected", desc: "Proposal docs & Teams" },
              { name: "Salesforce", status: "Not connected", desc: "CRM opportunity sync" },
              { name: "Slack", status: "Not connected", desc: "Channel notifications" },
            ]
              .map(
                (intg) => `
              <div class="settings-row">
                <div>
                  <div class="fw-600 text-sm">${intg.name}</div>
                  <div class="text-xs text-muted">${intg.desc}</div>
                </div>
                <div class="flex-center gap-8">
                  <span class="badge ${intg.status === "Connected" ? "badge-green" : "badge-gray"}">${intg.status}</span>
                  <button class="btn btn-sm btn-secondary" data-integration="${intg.name}">
                    ${intg.status === "Connected" ? "Configure" : "Connect"}
                  </button>
                </div>
              </div>`
              )
              .join("")}
          </div>
        </div>
      </div>
    `;
  }

  function renderToggle(key, title, desc, on) {
    return `
      <div class="settings-row">
        <div>
          <div class="fw-600 text-sm">${title}</div>
          <div class="text-xs text-muted">${desc}</div>
        </div>
        <div class="toggle ${on ? "on" : ""}" data-toggle-notif="${key}"></div>
      </div>`;
  }

  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  // ---------- Main render ----------
  function render() {
    if (typeof Auth !== "undefined" && !Auth.isLoggedIn()) {
      showAppShell(false);
      showAuthView("login");
      return;
    }
    showAppShell(true);
    updateUserChrome();
    renderSidebar();
    const meta = PAGE_META[state.page] || PAGE_META.dashboard;
    const titleEl = $("#page-title");
    const subEl = $("#page-subtitle");
    if (titleEl) titleEl.textContent = meta.title;
    if (subEl) subEl.textContent = meta.subtitle;

    const content = $("#content");
    if (!content) return;
    const renderers = {
      dashboard: renderDashboard,
      search: renderSearch,
      opportunity: renderOpportunity,
      "bid-advisor": renderBidAdvisor,
      "win-themes": renderWinThemes,
      clarifications: renderClarifications,
      "proposal-draft": renderProposalDraft,
      company: renderCompany,
      proposal: renderProposal,
      compliance: renderCompliance,
      settings: renderSettings,
    };
    content.innerHTML = (renderers[state.page] || renderDashboard)();
    bindPageEvents();
    window.scrollTo(0, 0);
  }

  function bindPageEvents() {
    // Global nav buttons inside content
    $$("[data-nav]").forEach((btn) => {
      btn.addEventListener("click", () => navigate(btn.dataset.nav));
    });

    $$("[data-open-rfp]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        navigate("opportunity", el.dataset.openRfp);
      });
    });

    // Search page
    bindSearchPageEvents();

    // Opportunity
    const oppSelector = $("#opp-selector");
    if (oppSelector) {
      oppSelector.addEventListener("change", () => navigate("opportunity", oppSelector.value));
    }

    $$("[data-jump]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const el = document.getElementById(btn.dataset.jump);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    bindGoNoGoEvents();
    bindAiAnalyzeEvents();
    bindBidAdvisorEvents();
    bindWinThemeEvents();
    bindClarificationEvents();
    bindProposalDraftEvents();

    // Company profile
    bindCompanyProfileEvents();

    // Proposal workspace
    bindProposalEvents();

    // Compliance
    bindComplianceEvents();

    // Settings
    $$("#settings-tabs .tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$("#settings-tabs .tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        $$(".settings-panel").forEach((p) => (p.style.display = "none"));
        const panel = $(`#tab-${tab.dataset.tab}`);
        if (panel) panel.style.display = "block";
      });
    });
    $$("[data-toggle-notif]").forEach((tog) => {
      tog.addEventListener("click", () => {
        const key = tog.dataset.toggleNotif;
        state.settings.notifications[key] = !state.settings.notifications[key];
        tog.classList.toggle("on");
        toast("Notification preference updated");
      });
    });
    $$("[data-toggle-auto]").forEach((tog) => {
      tog.addEventListener("click", () => {
        state.settings.search.autoQualify = !state.settings.search.autoQualify;
        tog.classList.toggle("on");
        toast("Auto-qualify setting updated");
      });
    });
    const btnSaveSearch = $("#btn-save-search");
    if (btnSaveSearch) {
      btnSaveSearch.addEventListener("click", () => {
        const input = $("#min-match");
        if (input) state.settings.search.minMatchScore = Number(input.value) || 70;
        toast("Search preferences saved");
      });
    }
    const btnInvite = $("#btn-invite");
    if (btnInvite) {
      btnInvite.addEventListener("click", () => toast("Invite link copied (demo)"));
    }
    $$("[data-integration]").forEach((btn) => {
      btn.addEventListener("click", () => toast(`${btn.dataset.integration}: configuration panel (demo)`));
    });
    $$("[data-edit-member]").forEach((btn) => {
      btn.addEventListener("click", () => toast("Edit member (demo)"));
    });
  }

  // ---------- AI Proposal Draft Generator ----------
  function parsePastLibraryText(text) {
    const blocks = String(text || "")
      .split(/\n\s*---\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean);
    return blocks.map((block, i) => {
      const lines = block.split(/\r?\n/);
      const title = (lines[0] || `Past proposal ${i + 1}`).replace(/^#+\s*/, "").trim();
      const excerpt = lines.slice(1).join("\n").trim() || block;
      return { title, excerpt, tags: [] };
    });
  }

  function selectedProposalDraftApiId() {
    const sel = $("#pd-rfp-select");
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
    if (opt && opt.dataset.apiId) return Number(opt.dataset.apiId);
    const rfp = getRfp(state.selectedRfpId);
    return rfp?.apiId ? Number(rfp.apiId) : null;
  }

  function collectProposalDraftInputs() {
    return {
      past_library: parsePastLibraryText(state.proposalDraft.pastLibraryText || $("#pd-past-library")?.value || ""),
      tone: ($("#pd-tone")?.value || state.proposalDraft.tone || "professional").trim(),
      emphasis: ($("#pd-emphasis")?.value || state.proposalDraft.emphasis || "").trim() || null,
      extra_notes: ($("#pd-extra")?.value || state.proposalDraft.extraNotes || "").trim() || null,
    };
  }

  function collectProposalDraftFromDom() {
    const draft = state.proposalDraft.draft;
    if (!draft) return null;
    const sections = (draft.sections || []).map((s) => {
      const ta = document.getElementById("pd-section-" + s.id);
      const content = ta ? ta.value : s.content || "";
      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      return {
        ...s,
        content,
        word_count: words,
        status: ta && ta.value !== (s.content || "") ? "edited" : s.status || "draft",
      };
    });
    return { ...draft, sections };
  }

  function renderProposalDraft() {
    const rfps = APP_DATA.rfps || [];
    const selected = getRfp(state.selectedRfpId);
    const draft = state.proposalDraft.draft;
    const templates = state.proposalDraft.templates || [];
    const templateId = state.proposalDraft.templateId || "enterprise_standard";
    const activeId =
      state.proposalDraft.activeSectionId ||
      (draft && draft.sections && draft.sections[0] && draft.sections[0].id) ||
      "executive_summary";
    const active =
      (draft && (draft.sections || []).find((s) => s.id === activeId)) ||
      (draft && draft.sections && draft.sections[0]) ||
      null;
    const err = state.proposalDraft.error;
    const totalWords = draft
      ? (draft.sections || []).reduce((n, s) => n + (Number(s.word_count) || 0), 0)
      : 0;

    return `
      <div class="pd-page">
        <div class="alert alert-info mb-20">
          ${icon("spark")}
          <div>
            <strong>AI Proposal Draft Generator</strong> builds a full multi-section proposal from the RFP,
            company profile, win themes, and optional past proposal library. Edit section-by-section,
            switch templates, regenerate one section, then export to <strong>Word</strong> or <strong>PDF</strong>.
          </div>
        </div>

        <div class="grid-2-1 mb-20">
          <div class="card">
            <div class="card-header"><h3>Generate draft</h3></div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pd-rfp-select">RFP <span class="required-mark">*</span></label>
                  <select class="form-select" id="pd-rfp-select">
                    ${
                      rfps.length
                        ? rfps
                            .map(
                              (r) =>
                                `<option value="${escapeAttr(r.id)}" data-api-id="${escapeAttr(r.apiId || "")}" ${
                                  r.id === selected.id ? "selected" : ""
                                }>${escapeHtml(r.title)} (${escapeHtml(r.buyer || r.id)})</option>`
                            )
                            .join("")
                        : `<option value="">No RFPs — add one in RFP Search</option>`
                    }
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pd-template">Proposal template</label>
                  <select class="form-select" id="pd-template">
                    ${
                      templates.length
                        ? templates
                            .map(
                              (t) =>
                                `<option value="${escapeAttr(t.id)}" ${
                                  t.id === templateId ? "selected" : ""
                                }>${escapeHtml(t.name)} (${(t.sections || []).length} sections)</option>`
                            )
                            .join("")
                        : `
                          <option value="enterprise_standard">Enterprise Standard</option>
                          <option value="executive_brief">Executive Brief</option>
                          <option value="technical_deep_dive">Technical Deep Dive</option>
                          <option value="managed_services">Managed Services</option>`
                    }
                  </select>
                  <p class="form-hint" id="pd-template-hint">
                    ${escapeHtml(
                      (templates.find((t) => t.id === templateId) || {}).description ||
                        "Select a template to shape section coverage."
                    )}
                  </p>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="pd-tone">Tone</label>
                  <select class="form-select" id="pd-tone">
                    ${["professional", "executive", "technical", "concise"]
                      .map(
                        (t) =>
                          `<option value="${t}" ${
                            (state.proposalDraft.tone || "professional") === t ? "selected" : ""
                          }>${t}</option>`
                      )
                      .join("")}
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label" for="pd-emphasis">Emphasis (optional)</label>
                  <input class="form-input" id="pd-emphasis" placeholder="e.g. security, cost, AI" value="${escapeAttr(
                    state.proposalDraft.emphasis || ""
                  )}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" for="pd-past-library">Past proposal library snippets</label>
                <textarea class="form-input" id="pd-past-library" rows="4" placeholder="Title on first line, excerpt below. Separate snippets with a line containing only ---">${escapeHtml(
                  state.proposalDraft.pastLibraryText || ""
                )}</textarea>
                <p class="form-hint">Optional reusable language from prior bids.</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="pd-extra">Extra notes</label>
                <textarea class="form-input" id="pd-extra" rows="2" placeholder="Must-win messages, constraints…">${escapeHtml(
                  state.proposalDraft.extraNotes || ""
                )}</textarea>
              </div>
              <label class="flex-center gap-8 text-sm" style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" id="pd-include-wt" ${
                  state.proposalDraft.includeWinThemes !== false ? "checked" : ""
                } />
                Include saved Win Themes (if available)
              </label>
              ${
                err
                  ? `<div class="auth-error mt-12" id="pd-error">${escapeHtml(err)}</div>`
                  : `<div class="auth-error mt-12" id="pd-error" hidden></div>`
              }
              <div class="flex gap-8 flex-wrap mt-16">
                <button type="button" class="btn btn-primary" id="btn-pd-generate" ${!rfps.length ? "disabled" : ""}>
                  ${icon("spark")} Generate full draft
                </button>
                <button type="button" class="btn btn-secondary" id="btn-pd-load" ${!selected.apiId ? "disabled" : ""}>Load saved</button>
                <button type="button" class="btn btn-secondary" id="btn-pd-save" ${!draft ? "disabled" : ""}>Save draft</button>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Sections covered</h3></div>
            <div class="card-body">
              <ul class="ba-list ba-criteria-legend">
                <li>Executive Summary</li>
                <li>About Our Company</li>
                <li>Understanding Customer Needs</li>
                <li>Proposed Solution</li>
                <li>Technical Approach</li>
                <li>Transition Plan</li>
                <li>Governance</li>
                <li>Risk Management</li>
                <li>Innovation</li>
                <li>Commercial Assumptions</li>
                <li>Project Timeline</li>
                <li>Service Levels</li>
                <li>Implementation Plan</li>
                <li>Benefits</li>
                <li>Conclusion</li>
              </ul>
              <p class="text-xs text-muted mt-12">Templates may include a subset of these sections.</p>
            </div>
          </div>
        </div>

        ${
          draft
            ? `
        <div class="card mb-20">
          <div class="card-body flex-between flex-wrap gap-8">
            <div>
              <div class="fw-600">${escapeHtml(draft.rfp_title || "Proposal draft")}</div>
              <div class="text-xs text-muted">
                ${escapeHtml(draft.customer || "")} · ${escapeHtml(draft.template_name || draft.template_id || "")}
                · ${(draft.sections || []).length} sections · ~${totalWords} words
                · ${escapeHtml(draft.provider || "")}
                ${state.proposalDraft.dirty ? " · <span class='wt-dirty'>Unsaved edits</span>" : ""}
              </div>
              ${
                (draft.win_themes_used || []).length
                  ? `<div class="text-xs text-muted mt-4">Win themes: ${escapeHtml(
                      draft.win_themes_used.join("; ")
                    )}</div>`
                  : ""
              }
            </div>
            <div class="flex gap-8 flex-wrap">
              <button type="button" class="btn btn-sm btn-primary" id="btn-pd-export-docx">Export Word</button>
              <button type="button" class="btn btn-sm btn-secondary" id="btn-pd-export-pdf">Export PDF</button>
              <button type="button" class="btn btn-sm btn-ghost" id="btn-pd-export-md">Export Markdown</button>
            </div>
          </div>
        </div>

        <div class="pd-editor-layout">
          <aside class="card pd-section-nav">
            <div class="card-header"><h3>Sections</h3></div>
            <div class="card-body pd-section-list">
              ${(draft.sections || [])
                .map((s) => {
                  const wc = Number(s.word_count) || 0;
                  return `
                  <button type="button" class="pd-section-item ${
                    s.id === (active && active.id) ? "active" : ""
                  }" data-pd-section="${escapeAttr(s.id)}">
                    <span class="pd-section-name">${escapeHtml(s.title)}</span>
                    <span class="pd-section-meta">
                      <span class="badge badge-gray">${escapeHtml(s.status || "draft")}</span>
                      <span class="text-xs text-muted">${wc}w</span>
                    </span>
                  </button>`;
                })
                .join("")}
            </div>
          </aside>
          <div class="card pd-section-editor">
            <div class="card-header flex-between flex-wrap gap-8">
              <h3>${escapeHtml((active && active.title) || "Section")}</h3>
              <div class="flex gap-8 flex-wrap">
                <button type="button" class="btn btn-sm btn-secondary" id="btn-pd-regen-section" ${
                  active ? "" : "disabled"
                }>${icon("spark")} Regenerate section</button>
                <button type="button" class="btn btn-sm btn-primary" id="btn-pd-save-section" ${
                  active ? "" : "disabled"
                }>Save section</button>
              </div>
            </div>
            <div class="card-body">
              ${
                active
                  ? `
                <div class="form-group">
                  <label class="form-label" for="pd-section-guidance">Regen guidance (optional)</label>
                  <input class="form-input" id="pd-section-guidance" placeholder="e.g. Shorter, more quantified benefits, stronger security story" />
                </div>
                <textarea class="form-input pd-section-textarea" id="pd-section-${escapeAttr(
                  active.id
                )}" rows="18" data-pd-edit>${escapeHtml(active.content || "")}</textarea>
                <p class="text-xs text-muted mt-8">Edit freely. Save section to persist, or Save draft for the full document.</p>`
                  : `<div class="empty-state">Select a section</div>`
              }
            </div>
          </div>
        </div>`
            : `<div class="card"><div class="card-body empty-state" style="padding:40px">Generate or load a proposal draft to begin editing.</div></div>`
        }
      </div>
    `;
  }

  async function ensureProposalTemplates() {
    if (state.proposalDraft.templatesLoaded) return;
    try {
      const list = await Api.listProposalTemplates();
      state.proposalDraft.templates = Array.isArray(list) ? list : [];
    } catch (_) {
      state.proposalDraft.templates = [];
    }
    state.proposalDraft.templatesLoaded = true;
  }

  async function runProposalGenerate() {
    const sel = $("#pd-rfp-select");
    if (sel?.value) state.selectedRfpId = sel.value;
    state.proposalDraft.templateId = $("#pd-template")?.value || state.proposalDraft.templateId;
    state.proposalDraft.tone = $("#pd-tone")?.value || "professional";
    state.proposalDraft.emphasis = $("#pd-emphasis")?.value || "";
    state.proposalDraft.extraNotes = $("#pd-extra")?.value || "";
    state.proposalDraft.pastLibraryText = $("#pd-past-library")?.value || "";
    state.proposalDraft.includeWinThemes = !!$("#pd-include-wt")?.checked;

    const apiId = selectedProposalDraftApiId();
    const errEl = $("#pd-error");
    state.proposalDraft.error = null;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }
    if (!apiId) {
      const msg = "This RFP is not saved on the API yet. Create/save it via RFP Search first.";
      state.proposalDraft.error = msg;
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
      toast(msg);
      return;
    }

    Api.showSpinner(true, "AI is writing the proposal draft…");
    try {
      const draft = await Api.generateProposalDraft(apiId, {
        template_id: state.proposalDraft.templateId,
        inputs: collectProposalDraftInputs(),
        include_win_themes: state.proposalDraft.includeWinThemes,
        persist: true,
      });
      state.proposalDraft.draft = draft;
      state.proposalDraft.dirty = false;
      state.proposalDraft.activeSectionId =
        (draft.sections && draft.sections[0] && draft.sections[0].id) || "executive_summary";
      toast(`Draft ready · ${draft.sections?.length || 0} sections`);
      render();
    } catch (err) {
      console.error(err);
      const msg = err.message || "Generation failed";
      state.proposalDraft.error = msg;
      toast(msg);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
    } finally {
      Api.showSpinner(false);
    }
  }

  async function runProposalSectionRegen() {
    const apiId = selectedProposalDraftApiId();
    const sectionId = state.proposalDraft.activeSectionId;
    if (!apiId || !sectionId) {
      toast("Select an RFP and section first");
      return;
    }
    const existing = collectProposalDraftFromDom() || state.proposalDraft.draft;
    const guidance = $("#pd-section-guidance")?.value || "";
    Api.showSpinner(true, "Regenerating section…");
    try {
      const draft = await Api.regenerateProposalSection(apiId, sectionId, {
        template_id: state.proposalDraft.templateId || existing.template_id,
        inputs: collectProposalDraftInputs(),
        existing,
        guidance: guidance || null,
        persist: true,
      });
      state.proposalDraft.draft = draft;
      state.proposalDraft.dirty = false;
      toast("Section regenerated");
      render();
    } catch (err) {
      toast(err.message || "Section regenerate failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function runProposalSectionSave() {
    const apiId = selectedProposalDraftApiId();
    const sectionId = state.proposalDraft.activeSectionId;
    if (!apiId || !sectionId) return;
    const ta = document.getElementById("pd-section-" + sectionId);
    const content = ta ? ta.value : "";
    Api.showSpinner(true, "Saving section…");
    try {
      const draft = await Api.updateProposalSection(apiId, sectionId, {
        content,
        status: "edited",
      });
      state.proposalDraft.draft = draft;
      state.proposalDraft.dirty = false;
      toast("Section saved");
      render();
    } catch (err) {
      toast(err.message || "Save failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function runProposalSave() {
    const apiId = selectedProposalDraftApiId();
    if (!apiId) return;
    const draft = collectProposalDraftFromDom();
    if (!draft) {
      toast("Nothing to save");
      return;
    }
    draft.rfp_id = apiId;
    Api.showSpinner(true, "Saving proposal draft…");
    try {
      const saved = await Api.saveProposalDraft(apiId, draft);
      state.proposalDraft.draft = saved;
      state.proposalDraft.dirty = false;
      toast("Proposal draft saved");
      render();
    } catch (err) {
      toast(err.message || "Save failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function loadProposalDraft() {
    const apiId = selectedProposalDraftApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    Api.showSpinner(true, "Loading proposal draft…");
    try {
      const draft = await Api.getProposalDraft(apiId);
      if (!draft) {
        toast("No saved draft for this RFP");
        return;
      }
      state.proposalDraft.draft = draft;
      state.proposalDraft.templateId = draft.template_id || state.proposalDraft.templateId;
      state.proposalDraft.dirty = false;
      state.proposalDraft.activeSectionId =
        (draft.sections && draft.sections[0] && draft.sections[0].id) ||
        state.proposalDraft.activeSectionId;
      toast("Loaded proposal draft");
      render();
    } catch (err) {
      toast(err.message || "Load failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function exportProposal(format) {
    const apiId = selectedProposalDraftApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    if (state.proposalDraft.dirty) {
      try {
        await runProposalSave();
      } catch (_) {}
    }
    Api.showSpinner(true, "Exporting proposal…");
    try {
      const res = await Api.exportProposalDraft(apiId, format);
      toast("Downloaded " + (res.filename || format));
    } catch (err) {
      toast(err.message || "Export failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  function bindProposalDraftEvents() {
    if (state.page !== "proposal-draft") return;

    // Load templates once when page opens
    if (!state.proposalDraft.templatesLoaded) {
      ensureProposalTemplates().then(() => {
        if (state.page === "proposal-draft") render();
      });
    }

    const rfpSel = $("#pd-rfp-select");
    if (rfpSel) {
      rfpSel.addEventListener("change", () => {
        state.selectedRfpId = rfpSel.value;
        state.proposalDraft.draft = null;
        state.proposalDraft.dirty = false;
        render();
        const opt = rfpSel.selectedOptions && rfpSel.selectedOptions[0];
        if (opt && opt.dataset.apiId) {
          Api.getProposalDraft(Number(opt.dataset.apiId))
            .then((draft) => {
              if (draft && state.page === "proposal-draft") {
                state.proposalDraft.draft = draft;
                state.proposalDraft.templateId = draft.template_id || state.proposalDraft.templateId;
                state.proposalDraft.activeSectionId =
                  (draft.sections && draft.sections[0] && draft.sections[0].id) ||
                  state.proposalDraft.activeSectionId;
                render();
              }
            })
            .catch(() => {});
        }
      });
    }

    $("#pd-template")?.addEventListener("change", (e) => {
      state.proposalDraft.templateId = e.target.value;
      const t = (state.proposalDraft.templates || []).find((x) => x.id === e.target.value);
      const hint = $("#pd-template-hint");
      if (hint && t) hint.textContent = t.description || "";
    });

    ["pd-tone", "pd-emphasis", "pd-extra", "pd-past-library"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (id === "pd-tone") state.proposalDraft.tone = el.value;
        if (id === "pd-emphasis") state.proposalDraft.emphasis = el.value;
        if (id === "pd-extra") state.proposalDraft.extraNotes = el.value;
        if (id === "pd-past-library") state.proposalDraft.pastLibraryText = el.value;
      });
    });
    $("#pd-include-wt")?.addEventListener("change", (e) => {
      state.proposalDraft.includeWinThemes = !!e.target.checked;
    });

    $("#btn-pd-generate")?.addEventListener("click", () => runProposalGenerate());
    $("#btn-pd-load")?.addEventListener("click", () => loadProposalDraft());
    $("#btn-pd-save")?.addEventListener("click", () => runProposalSave());
    $("#btn-pd-regen-section")?.addEventListener("click", () => runProposalSectionRegen());
    $("#btn-pd-save-section")?.addEventListener("click", () => runProposalSectionSave());
    $("#btn-pd-export-docx")?.addEventListener("click", () => exportProposal("docx"));
    $("#btn-pd-export-pdf")?.addEventListener("click", () => exportProposal("pdf"));
    $("#btn-pd-export-md")?.addEventListener("click", () => exportProposal("markdown"));

    $$("[data-pd-section]").forEach((btn) => {
      btn.addEventListener("click", () => {
        // stash current editor content before switching
        if (state.proposalDraft.draft && state.proposalDraft.activeSectionId) {
          const cur = collectProposalDraftFromDom();
          if (cur) {
            state.proposalDraft.draft = cur;
            state.proposalDraft.dirty = true;
          }
        }
        state.proposalDraft.activeSectionId = btn.dataset.pdSection;
        render();
      });
    });

    $$("[data-pd-edit]").forEach((el) => {
      el.addEventListener("input", () => {
        state.proposalDraft.dirty = true;
      });
    });
  }

  // ---------- AI Clarification Question Generator ----------
  const CLARIFICATION_CATEGORIES = [
    "Commercial",
    "Technical",
    "Legal",
    "Delivery",
    "Security",
    "Service Levels",
    "Pricing",
    "Dependencies",
  ];

  function cqStatusBadge(status) {
    const s = String(status || "pending").toLowerCase();
    const map = {
      pending: "badge-gray",
      approved: "badge-green",
      edited: "badge-blue",
      rejected: "badge-red",
    };
    return `<span class="badge ${map[s] || "badge-gray"}">${escapeHtml(status || "pending")}</span>`;
  }

  function cqPriorityClass(p) {
    const x = String(p || "").toLowerCase();
    if (x === "high") return "cq-pri-high";
    if (x === "low") return "cq-pri-low";
    return "cq-pri-med";
  }

  function selectedClarificationApiId() {
    const sel = $("#cq-rfp-select");
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
    if (opt && opt.dataset.apiId) return Number(opt.dataset.apiId);
    const rfp = getRfp(state.selectedRfpId);
    return rfp?.apiId ? Number(rfp.apiId) : null;
  }

  function renderClarifications() {
    const rfps = APP_DATA.rfps || [];
    const selected = getRfp(state.selectedRfpId);
    const pack = state.clarifications.pack;
    const err = state.clarifications.error;
    const filterCat = state.clarifications.filterCategory || "";
    const filterStatus = state.clarifications.filterStatus || "";
    const questions = (pack && pack.questions) || [];
    const filtered = questions.filter((q) => {
      if (filterCat && q.category !== filterCat) return false;
      if (filterStatus && q.status !== filterStatus) return false;
      return true;
    });
    const counts = {
      total: questions.length,
      pending: questions.filter((q) => q.status === "pending").length,
      approved: questions.filter((q) => q.status === "approved" || q.status === "edited").length,
      rejected: questions.filter((q) => q.status === "rejected").length,
    };
    const groups = pack && pack.groups && pack.groups.length
      ? pack.groups
      : CLARIFICATION_CATEGORIES.map((c) => ({
          category: c,
          questions: filtered.filter((q) => q.category === c),
        })).filter((g) => g.questions.length);

    const displayGroups = filterCat
      ? groups.filter((g) => g.category === filterCat)
      : groups;

    return `
      <div class="cq-page">
        <div class="alert alert-info mb-20">
          ${icon("spark")}
          <div>
            <strong>AI Clarification Question Generator</strong> analyzes the RFP for missing information,
            ambiguous requirements, commercial/technical gaps, and contract risks — then produces
            questions you can <strong>approve</strong>, <strong>edit</strong>, <strong>reject</strong>, and
            <strong>export</strong> as an email-ready document.
          </div>
        </div>

        <div class="grid-2-1 mb-20">
          <div class="card">
            <div class="card-header"><h3>Analyze RFP</h3></div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label" for="cq-rfp-select">RFP <span class="required-mark">*</span></label>
                <select class="form-select" id="cq-rfp-select">
                  ${
                    rfps.length
                      ? rfps
                          .map(
                            (r) =>
                              `<option value="${escapeAttr(r.id)}" data-api-id="${escapeAttr(r.apiId || "")}" ${
                                r.id === selected.id ? "selected" : ""
                              }>${escapeHtml(r.title)} (${escapeHtml(r.buyer || r.id)})</option>`
                          )
                          .join("")
                      : `<option value="">No RFPs — add one in RFP Search</option>`
                  }
                </select>
                <p class="form-hint">Uses RFP fields, requirements, and any linked uploaded documents.</p>
              </div>
              <div class="form-group">
                <label class="form-label" for="cq-extra">Extra RFP text / capture notes (optional)</label>
                <textarea class="form-input" id="cq-extra" rows="3" placeholder="Paste extracted RFP sections or notes…">${escapeHtml(
                  state.clarifications.extraContext || ""
                )}</textarea>
              </div>
              ${
                err
                  ? `<div class="auth-error" id="cq-error">${escapeHtml(err)}</div>`
                  : `<div class="auth-error" id="cq-error" hidden></div>`
              }
              <div class="flex gap-8 flex-wrap mt-16">
                <button type="button" class="btn btn-primary" id="btn-cq-generate" ${!rfps.length ? "disabled" : ""}>
                  ${icon("spark")} Generate questions
                </button>
                <button type="button" class="btn btn-secondary" id="btn-cq-load" ${!selected.apiId ? "disabled" : ""}>Load saved</button>
                <button type="button" class="btn btn-secondary" id="btn-cq-export" ${!pack ? "disabled" : ""}>Export email</button>
                <button type="button" class="btn btn-ghost" id="btn-cq-export-md" ${!pack ? "disabled" : ""}>Export markdown</button>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Gap analysis</h3></div>
            <div class="card-body">
              ${
                pack && (pack.gap_summary || []).length
                  ? `<div class="cq-gap-grid">
                      ${(pack.gap_summary || [])
                        .map(
                          (g) => `
                        <div class="cq-gap-card">
                          <div class="cq-gap-count">${Number(g.count) || 0}</div>
                          <div class="cq-gap-type">${escapeHtml(g.gap_type)}</div>
                          <ul class="cq-gap-highlights">
                            ${(g.highlights || [])
                              .slice(0, 2)
                              .map((h) => `<li>${escapeHtml(h)}</li>`)
                              .join("")}
                          </ul>
                        </div>`
                        )
                        .join("")}
                    </div>`
                  : `<div class="empty-state" style="padding:20px">Run generation to see gap summary.</div>`
              }
              ${
                pack
                  ? `<div class="cq-stats mt-16">
                      <span class="badge badge-gray">${counts.total} total</span>
                      <span class="badge badge-sky">${counts.pending} pending</span>
                      <span class="badge badge-green">${counts.approved} approved/edited</span>
                      <span class="badge badge-red">${counts.rejected} rejected</span>
                    </div>
                    ${
                      (pack.document_names || []).length
                        ? `<p class="text-xs text-muted mt-12">Documents: ${escapeHtml(pack.document_names.join(", "))}</p>`
                        : ""
                    }`
                  : ""
              }
            </div>
          </div>
        </div>

        ${
          pack
            ? `
        <div class="card mb-20">
          <div class="card-header flex-between flex-wrap gap-8">
            <h3>Clarification questions</h3>
            <div class="flex gap-8 flex-wrap">
              <select class="form-select" id="cq-filter-cat" style="min-width:140px">
                <option value="">All categories</option>
                ${CLARIFICATION_CATEGORIES.map(
                  (c) =>
                    `<option value="${escapeAttr(c)}" ${filterCat === c ? "selected" : ""}>${escapeHtml(c)}</option>`
                ).join("")}
              </select>
              <select class="form-select" id="cq-filter-status" style="min-width:130px">
                <option value="">All statuses</option>
                ${["pending", "approved", "edited", "rejected"]
                  .map(
                    (s) =>
                      `<option value="${s}" ${filterStatus === s ? "selected" : ""}>${s}</option>`
                  )
                  .join("")}
              </select>
            </div>
          </div>
          <div class="card-body">
            ${
              displayGroups.length
                ? displayGroups
                    .map((group) => {
                      const qs = (group.questions || []).filter((q) => {
                        if (filterStatus && q.status !== filterStatus) return false;
                        return true;
                      });
                      if (!qs.length) return "";
                      return `
                      <div class="cq-group mb-20">
                        <div class="cq-group-title">${escapeHtml(group.category)}
                          <span class="badge badge-blue">${qs.length}</span>
                        </div>
                        <div class="cq-question-list">
                          ${qs
                            .map((q) => {
                              const rejected = q.status === "rejected";
                              return `
                              <div class="cq-question-card ${rejected ? "is-rejected" : ""} ${cqPriorityClass(q.priority)}" data-cq-id="${escapeAttr(q.id)}">
                                <div class="cq-question-meta">
                                  ${cqStatusBadge(q.status)}
                                  <span class="badge badge-amber">${escapeHtml(q.priority || "Medium")}</span>
                                  <span class="badge badge-gray">${escapeHtml(q.gap_type || "")}</span>
                                  ${q.source_ref ? `<span class="text-xs text-muted">Ref: ${escapeHtml(q.source_ref)}</span>` : ""}
                                </div>
                                <textarea class="form-input cq-question-text" data-cq-field="question" rows="3">${escapeHtml(q.question || "")}</textarea>
                                <div class="form-group mt-8">
                                  <label class="form-label text-xs">Rationale</label>
                                  <textarea class="form-input" data-cq-field="rationale" rows="2">${escapeHtml(q.rationale || "")}</textarea>
                                </div>
                                <div class="cq-actions flex gap-8 flex-wrap mt-12">
                                  <button type="button" class="btn btn-sm btn-primary" data-cq-action="approve" data-cq-id="${escapeAttr(q.id)}">Approve</button>
                                  <button type="button" class="btn btn-sm btn-secondary" data-cq-action="save-edit" data-cq-id="${escapeAttr(q.id)}">Save edit</button>
                                  <button type="button" class="btn btn-sm btn-ghost" data-cq-action="reject" data-cq-id="${escapeAttr(q.id)}">Reject</button>
                                  <button type="button" class="btn btn-sm btn-ghost" data-cq-action="reset" data-cq-id="${escapeAttr(q.id)}">Reset pending</button>
                                </div>
                              </div>`;
                            })
                            .join("")}
                        </div>
                      </div>`;
                    })
                    .join("")
                : `<div class="empty-state">No questions match the current filters.</div>`
            }
          </div>
        </div>

        <div class="card mb-20" id="cq-export-panel">
          <div class="card-header">
            <h3>Email-ready clarification document</h3>
            <button type="button" class="btn btn-sm btn-secondary" id="btn-cq-copy-email">Copy to clipboard</button>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label class="form-label">Subject</label>
              <input class="form-input" id="cq-email-subject" readonly value="${escapeAttr(
                (state.clarifications.exportPreview && state.clarifications.exportPreview.subject) ||
                  pack.email_subject ||
                  ""
              )}" />
            </div>
            <div class="form-group">
              <label class="form-label">Body</label>
              <textarea class="form-input cq-email-body" id="cq-email-body" rows="14" readonly>${escapeHtml(
                (state.clarifications.exportPreview && state.clarifications.exportPreview.body) ||
                  pack.email_body ||
                  ""
              )}</textarea>
            </div>
            <p class="text-xs text-muted">Approved and edited questions are preferred in the export. Pending questions are included when none are approved yet.</p>
          </div>
        </div>`
            : ""
        }
      </div>
    `;
  }

  async function runClarificationGenerate() {
    const sel = $("#cq-rfp-select");
    if (sel?.value) state.selectedRfpId = sel.value;
    const apiId = selectedClarificationApiId();
    const extra = $("#cq-extra")?.value || "";
    state.clarifications.extraContext = extra;
    const errEl = $("#cq-error");
    state.clarifications.error = null;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }
    if (!apiId) {
      const msg = "This RFP is not saved on the API yet. Create/save it via RFP Search first.";
      state.clarifications.error = msg;
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
      toast(msg);
      return;
    }
    Api.showSpinner(true, "AI is analyzing the RFP for clarifications…");
    try {
      const pack = await Api.generateClarifications(apiId, {
        extra_context: extra || null,
        persist: true,
      });
      state.clarifications.pack = pack;
      state.clarifications.exportPreview = {
        subject: pack.email_subject,
        body: pack.email_body,
      };
      toast(`Generated ${pack.questions?.length || 0} clarification questions`);
      render();
    } catch (err) {
      console.error(err);
      const msg = err.message || "Generation failed";
      state.clarifications.error = msg;
      toast(msg);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
    } finally {
      Api.showSpinner(false);
    }
  }

  async function loadClarifications() {
    const apiId = selectedClarificationApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    Api.showSpinner(true, "Loading clarifications…");
    try {
      const pack = await Api.getClarifications(apiId);
      if (!pack) {
        toast("No saved clarifications for this RFP");
        return;
      }
      state.clarifications.pack = pack;
      state.clarifications.exportPreview = {
        subject: pack.email_subject,
        body: pack.email_body,
      };
      toast("Loaded clarification pack");
      render();
    } catch (err) {
      toast(err.message || "Load failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  function findCqCard(questionId) {
    return $$(".cq-question-card").find((el) => el.dataset.cqId === questionId) || null;
  }

  async function cqUpdate(questionId, action) {
    const apiId = selectedClarificationApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    const card = findCqCard(questionId);
    const question = card?.querySelector('[data-cq-field="question"]')?.value;
    const rationale = card?.querySelector('[data-cq-field="rationale"]')?.value;
    let update = {};
    if (action === "approve") update = { status: "approved", question, rationale };
    else if (action === "reject") update = { status: "rejected", question, rationale };
    else if (action === "reset") update = { status: "pending", question, rationale };
    else if (action === "save-edit") update = { status: "edited", question, rationale };
    else return;

    Api.showSpinner(true, "Updating question…");
    try {
      const pack = await Api.updateClarificationQuestion(apiId, questionId, update);
      state.clarifications.pack = pack;
      state.clarifications.exportPreview = {
        subject: pack.email_subject,
        body: pack.email_body,
      };
      toast(
        action === "approve"
          ? "Question approved"
          : action === "reject"
            ? "Question rejected"
            : action === "save-edit"
              ? "Edit saved"
              : "Reset to pending"
      );
      render();
    } catch (err) {
      toast(err.message || "Update failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function exportClarifications(format) {
    const apiId = selectedClarificationApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    Api.showSpinner(true, "Preparing export…");
    try {
      const exp = await Api.exportClarifications(apiId, format || "email", true);
      state.clarifications.exportPreview = { subject: exp.subject, body: exp.body };
      // Download file
      const text =
        format === "markdown"
          ? exp.body
          : `Subject: ${exp.subject}\n\n${exp.body}`;
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exp.filename_suggestion || "clarifications.txt";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Export downloaded");
      // refresh readonly fields if on page
      const sub = $("#cq-email-subject");
      const body = $("#cq-email-body");
      if (sub) sub.value = exp.subject || "";
      if (body) body.value = exp.body || "";
    } catch (err) {
      toast(err.message || "Export failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  function bindClarificationEvents() {
    if (state.page !== "clarifications") return;

    const sel = $("#cq-rfp-select");
    if (sel) {
      sel.addEventListener("change", () => {
        state.selectedRfpId = sel.value;
        state.clarifications.pack = null;
        state.clarifications.exportPreview = null;
        render();
        const opt = sel.selectedOptions && sel.selectedOptions[0];
        if (opt && opt.dataset.apiId) {
          Api.getClarifications(Number(opt.dataset.apiId))
            .then((pack) => {
              if (pack && state.page === "clarifications") {
                state.clarifications.pack = pack;
                state.clarifications.exportPreview = {
                  subject: pack.email_subject,
                  body: pack.email_body,
                };
                render();
              }
            })
            .catch(() => {});
        }
      });
    }

    $("#cq-extra")?.addEventListener("change", (e) => {
      state.clarifications.extraContext = e.target.value;
    });

    $("#btn-cq-generate")?.addEventListener("click", () => runClarificationGenerate());
    $("#btn-cq-load")?.addEventListener("click", () => loadClarifications());
    $("#btn-cq-export")?.addEventListener("click", () => exportClarifications("email"));
    $("#btn-cq-export-md")?.addEventListener("click", () => exportClarifications("markdown"));

    $("#cq-filter-cat")?.addEventListener("change", (e) => {
      state.clarifications.filterCategory = e.target.value;
      render();
    });
    $("#cq-filter-status")?.addEventListener("change", (e) => {
      state.clarifications.filterStatus = e.target.value;
      render();
    });

    $$("[data-cq-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        cqUpdate(btn.dataset.cqId, btn.dataset.cqAction);
      });
    });

    $("#btn-cq-copy-email")?.addEventListener("click", async () => {
      const sub = $("#cq-email-subject")?.value || "";
      const body = $("#cq-email-body")?.value || "";
      const text = `Subject: ${sub}\n\n${body}`;
      try {
        await navigator.clipboard.writeText(text);
        toast("Email document copied");
      } catch (_) {
        toast("Could not copy — select text manually");
      }
    });
  }

  // ---------- AI Win Theme Generator ----------
  function emptyWinThemePack(rfp) {
    return {
      rfp_id: rfp?.apiId || null,
      rfp_title: rfp?.title || "",
      customer: rfp?.buyer || "",
      win_themes: [1, 2, 3, 4, 5].map((n) => ({
        id: "theme-" + n,
        title: "",
        statement: "",
        proof_points: [],
        customer_benefit: "",
      })),
      customer_value_proposition: "",
      business_outcomes: [],
      innovation_story: "",
      digital_transformation_narrative: "",
      cost_optimization_story: "",
      ai_value_proposition: "",
      executive_messaging: "",
      differentiators: [],
      elevator_pitch: "",
      provider: "",
      generated_at: "",
      updated_at: null,
    };
  }

  function collectWinThemeInputs() {
    const keys = Object.keys(state.winThemes.inputs);
    const out = {};
    keys.forEach((k) => {
      const el = document.getElementById("wt-input-" + k);
      const v = el ? String(el.value || "").trim() : state.winThemes.inputs[k] || "";
      state.winThemes.inputs[k] = v;
      if (v) out[k] = v;
    });
    return out;
  }

  function collectWinThemeResultFromDom() {
    const base = state.winThemes.result || emptyWinThemePack(getRfp(state.selectedRfpId));
    const themes = [0, 1, 2, 3, 4].map((i) => {
      const prev = (base.win_themes || [])[i] || {};
      const title = $("#wt-theme-title-" + i)?.value ?? prev.title ?? "";
      const statement = $("#wt-theme-statement-" + i)?.value ?? prev.statement ?? "";
      const benefit = $("#wt-theme-benefit-" + i)?.value ?? prev.customer_benefit ?? "";
      const proofsRaw = $("#wt-theme-proofs-" + i)?.value ?? (prev.proof_points || []).join("\n");
      const proof_points = String(proofsRaw)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      return {
        id: prev.id || "theme-" + (i + 1),
        title: String(title).trim(),
        statement: String(statement).trim(),
        proof_points,
        customer_benefit: String(benefit).trim(),
      };
    });
    const listField = (id, fallback) => {
      const el = document.getElementById(id);
      if (!el) return fallback || [];
      return String(el.value || "")
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    };
    const textField = (id, fallback) => {
      const el = document.getElementById(id);
      return el ? String(el.value || "") : fallback || "";
    };
    return {
      ...base,
      win_themes: themes,
      customer_value_proposition: textField("wt-cvp", base.customer_value_proposition),
      business_outcomes: listField("wt-outcomes", base.business_outcomes),
      innovation_story: textField("wt-innovation", base.innovation_story),
      digital_transformation_narrative: textField("wt-digital", base.digital_transformation_narrative),
      cost_optimization_story: textField("wt-cost", base.cost_optimization_story),
      ai_value_proposition: textField("wt-ai", base.ai_value_proposition),
      executive_messaging: textField("wt-exec", base.executive_messaging),
      differentiators: listField("wt-diffs", base.differentiators),
      elevator_pitch: textField("wt-pitch", base.elevator_pitch),
    };
  }

  function renderWinThemesEditor(result) {
    if (!result) {
      return `
        <div class="card">
          <div class="card-body empty-state" style="padding:40px">
            <div class="fw-600 mb-8">No win themes yet</div>
            <div class="text-sm text-muted">Generate a pack to edit themes, narratives, and the elevator pitch.</div>
          </div>
        </div>`;
    }
    const themes = result.win_themes || [];
    const lines = (arr) => (arr || []).join("\n");

    return `
      <div class="wt-toolbar card mb-20">
        <div class="card-body flex-between flex-wrap gap-8">
          <div>
            <div class="fw-600">${escapeHtml(result.rfp_title || "Win themes")}</div>
            <div class="text-xs text-muted">
              ${escapeHtml(result.customer || "")}
              ${result.provider ? " · " + escapeHtml(result.provider) : ""}
              ${result.updated_at || result.generated_at ? " · " + escapeHtml(String(result.updated_at || result.generated_at).slice(0, 19).replace("T", " ")) : ""}
              ${state.winThemes.dirty ? " · <span class='wt-dirty'>Unsaved edits</span>" : ""}
            </div>
          </div>
          <div class="flex gap-8 flex-wrap">
            <button type="button" class="btn btn-sm btn-secondary" id="btn-wt-regen-all">${icon("spark")} Regenerate all</button>
            <button type="button" class="btn btn-sm btn-primary" id="btn-wt-save">Save themes</button>
          </div>
        </div>
      </div>

      <div class="card mb-20">
        <div class="card-header">
          <h3>5 Strategic Win Themes</h3>
          <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="win_themes">Regenerate themes</button>
        </div>
        <div class="card-body">
          <div class="wt-theme-grid">
            ${[0, 1, 2, 3, 4]
              .map((i) => {
                const t = themes[i] || { title: "", statement: "", proof_points: [], customer_benefit: "" };
                return `
                <div class="wt-theme-card">
                  <div class="wt-theme-num">Theme ${i + 1}</div>
                  <div class="form-group">
                    <label class="form-label" for="wt-theme-title-${i}">Title</label>
                    <input class="form-input" id="wt-theme-title-${i}" value="${escapeAttr(t.title || "")}" data-wt-edit />
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="wt-theme-statement-${i}">Statement</label>
                    <textarea class="form-input" id="wt-theme-statement-${i}" rows="4" data-wt-edit>${escapeHtml(t.statement || "")}</textarea>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="wt-theme-proofs-${i}">Proof points (one per line)</label>
                    <textarea class="form-input" id="wt-theme-proofs-${i}" rows="3" data-wt-edit>${escapeHtml(lines(t.proof_points))}</textarea>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="wt-theme-benefit-${i}">Customer benefit</label>
                    <textarea class="form-input" id="wt-theme-benefit-${i}" rows="2" data-wt-edit>${escapeHtml(t.customer_benefit || "")}</textarea>
                  </div>
                </div>`;
              })
              .join("")}
          </div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header">
            <h3>Customer Value Proposition</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="customer_value_proposition">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-cvp" rows="5" data-wt-edit>${escapeHtml(result.customer_value_proposition || "")}</textarea>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Business Outcomes</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="business_outcomes">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-outcomes" rows="5" data-wt-edit placeholder="One outcome per line">${escapeHtml(lines(result.business_outcomes))}</textarea>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header">
            <h3>Innovation Story</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="innovation_story">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-innovation" rows="5" data-wt-edit>${escapeHtml(result.innovation_story || "")}</textarea>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Digital Transformation Narrative</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="digital_transformation_narrative">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-digital" rows="5" data-wt-edit>${escapeHtml(result.digital_transformation_narrative || "")}</textarea>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header">
            <h3>Cost Optimization Story</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="cost_optimization_story">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-cost" rows="5" data-wt-edit>${escapeHtml(result.cost_optimization_story || "")}</textarea>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>AI Value Proposition</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="ai_value_proposition">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-ai" rows="5" data-wt-edit>${escapeHtml(result.ai_value_proposition || "")}</textarea>
          </div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header">
            <h3>Executive Messaging</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="executive_messaging">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-exec" rows="5" data-wt-edit>${escapeHtml(result.executive_messaging || "")}</textarea>
          </div>
        </div>
        <div class="card">
          <div class="card-header">
            <h3>Differentiators</h3>
            <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="differentiators">Regenerate</button>
          </div>
          <div class="card-body">
            <textarea class="form-input" id="wt-diffs" rows="5" data-wt-edit placeholder="One differentiator per line">${escapeHtml(lines(result.differentiators))}</textarea>
          </div>
        </div>
      </div>

      <div class="card mb-20">
        <div class="card-header">
          <h3>Elevator Pitch</h3>
          <button type="button" class="btn btn-sm btn-ghost" data-wt-regen="elevator_pitch">Regenerate</button>
        </div>
        <div class="card-body">
          <textarea class="form-input wt-pitch" id="wt-pitch" rows="4" data-wt-edit>${escapeHtml(result.elevator_pitch || "")}</textarea>
        </div>
      </div>
    `;
  }

  function renderWinThemes() {
    const rfps = APP_DATA.rfps || [];
    const selected = getRfp(state.selectedRfpId);
    const profile = getProfile();
    const inputs = state.winThemes.inputs || {};
    const result = state.winThemes.result;
    const err = state.winThemes.error;

    const inputFields = [
      { key: "customer_industry", label: "Customer industry", ph: "e.g. Healthcare providers, retail banking…" },
      { key: "business_challenges", label: "Business challenges", ph: "Pain points, drivers, constraints…" },
      { key: "rfp_scope", label: "RFP scope", ph: "Clarify SOW, in/out of scope, priorities…" },
      { key: "company_capabilities", label: "Company capabilities to emphasize", ph: "Differentiators beyond profile…" },
      { key: "competitor_landscape", label: "Competitor landscape", ph: "Incumbent, rivals, price pressure…" },
      { key: "extra_notes", label: "Extra capture notes", ph: "Hot buttons, politics, must-win themes…" },
    ];

    return `
      <div class="wt-page">
        <div class="alert alert-info mb-20">
          ${icon("spark")}
          <div>
            <strong>AI Win Theme Generator</strong> builds 5 strategic win themes plus value proposition,
            outcomes, innovation / digital / cost / AI narratives, executive messaging, differentiators, and an elevator pitch.
            Edit freely, regenerate any section, then save.
          </div>
        </div>

        <div class="grid-2-1 mb-20">
          <div class="card">
            <div class="card-header">
              <h3>Generation inputs</h3>
              <button type="button" class="btn btn-sm btn-secondary" data-nav="company">Company profile</button>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label" for="wt-rfp-select">RFP <span class="required-mark">*</span></label>
                <select class="form-select" id="wt-rfp-select">
                  ${
                    rfps.length
                      ? rfps
                          .map(
                            (r) =>
                              `<option value="${escapeAttr(r.id)}" data-api-id="${escapeAttr(r.apiId || "")}" ${
                                r.id === selected.id ? "selected" : ""
                              }>${escapeHtml(r.title)} (${escapeHtml(r.buyer || r.id)})</option>`
                          )
                          .join("")
                      : `<option value="">No RFPs — add one in RFP Search</option>`
                  }
                </select>
              </div>
              <div class="ba-profile-snapshot mb-16">
                <div class="fw-600 text-sm">Company snapshot</div>
                <div class="text-xs text-muted mt-4">
                  ${escapeHtml(profile.name || "No company name")} ·
                  ${(profile.servicesOffered || []).slice(0, 3).join(", ") || "No services"} ·
                  ${(profile.industryExpertise || []).slice(0, 2).join(", ") || "No industries"}
                </div>
              </div>
              <div class="ba-input-grid">
                ${inputFields
                  .map(
                    (f) => `
                  <div class="form-group">
                    <label class="form-label" for="wt-input-${f.key}">${escapeHtml(f.label)}</label>
                    <textarea class="form-input" id="wt-input-${f.key}" rows="2" placeholder="${escapeAttr(f.ph)}">${escapeHtml(
                      inputs[f.key] || ""
                    )}</textarea>
                  </div>`
                  )
                  .join("")}
              </div>
              ${
                err
                  ? `<div class="auth-error mt-16" id="wt-error">${escapeHtml(err)}</div>`
                  : `<div class="auth-error mt-16" id="wt-error" hidden></div>`
              }
              <div class="flex gap-8 mt-16 flex-wrap">
                <button type="button" class="btn btn-primary" id="btn-wt-generate" ${!rfps.length ? "disabled" : ""}>
                  ${icon("spark")} Generate win themes
                </button>
                <button type="button" class="btn btn-secondary" id="btn-wt-load" ${!selected.apiId ? "disabled" : ""}>Load saved</button>
                <button type="button" class="btn btn-ghost" id="btn-wt-clear">Clear editor</button>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>What you get</h3></div>
            <div class="card-body">
              <ul class="ba-list ba-criteria-legend">
                <li>5 Strategic Win Themes</li>
                <li>Customer Value Proposition</li>
                <li>Business Outcomes</li>
                <li>Innovation Story</li>
                <li>Digital Transformation Narrative</li>
                <li>Cost Optimization Story</li>
                <li>AI Value Proposition</li>
                <li>Executive Messaging</li>
                <li>Differentiators</li>
                <li>Elevator Pitch</li>
              </ul>
            </div>
          </div>
        </div>

        <div id="wt-editor">
          ${renderWinThemesEditor(result)}
        </div>
      </div>
    `;
  }

  function selectedWinThemeApiId() {
    const sel = $("#wt-rfp-select");
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
    if (opt && opt.dataset.apiId) return Number(opt.dataset.apiId);
    const rfp = getRfp(state.selectedRfpId);
    return rfp?.apiId ? Number(rfp.apiId) : null;
  }

  async function runWinThemeGenerate() {
    collectWinThemeInputs();
    const sel = $("#wt-rfp-select");
    if (sel?.value) state.selectedRfpId = sel.value;
    const apiId = selectedWinThemeApiId();
    const errEl = $("#wt-error");
    state.winThemes.error = null;
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }
    if (!apiId) {
      const msg = "This RFP is not saved on the API yet. Create/save it via RFP Search first.";
      state.winThemes.error = msg;
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
      toast(msg);
      return;
    }
    const btn = $("#btn-wt-generate");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Generating…";
    }
    Api.showSpinner(true, "AI is generating win themes…");
    try {
      const result = await Api.generateWinThemes(apiId, collectWinThemeInputs(), true);
      state.winThemes.result = result;
      state.winThemes.dirty = false;
      toast("Win themes generated");
      render();
    } catch (err) {
      console.error(err);
      const msg = err.message || "Win theme generation failed";
      state.winThemes.error = msg;
      toast(msg);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
    } finally {
      Api.showSpinner(false);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${icon("spark")} Generate win themes`;
      }
    }
  }

  async function runWinThemeRegenerate(section) {
    const apiId = selectedWinThemeApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    const existing = collectWinThemeResultFromDom();
    state.winThemes.result = existing;
    Api.showSpinner(true, section ? "Regenerating section…" : "Regenerating win themes…");
    try {
      const result = await Api.regenerateWinThemes(apiId, {
        inputs: collectWinThemeInputs(),
        section: section || null,
        existing,
        persist: true,
      });
      state.winThemes.result = result;
      state.winThemes.dirty = false;
      toast(section ? "Section regenerated" : "All win themes regenerated");
      render();
    } catch (err) {
      console.error(err);
      toast(err.message || "Regenerate failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function runWinThemeSave() {
    const apiId = selectedWinThemeApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    const content = collectWinThemeResultFromDom();
    content.rfp_id = apiId;
    Api.showSpinner(true, "Saving win themes…");
    try {
      const saved = await Api.saveWinThemes(apiId, content);
      state.winThemes.result = saved;
      state.winThemes.dirty = false;
      toast("Win themes saved");
      render();
    } catch (err) {
      console.error(err);
      toast(err.message || "Save failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function loadWinThemes() {
    const apiId = selectedWinThemeApiId();
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    Api.showSpinner(true, "Loading saved win themes…");
    try {
      const result = await Api.getWinThemes(apiId);
      if (!result) {
        toast("No saved win themes for this RFP");
        return;
      }
      state.winThemes.result = result;
      state.winThemes.dirty = false;
      if (result.inputs_snapshot) {
        Object.keys(state.winThemes.inputs).forEach((k) => {
          if (result.inputs_snapshot[k] != null) {
            state.winThemes.inputs[k] = result.inputs_snapshot[k] || "";
          }
        });
      }
      toast("Loaded saved win themes");
      render();
    } catch (err) {
      toast(err.message || "Load failed");
    } finally {
      Api.showSpinner(false);
    }
  }

  function bindWinThemeEvents() {
    if (state.page !== "win-themes") return;

    const sel = $("#wt-rfp-select");
    if (sel) {
      sel.addEventListener("change", () => {
        collectWinThemeInputs();
        if (state.winThemes.dirty && state.winThemes.result) {
          state.winThemes.result = collectWinThemeResultFromDom();
        }
        state.selectedRfpId = sel.value;
        state.winThemes.result = null;
        state.winThemes.dirty = false;
        render();
        // Auto-load saved pack if present
        const opt = sel.selectedOptions && sel.selectedOptions[0];
        if (opt && opt.dataset.apiId) {
          Api.getWinThemes(Number(opt.dataset.apiId))
            .then((result) => {
              if (result && state.page === "win-themes") {
                state.winThemes.result = result;
                state.winThemes.dirty = false;
                render();
              }
            })
            .catch(() => {});
        }
      });
    }

    $("#btn-wt-generate")?.addEventListener("click", () => runWinThemeGenerate());
    $("#btn-wt-load")?.addEventListener("click", () => loadWinThemes());
    $("#btn-wt-clear")?.addEventListener("click", () => {
      state.winThemes.result = null;
      state.winThemes.dirty = false;
      state.winThemes.error = null;
      render();
    });
    $("#btn-wt-save")?.addEventListener("click", () => runWinThemeSave());
    $("#btn-wt-regen-all")?.addEventListener("click", () => runWinThemeRegenerate(null));

    $$("[data-wt-regen]").forEach((btn) => {
      btn.addEventListener("click", () => runWinThemeRegenerate(btn.dataset.wtRegen));
    });

    $$("[data-wt-edit]").forEach((el) => {
      el.addEventListener("input", () => {
        state.winThemes.dirty = true;
        const dirty = document.querySelector(".wt-dirty");
        if (!dirty) {
          const meta = document.querySelector(".wt-toolbar .text-xs");
          if (meta && !meta.innerHTML.includes("Unsaved")) {
            meta.innerHTML += " · <span class='wt-dirty'>Unsaved edits</span>";
          }
        }
      });
    });

    Object.keys(state.winThemes.inputs).forEach((k) => {
      const el = document.getElementById("wt-input-" + k);
      if (el) {
        el.addEventListener("change", () => {
          state.winThemes.inputs[k] = el.value;
        });
      }
    });
  }

  // ---------- AI Bid / No-Bid Advisor ----------
  function bidRecClass(rec) {
    const r = String(rec || "").toLowerCase();
    if (r.includes("conditional")) return "conditional";
    if (r.includes("no")) return "no-bid";
    return "bid";
  }

  function collectBidAdvisorInputs() {
    const keys = Object.keys(state.bidAdvisor.inputs);
    const out = {};
    keys.forEach((k) => {
      const el = document.getElementById("ba-input-" + k);
      const v = el ? String(el.value || "").trim() : state.bidAdvisor.inputs[k] || "";
      state.bidAdvisor.inputs[k] = v;
      if (v) out[k] = v;
    });
    return out;
  }

  function renderBidRadarChart(criteria) {
    const items = (criteria || []).slice(0, 12);
    if (!items.length) {
      return `<div class="empty-state" style="padding:24px">Run evaluation to populate the radar chart.</div>`;
    }
    const n = items.length;
    const cx = 140;
    const cy = 140;
    const maxR = 100;
    const levels = [0.25, 0.5, 0.75, 1];
    const angle = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i, score) => {
      const a = angle(i);
      const r = (Math.max(0, Math.min(100, Number(score) || 0)) / 100) * maxR;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    const grid = levels
      .map((lv) => {
        const pts = Array.from({ length: n }, (_, i) => {
          const a = angle(i);
          const r = maxR * lv;
          return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
        }).join(" ");
        return `<polygon points="${pts}" fill="none" stroke="var(--gray-200)" stroke-width="1"/>`;
      })
      .join("");
    const axes = items
      .map((_, i) => {
        const [x, y] = pt(i, 100);
        return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="var(--gray-200)" stroke-width="1"/>`;
      })
      .join("");
    const poly = items
      .map((c, i) => pt(i, c.score).join(","))
      .join(" ");
    const labels = items
      .map((c, i) => {
        const [x, y] = pt(i, 118);
        const short = String(c.label || c.key || "")
          .replace(" (favorability)", "")
          .replace("Estimated ", "")
          .replace("Existing ", "")
          .replace("Required ", "");
        return `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle" class="ba-radar-label">${escapeHtml(short.slice(0, 18))}</text>`;
      })
      .join("");
    return `
      <div class="ba-radar-wrap">
        <svg viewBox="0 0 280 280" width="100%" max-height="300" class="ba-radar-svg" aria-label="Criterion radar chart">
          ${grid}${axes}
          <polygon points="${poly}" fill="rgba(37,99,235,0.22)" stroke="#2563eb" stroke-width="2"/>
          ${items
            .map((c, i) => {
              const [x, y] = pt(i, c.score);
              return `<circle cx="${x}" cy="${y}" r="3.5" fill="#2563eb"/>`;
            })
            .join("")}
          ${labels}
        </svg>
      </div>`;
  }

  function renderBidAdvisorResults(result) {
    if (!result) {
      return `
        <div class="card ba-empty-card">
          <div class="card-body empty-state" style="padding:40px">
            <div class="fw-600 mb-8">No evaluation yet</div>
            <div class="text-sm text-muted">Select an RFP, optionally add manager inputs, then run the AI Bid / No-Bid Advisor.</div>
          </div>
        </div>`;
    }
    const rec = result.recommendation || "—";
    const recCls = bidRecClass(rec);
    const score = Number(result.overall_score) || 0;
    const conf = result.confidence_level || "Medium";
    const confPct = Number(result.confidence_pct) || 70;
    const criteria = result.criteria || [];
    const chartRows = (result.chart_series || criteria.map((c) => ({ label: c.label, value: c.score }))).map(
      (p) => ({ label: p.label, value: Number(p.value) || 0 })
    );

    return `
      <div class="ba-decision-hero ba-rec-${recCls} mb-20">
        <div class="ba-decision-main">
          <div class="ba-decision-kicker">AI Bid / No-Bid recommendation</div>
          <div class="ba-decision-title">${escapeHtml(rec)}</div>
          <div class="ba-decision-sub">
            ${escapeHtml(result.rfp_title || "")}
            ${result.customer ? " · " + escapeHtml(result.customer) : ""}
          </div>
          <div class="ba-decision-meta">
            <span class="badge badge-blue">Score ${score}/100</span>
            <span class="badge badge-sky">Confidence ${escapeHtml(conf)} (${confPct}%)</span>
            <span class="badge badge-gray">Provider: ${escapeHtml(result.provider || "—")}</span>
            ${
              result.generated_at
                ? `<span class="text-xs text-muted">Generated ${escapeHtml(String(result.generated_at).slice(0, 19).replace("T", " "))} UTC</span>`
                : ""
            }
          </div>
        </div>
        <div class="ba-decision-gauge">
          ${renderSparkGauge(score)}
          <div class="text-center text-xs text-muted mt-8">Overall favorability</div>
        </div>
      </div>

      ${(result.conditions || []).length
        ? `<div class="alert alert-warning mb-20">
            <div>
              <strong>Conditions for Conditional Bid</strong>
              <ul class="ba-list mt-8">${result.conditions.map((c) => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
            </div>
          </div>`
        : ""}

      <div class="card mb-20">
        <div class="card-header"><h3>Executive Summary</h3></div>
        <div class="card-body">
          <div class="ba-exec-summary">${escapeHtml(result.executive_summary || "—").replace(/\n/g, "<br/>")}</div>
        </div>
      </div>

      <div class="grid-2 mb-20">
        <div class="card">
          <div class="card-header"><h3>Top 5 Strengths</h3></div>
          <div class="card-body">
            <ol class="ba-ranked-list ba-strengths">
              ${(result.top_strengths || []).length
                ? result.top_strengths.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
                : "<li class='text-muted'>None listed</li>"}
            </ol>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Top 5 Risks</h3></div>
          <div class="card-body">
            <ol class="ba-ranked-list ba-risks">
              ${(result.top_risks || []).length
                ? result.top_risks.map((s) => `<li>${escapeHtml(s)}</li>`).join("")
                : "<li class='text-muted'>None listed</li>"}
            </ol>
          </div>
        </div>
      </div>

      <div class="card mb-20">
        <div class="card-header"><h3>Mitigation Recommendations</h3></div>
        <div class="card-body">
          <ul class="ba-list">
            ${(result.mitigation_recommendations || []).length
              ? result.mitigation_recommendations.map((m) => `<li>${escapeHtml(m)}</li>`).join("")
              : "<li class='text-muted'>None listed</li>"}
          </ul>
        </div>
      </div>

      <div class="grid-2-1 mb-20">
        <div class="card">
          <div class="card-header">
            <h3>Criterion scorecards</h3>
            <span class="badge badge-blue">${criteria.length} factors</span>
          </div>
          <div class="card-body">
            <div class="ba-scorecard-grid">
              ${criteria
                .map((c) => {
                  const s = Number(c.score) || 0;
                  const cls = scoreClass(s);
                  return `
                  <div class="ba-scorecard ba-score-${cls}">
                    <div class="ba-scorecard-top">
                      <div class="ba-scorecard-label">${escapeHtml(c.label || c.key)}</div>
                      <div class="ba-scorecard-score score-pill score-${cls}"><span class="score-dot"></span>${s}</div>
                    </div>
                    <div class="mini-score-bar mt-8">
                      <div class="mini-score-fill score-fill-${cls}" style="width:${s}%"></div>
                    </div>
                    <div class="ba-scorecard-rationale text-xs text-muted mt-8">${escapeHtml(c.rationale || "—")}</div>
                  </div>`;
                })
                .join("")}
            </div>
          </div>
        </div>
        <div>
          <div class="card mb-20">
            <div class="card-header"><h3>Decision radar</h3></div>
            <div class="card-body">${renderBidRadarChart(criteria)}</div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Score distribution</h3></div>
            <div class="card-body">${renderHBarChart(chartRows, { color: "primary" })}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderBidAdvisor() {
    const rfps = APP_DATA.rfps || [];
    const selected = getRfp(state.selectedRfpId);
    const profile = getProfile();
    const inputs = state.bidAdvisor.inputs || {};
    const result = state.bidAdvisor.result;
    const err = state.bidAdvisor.error;

    const inputFields = [
      { key: "available_resources", label: "Available resources", ph: "SMEs, delivery capacity, partners, bandwidth…" },
      { key: "revenue_target", label: "Revenue / margin target", ph: "e.g. $2M TCV, 18%+ margin, strategic logo" },
      { key: "customer_profile", label: "Customer profile / relationship", ph: "Existing account? Incumbent? Buying style…" },
      { key: "past_projects", label: "Past projects (extra context)", ph: "Relevant wins not fully listed on profile…" },
      { key: "geographic_notes", label: "Geographic presence notes", ph: "Local entity, delivery hubs, travel constraints…" },
      { key: "certification_notes", label: "Certifications notes", ph: "Gaps, in-progress audits, partner certs…" },
      { key: "competition_notes", label: "Competition level", ph: "Known competitors, incumbent, price pressure…" },
      { key: "strategic_notes", label: "Strategic importance", ph: "Why this deal matters to the portfolio…" },
    ];

    return `
      <div class="ba-page">
        <div class="alert alert-info mb-20">
          ${icon("spark")}
          <div>
            <strong>AI Bid / No-Bid Advisor</strong> evaluates fit across capability, industry, technology,
            geography, certifications, delivery risk, profitability, strategy, competition, relationship,
            resources, and timeline — then returns a leadership-ready recommendation.
          </div>
        </div>

        <div class="grid-2-1 mb-20">
          <div class="card">
            <div class="card-header">
              <h3>Evaluation inputs</h3>
              <button type="button" class="btn btn-sm btn-secondary" data-nav="company">Edit company profile</button>
            </div>
            <div class="card-body">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label" for="ba-rfp-select">RFP <span class="required-mark">*</span></label>
                  <select class="form-select" id="ba-rfp-select">
                    ${
                      rfps.length
                        ? rfps
                            .map(
                              (r) =>
                                `<option value="${escapeAttr(r.id)}" data-api-id="${escapeAttr(r.apiId || "")}" ${
                                  r.id === selected.id ? "selected" : ""
                                }>${escapeHtml(r.title)} (${escapeHtml(r.buyer || r.id)})</option>`
                            )
                            .join("")
                        : `<option value="">No RFPs — add one in RFP Search</option>`
                    }
                  </select>
                  <p class="form-hint">Uses RFP details from your pipeline. RFP must be saved to the API.</p>
                </div>
                <div class="form-group">
                  <label class="form-label">Company profile snapshot</label>
                  <div class="ba-profile-snapshot">
                    <div class="fw-600">${escapeHtml(profile.name || "No company name")}</div>
                    <div class="text-xs text-muted mt-4">
                      ${(profile.countriesServed || []).slice(0, 4).join(", ") || "No countries"} ·
                      ${(profile.servicesOffered || []).slice(0, 3).join(", ") || "No services"} ·
                      ${(profile.certifications || []).slice(0, 3).join(", ") || "No certs"}
                    </div>
                    <div class="text-xs text-muted mt-4">
                      Case studies: ${(profile.caseStudies || []).filter((c) => c.client).length || 0} on profile
                    </div>
                  </div>
                </div>
              </div>

              <div class="ba-input-grid">
                ${inputFields
                  .map(
                    (f) => `
                  <div class="form-group">
                    <label class="form-label" for="ba-input-${f.key}">${escapeHtml(f.label)}</label>
                    <textarea class="form-input" id="ba-input-${f.key}" rows="2" placeholder="${escapeAttr(f.ph)}">${escapeHtml(
                      inputs[f.key] || ""
                    )}</textarea>
                  </div>`
                  )
                  .join("")}
              </div>

              ${
                err
                  ? `<div class="auth-error mt-16" id="ba-error">${escapeHtml(err)}</div>`
                  : `<div class="auth-error mt-16" id="ba-error" hidden></div>`
              }

              <div class="flex gap-8 mt-16 flex-wrap">
                <button type="button" class="btn btn-primary" id="btn-ba-run" ${!rfps.length ? "disabled" : ""}>
                  ${icon("spark")} Run Bid / No-Bid analysis
                </button>
                <button type="button" class="btn btn-secondary" id="btn-ba-load-latest" ${!selected.apiId ? "disabled" : ""}>
                  Load last result
                </button>
                <button type="button" class="btn btn-ghost" id="btn-ba-clear">Clear results</button>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header"><h3>What is evaluated</h3></div>
            <div class="card-body">
              <ul class="ba-list ba-criteria-legend">
                <li>Capability Match</li>
                <li>Industry Experience</li>
                <li>Technology Match</li>
                <li>Geographic Coverage</li>
                <li>Required Certifications</li>
                <li>Delivery Risk</li>
                <li>Estimated Profitability</li>
                <li>Strategic Importance</li>
                <li>Competition Level</li>
                <li>Existing Customer Relationship</li>
                <li>Resource Availability</li>
                <li>Submission Timeline</li>
              </ul>
              <p class="text-xs text-muted mt-16">
                Powered by the server AI provider (OpenAI when configured). Results are stored on the RFP for revisit.
              </p>
            </div>
          </div>
        </div>

        <div id="ba-results">
          ${renderBidAdvisorResults(result)}
        </div>
      </div>
    `;
  }

  async function runBidAdvisor() {
    collectBidAdvisorInputs();
    const sel = $("#ba-rfp-select");
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
    const rfpId = sel ? sel.value : state.selectedRfpId;
    const apiId = opt && opt.dataset.apiId ? Number(opt.dataset.apiId) : (getRfp(rfpId).apiId || null);
    if (rfpId) state.selectedRfpId = rfpId;

    const errEl = $("#ba-error");
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = "";
    }
    state.bidAdvisor.error = null;

    if (!apiId) {
      const msg = "This RFP is not saved on the API yet. Create/save it via RFP Search first.";
      state.bidAdvisor.error = msg;
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
      toast(msg);
      return;
    }

    const btn = $("#btn-ba-run");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Analyzing…";
    }
    state.bidAdvisor.loading = true;
    Api.showSpinner(true, "AI Bid / No-Bid Advisor is evaluating…");
    try {
      const result = await Api.evaluateBidAdvisor(apiId, collectBidAdvisorInputs(), true);
      state.bidAdvisor.result = result;
      // Reflect recommendation into local RFP cache for opportunity views
      const rfp = getRfp(rfpId);
      if (rfp && rfp.id) {
        rfp.matchScore = result.overall_score != null ? result.overall_score : rfp.matchScore;
        rfp.aiInsights = rfp.aiInsights || [];
        rfp.aiInsights.unshift(
          `[Bid Advisor] ${result.recommendation} · ${result.overall_score}/100 · ${result.confidence_level}`
        );
        rfp.aiInsights = rfp.aiInsights.slice(0, 20);
        persistRfps();
      }
      toast(`${result.recommendation} · score ${result.overall_score}/100`);
      render();
    } catch (err) {
      console.error(err);
      const msg = err.message || "Bid/No-Bid evaluation failed";
      state.bidAdvisor.error = msg;
      toast(msg);
      if (errEl) {
        errEl.hidden = false;
        errEl.textContent = msg;
      }
    } finally {
      state.bidAdvisor.loading = false;
      Api.showSpinner(false);
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${icon("spark")} Run Bid / No-Bid analysis`;
      }
    }
  }

  async function loadLatestBidAdvisor() {
    const sel = $("#ba-rfp-select");
    const opt = sel && sel.selectedOptions && sel.selectedOptions[0];
    const apiId = opt && opt.dataset.apiId ? Number(opt.dataset.apiId) : null;
    if (!apiId) {
      toast("Select an API-saved RFP first");
      return;
    }
    Api.showSpinner(true, "Loading last Bid/No-Bid result…");
    try {
      const result = await Api.getBidAdvisor(apiId);
      if (!result) {
        toast("No previous evaluation stored for this RFP");
        return;
      }
      state.bidAdvisor.result = result;
      toast("Loaded last Bid/No-Bid evaluation");
      render();
    } catch (err) {
      toast(err.message || "Failed to load evaluation");
    } finally {
      Api.showSpinner(false);
    }
  }

  function bindBidAdvisorEvents() {
    if (state.page !== "bid-advisor") return;

    const sel = $("#ba-rfp-select");
    if (sel) {
      sel.addEventListener("change", () => {
        collectBidAdvisorInputs();
        state.selectedRfpId = sel.value;
        state.bidAdvisor.result = null;
        render();
      });
    }

    $("#btn-ba-run")?.addEventListener("click", () => runBidAdvisor());
    $("#btn-ba-load-latest")?.addEventListener("click", () => loadLatestBidAdvisor());
    $("#btn-ba-clear")?.addEventListener("click", () => {
      state.bidAdvisor.result = null;
      state.bidAdvisor.error = null;
      render();
    });

    // Persist textarea edits into state without re-render
    Object.keys(state.bidAdvisor.inputs).forEach((k) => {
      const el = document.getElementById("ba-input-" + k);
      if (el) {
        el.addEventListener("change", () => {
          state.bidAdvisor.inputs[k] = el.value;
        });
      }
    });
  }

  // ---------- Go/No-Go interactions ----------
  function collectGoNoGoFromDom(rfp) {
    const gng = getGoNoGo(rfp);
    $$(".gonogo-score-btn.active").forEach((btn) => {
      const id = btn.dataset.criterion;
      const score = Number(btn.dataset.score);
      if (id && score) gng.scores[id] = score;
    });
    // Also read all score groups in case none active (shouldn't happen)
    GONOGO_CRITERIA.forEach((c) => {
      const active = $(`.gonogo-score-btn.active[data-criterion="${c.id}"]`);
      if (active) gng.scores[c.id] = Number(active.dataset.score);
      const note = $(`[data-note-for="${c.id}"]`);
      if (note) gng.notes[c.id] = note.value;
    });
    const finalEl = $("#gonogo-final");
    const approverEl = $("#gonogo-approver");
    const rationaleEl = $("#gonogo-rationale");
    const conditionsEl = $("#gonogo-conditions");
    if (finalEl) gng.finalDecision = finalEl.value;
    if (approverEl) gng.approver = approverEl.value;
    if (rationaleEl) gng.rationale = rationaleEl.value;
    if (conditionsEl) gng.conditions = conditionsEl.value;
    return gng;
  }

  function bindAiAnalyzeEvents() {
    if (state.page !== "opportunity") return;
    const btn = $("#btn-ai-analyze");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const rfp = getRfp(state.selectedRfpId);
      if (!rfp?.apiId) {
        toast("Save this RFP to the API first, then run OpenAI analysis.");
        return;
      }
      if (typeof Api === "undefined" || !Api.getToken()) {
        toast("You must be logged in to run AI analysis.");
        return;
      }
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Analyzing with OpenAI…";
      Api.showSpinner(true, "OpenAI is analyzing this RFP…");
      try {
        const result = await Api.analyzeRfp(rfp.apiId);
        const score = Number(result.match_score);
        if (!Number.isNaN(score)) rfp.matchScore = score;
        const line = [
          result.recommendation || "—",
          "risk " + (result.risk || "—"),
          result.summary || "",
        ]
          .filter(Boolean)
          .join(" · ");
        rfp.aiInsights = rfp.aiInsights || [];
        rfp.aiInsights.unshift("[OpenAI] " + line);
        rfp.aiInsights = rfp.aiInsights.slice(0, 20);
        persistRfps();
        toast(
          "OpenAI: " +
            (result.recommendation || "done") +
            (Number.isNaN(score) ? "" : " · score " + score)
        );
        render();
      } catch (err) {
        console.error(err);
        toast(err.message || "OpenAI analysis failed");
      } finally {
        Api.showSpinner(false);
        btn.disabled = false;
        btn.textContent = prev || "Run OpenAI analysis";
      }
    });
  }

  function bindGoNoGoEvents() {
    if (state.page !== "opportunity") return;
    const rfp = getRfp(state.selectedRfpId);
    if (!rfp?.id) return;

    $$(".gonogo-score-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const criterion = btn.dataset.criterion;
        const score = Number(btn.dataset.score);
        const gng = getGoNoGo(rfp);
        gng.scores[criterion] = score;
        $$(`.gonogo-score-btn[data-criterion="${criterion}"]`).forEach((b) => {
          b.classList.toggle("active", Number(b.dataset.score) === score);
        });
        // Live update header badge via soft re-render of meter only is hard; re-render full page
        // but preserve scroll — save draft silently and re-render
        $$("[data-note-for]").forEach((ta) => {
          gng.notes[ta.dataset.noteFor] = ta.value;
        });
        const scrollY = window.scrollY;
        persistRfps();
        render();
        window.scrollTo(0, scrollY);
      });
    });

    $$("[data-note-for]").forEach((ta) => {
      ta.addEventListener("change", () => {
        const gng = getGoNoGo(rfp);
        gng.notes[ta.dataset.noteFor] = ta.value;
        persistRfps();
      });
    });

    const saveDraft = $("#btn-gonogo-save-draft");
    if (saveDraft) {
      saveDraft.addEventListener("click", () => {
        collectGoNoGoFromDom(rfp);
        // Don't force formal decision on draft
        persistRfps();
        toast("Go/No-Go scores saved as draft");
        const scrollY = window.scrollY;
        render();
        window.scrollTo(0, scrollY);
      });
    }

    const submit = $("#btn-gonogo-submit");
    if (submit) {
      submit.addEventListener("click", () => {
        const gng = collectGoNoGoFromDom(rfp);
        const err = $("#gonogo-error");
        const showErr = (msg) => {
          if (err) {
            err.hidden = false;
            err.textContent = msg;
          }
        };
        if (err) {
          err.hidden = true;
          err.textContent = "";
        }

        if (!gng.finalDecision || gng.finalDecision === "Pending") {
          showErr("Select a final decision: Go, Conditional Go, or No-Go.");
          return;
        }
        if (!gng.approver?.trim()) {
          showErr("Select an approver before recording the decision.");
          return;
        }
        if (!gng.rationale?.trim() || gng.rationale.trim().length < 10) {
          showErr("Enter a decision rationale (at least a short paragraph).");
          return;
        }
        if (gng.finalDecision === "Conditional Go" && !gng.conditions?.trim()) {
          showErr("Conditional Go requires conditions to be listed.");
          return;
        }

        const { score100 } = calcGoNoGoWeighted(gng);
        const user = typeof Auth !== "undefined" ? Auth.currentUser() : null;
        const now = new Date().toISOString();
        gng.decidedBy = user?.name || "User";
        gng.decidedAt = now;
        gng.history = gng.history || [];
        gng.history.push({
          at: now,
          decision: gng.finalDecision,
          score100,
          approver: gng.approver,
          decidedBy: gng.decidedBy,
          rationale: gng.rationale,
          conditions: gng.conditions,
        });

        // Update opportunity status
        if (gng.finalDecision === "Go") rfp.status = "Proposal";
        else if (gng.finalDecision === "Conditional Go") rfp.status = "Qualifying";
        else if (gng.finalDecision === "No-Go") rfp.status = "No-Go";

        rfp.goNoGo = gng;
        persistRfps();
        toast(`Formal decision recorded: ${gng.finalDecision} (${score100}/100)`);
        render();
        const el = document.getElementById("gonogo");
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }

    const reset = $("#btn-gonogo-reset");
    if (reset) {
      reset.addEventListener("click", () => {
        if (!confirm("Reset go/no-go scores to defaults? History of formal decisions is kept.")) return;
        const prevHistory = (rfp.goNoGo && rfp.goNoGo.history) || [];
        rfp.goNoGo = defaultGoNoGo(rfp);
        rfp.goNoGo.history = prevHistory;
        persistRfps();
        toast("Scores reset");
        render();
        document.getElementById("gonogo")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  // ---------- Proposal workspace interactions ----------
  function captureActiveEditor() {
    const editor = $("#proposal-editor");
    const sec = getActiveProposalSection();
    if (editor && sec) {
      sec.content = editor.innerHTML;
      // Auto-derive status unless user manually marked complete and content remains
      const derived = deriveSectionStatus(sec.content);
      if (sec.status !== "done" || derived === "todo") {
        sec.status = derived;
      }
    }
  }

  function switchProposalSection(id) {
    captureActiveEditor();
    state.proposal.activeId = id;
    state.proposal.dirty = true;
    render();
    const editor = $("#proposal-editor");
    if (editor) editor.focus();
  }

  function applyRteCommand(cmd) {
    const editor = $("#proposal-editor");
    if (!editor) return;
    editor.focus();
    if (cmd === "createLink") {
      const url = prompt("Enter URL:", "https://");
      if (url) document.execCommand("createLink", false, url);
      return;
    }
    if (cmd.startsWith("formatBlock:")) {
      const tag = cmd.split(":")[1];
      document.execCommand("formatBlock", false, tag);
      return;
    }
    document.execCommand(cmd, false, null);
    captureActiveEditor();
    state.proposal.dirty = true;
    const wc = $("#active-word-count");
    if (wc) wc.textContent = `${countWordsFromHtml(editor.innerHTML)} words`;
  }

  function insertAiAssist() {
    const editor = $("#proposal-editor");
    const sec = getActiveProposalSection();
    if (!editor || !sec) return;
    const r = getRfp(state.selectedRfpId);
    const company = getProfile();
    const snippets = {
      "executive-summary": `<p><strong>${escapeHtml(company.name || "Our team")}</strong> is pleased to submit this response for <em>${escapeHtml(r.title)}</em> issued by ${escapeHtml(r.buyer)}.</p><p>We bring proven ${escapeHtml(r.type)} capability, a quantified value proposition, and a low-risk delivery model aligned to your deadline of ${formatDate(r.deadline)}.</p>`,
      "win-themes": `<ol><li><strong>Domain fit</strong> — deep ${escapeHtml(r.industry)} experience.</li><li><strong>Delivery certainty</strong> — named leadership and clear SLAs.</li><li><strong>Commercial transparency</strong> — explicit assumptions and options.</li><li><strong>Risk control</strong> — transition plan and compliance coverage.</li></ol>`,
      "solution-overview": `<p>Our solution for ${escapeHtml(r.buyer)} addresses the core scope of <strong>${escapeHtml(r.type)}</strong> with a modular architecture, measurable outcomes, and integration into existing operating models.</p><ul><li>Discovery &amp; baselining</li><li>Design &amp; build</li><li>Operate &amp; optimize</li></ul>`,
      "delivery-model": `<p>We propose a hybrid delivery model combining onshore client engagement with scalable delivery hubs, governed through weekly service reviews and monthly executive steering.</p>`,
      "governance": `<p>Governance includes a RACI matrix, SLA scorecard, risk register, and change control board. Escalation paths are defined to the engagement manager and executive sponsor within agreed SLAs.</p>`,
      "pricing-assumptions": `<p>Pricing for this opportunity (estimated ${escapeHtml(r.value)}) assumes the scope described in the RFP, steady-state volumes, and standard commercial terms unless otherwise noted in clarifications.</p>`,
      "risks": `<ul><li><strong>Scope ambiguity</strong> — resolve via clarifications before final pricing.</li><li><strong>Transition risk</strong> — dual-run period with incumbent where applicable.</li><li><strong>Resource ramp</strong> — pre-identified bench and surge plan.</li></ul>`,
      clarifications: `<ol><li>Please confirm mandatory vs. desirable evaluation criteria weighting.</li><li>Please confirm accepted formats for the final submission package.</li><li>Please confirm any data residency or clearance constraints not stated in the RFP body.</li></ol>`,
    };
    const block =
      snippets[sec.id] ||
      `<p>AI-assisted draft for <strong>${escapeHtml(sec.title)}</strong> related to ${escapeHtml(r.title)}. Please refine with client-specific evidence and proof points.</p>`;
    if (editor.innerHTML.trim()) {
      editor.innerHTML = editor.innerHTML + block;
    } else {
      editor.innerHTML = block;
    }
    captureActiveEditor();
    state.proposal.dirty = true;
    toast(`AI content added to ${sec.title}`);
    const wc = $("#active-word-count");
    if (wc) wc.textContent = `${countWordsFromHtml(editor.innerHTML)} words`;
  }

  function bindProposalEvents() {
    if (state.page !== "proposal") return;

    const propRfp = $("#proposal-rfp");
    if (propRfp) {
      propRfp.addEventListener("change", () => {
        captureActiveEditor();
        persistProposalWorkspace();
        state.selectedRfpId = propRfp.value;
        render();
      });
    }

    $$("[data-proposal-section]").forEach((btn) => {
      btn.addEventListener("click", () => switchProposalSection(btn.dataset.proposalSection));
    });

    const editor = $("#proposal-editor");
    if (editor) {
      editor.addEventListener("input", () => {
        state.proposal.dirty = true;
        const wc = $("#active-word-count");
        if (wc) wc.textContent = `${countWordsFromHtml(editor.innerHTML)} words`;
      });
      // Placeholder handling via class
      const syncEmpty = () => {
        editor.classList.toggle("is-empty", !editor.textContent.trim());
      };
      syncEmpty();
      editor.addEventListener("input", syncEmpty);
    }

    $$("[data-rte-cmd]").forEach((btn) => {
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // keep selection in editor
        applyRteCommand(btn.dataset.rteCmd);
      });
    });

    const aiBtn = $("[data-rte-ai]");
    if (aiBtn) {
      aiBtn.addEventListener("mousedown", (e) => {
        e.preventDefault();
        insertAiAssist();
      });
    }

    const ownerSel = $("#proposal-owner");
    if (ownerSel) {
      ownerSel.addEventListener("change", () => {
        const sec = getActiveProposalSection();
        if (sec) {
          sec.owner = ownerSel.value;
          state.proposal.dirty = true;
        }
      });
    }
    const statusSel = $("#proposal-status");
    if (statusSel) {
      statusSel.addEventListener("change", () => {
        const sec = getActiveProposalSection();
        if (sec) {
          sec.status = statusSel.value;
          state.proposal.dirty = true;
        }
      });
    }

    const saveSection = () => {
      captureActiveEditor();
      persistProposalWorkspace();
      toast(`Saved “${getActiveProposalSection()?.title || "section"}”`);
      render();
    };
    const btnSaveSection = $("#btn-save-section");
    if (btnSaveSection) btnSaveSection.addEventListener("click", saveSection);
    const btnSaveProposal = $("#btn-save-proposal");
    if (btnSaveProposal) btnSaveProposal.addEventListener("click", saveSection);

    const sections = getProposalSections();
    const idx = sections.findIndex((s) => s.id === state.proposal.activeId);
    const prev = $("#btn-prev-section");
    if (prev) {
      prev.disabled = idx <= 0;
      prev.addEventListener("click", () => {
        if (idx > 0) switchProposalSection(sections[idx - 1].id);
      });
    }
    const next = $("#btn-next-section");
    if (next) {
      next.disabled = idx >= sections.length - 1;
      next.addEventListener("click", () => {
        if (idx < sections.length - 1) switchProposalSection(sections[idx + 1].id);
      });
    }

    const bindExport = (sel, format) => {
      const el = $(sel);
      if (el) el.addEventListener("click", () => exportProposalDocument(format));
    };
    bindExport("#btn-export-word", "word");
    bindExport("#btn-export-word-side", "word");
    bindExport("#btn-export-html", "html");
    bindExport("#btn-export-txt", "txt");

    const btnReview = $("#btn-submit-review");
    if (btnReview) {
      btnReview.addEventListener("click", () => {
        captureActiveEditor();
        persistProposalWorkspace();
        toast("Proposal submitted for bid committee review");
      });
    }

    const btnReset = $("#btn-reset-proposal");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (!confirm("Reset all proposal sections to default sample content?")) return;
        localStorage.removeItem(PROPOSAL_STORAGE_KEY);
        state.proposal.sections = defaultProposalSections();
        state.proposal.activeId = "executive-summary";
        state.proposal.dirty = false;
        state.proposal.lastSaved = null;
        persistProposalWorkspace();
        toast("Proposal workspace reset");
        render();
      });
    }
  }

  // ---------- Compliance matrix interactions ----------
  function updateComplianceField(id, field, value) {
    const rows = getComplianceRows();
    const row = rows.find((r) => String(r.id) === String(id));
    if (!row) return;
    row[field] = value;
    persistComplianceRows();
  }

  function handleRfpFile(file) {
    if (!file) return;
    const name = file.name || "document";
    const ext = name.split(".").pop().toLowerCase();
    const allowed = ["pdf", "doc", "docx", "txt", "md", "rtf"];
    if (!allowed.includes(ext)) {
      toast("Please upload a PDF, Word, or text document");
      return;
    }

    state.compliance.extracting = true;
    state.compliance.uploadedFile = {
      name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      requirementCount: null,
    };
    render();

    const finish = (rows) => {
      state.compliance.rows = rows;
      state.compliance.uploadedFile = {
        name,
        size: file.size,
        uploadedAt: new Date().toISOString(),
        requirementCount: rows.length,
      };
      state.compliance.extracting = false;
      persistComplianceRows();
      toast(`Extracted ${rows.length} requirements from ${name}`);
      render();
    };

    // Text-like files: real parse. Binary office/PDF: simulate extraction from opportunity.
    if (ext === "txt" || ext === "md" || ext === "rtf") {
      const reader = new FileReader();
      reader.onload = () => {
        const rows = extractRequirementsFromText(String(reader.result || ""), name);
        finish(rows);
      };
      reader.onerror = () => {
        state.compliance.extracting = false;
        toast("Could not read that file");
        render();
      };
      reader.readAsText(file);
      return;
    }

    // PDF / DOC / DOCX — simulate AI extraction (browser cannot parse without libraries)
    setTimeout(() => {
      const rfp = getRfp(state.selectedRfpId);
      const reqs = rfp.requirements?.length
        ? rfp.requirements
        : defaultComplianceRows().map((x) => x.requirement);
      // Enrich with a few common compliance items
      const extra = [
        "Vendor shall maintain required insurance for the contract term",
        "All staff with system access must complete background checks",
        "Proposal must include a detailed project plan and staffing matrix",
      ];
      const combined = [...reqs, ...extra];
      const rows = buildRowsFromRequirements(combined, {
        source: name,
        pageStart: 8,
      });
      finish(rows);
    }, 1100);
  }

  function bindComplianceEvents() {
    if (state.page !== "compliance") return;

    const compRfp = $("#compliance-rfp");
    if (compRfp) {
      compRfp.addEventListener("change", () => {
        state.selectedRfpId = compRfp.value;
        render();
      });
    }

    const fileInput = $("#rfp-file-input");
    const dropzone = $("#rfp-dropzone");
    const browseBtn = $("#btn-browse-rfp");

    const openPicker = () => {
      if (state.compliance.extracting) return;
      fileInput?.click();
    };

    if (browseBtn) browseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      openPicker();
    });
    if (dropzone) {
      dropzone.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        openPicker();
      });
      dropzone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openPicker();
        }
      });
      dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
      dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("dragover");
        const file = e.dataTransfer?.files?.[0];
        if (file) handleRfpFile(file);
      });
    }
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files?.[0];
        if (file) handleRfpFile(file);
        fileInput.value = "";
      });
    }

    const clearUpload = $("#btn-clear-upload");
    if (clearUpload) {
      clearUpload.addEventListener("click", () => {
        state.compliance.uploadedFile = null;
        persistComplianceRows();
        toast("Uploaded file reference cleared (matrix rows kept)");
        render();
      });
    }

    $$(".matrix-input").forEach((el) => {
      const apply = () => {
        updateComplianceField(el.dataset.id, el.dataset.field, el.value);
        if (el.dataset.field === "responseStatus") {
          el.className = `form-select matrix-input matrix-status ${responseClass(el.value)}`;
        }
        if (el.dataset.field === "dueDate") {
          const overdue =
            el.value && daysUntil(el.value) < 0;
          el.classList.toggle("input-overdue", !!overdue);
        }
      };
      el.addEventListener("change", apply);
      if (el.tagName === "TEXTAREA" || el.type === "text" || el.type === "date") {
        el.addEventListener("blur", apply);
      }
    });

    $$("[data-delete-row]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.deleteRow;
        state.compliance.rows = getComplianceRows().filter((r) => String(r.id) !== String(id));
        persistComplianceRows();
        toast("Requirement removed");
        render();
      });
    });

    const addReq = $("#btn-add-req");
    if (addReq) {
      addReq.addEventListener("click", () => {
        const rows = getComplianceRows();
        rows.push(
          normalizeComplianceRow(
            {
              id: nextComplianceId(),
              requirement: "",
              pageNumber: "",
              responseStatus: "Not Started",
              assignedOwner: "Unassigned",
              dueDate: "",
              comments: "",
            },
            rows.length
          )
        );
        persistComplianceRows();
        render();
        const last = $$(".matrix-req").pop();
        if (last) last.focus();
      });
    }

    const resetMatrix = $("#btn-reset-matrix");
    if (resetMatrix) {
      resetMatrix.addEventListener("click", () => {
        if (!confirm("Reset compliance matrix to the default sample requirements?")) return;
        localStorage.removeItem(COMPLIANCE_STORAGE_KEY);
        state.compliance.rows = defaultComplianceRows();
        state.compliance.uploadedFile = null;
        persistComplianceRows();
        toast("Matrix reset to defaults");
        render();
      });
    }

    const exportBtns = ["#btn-export-excel", "#btn-export-excel-footer"];
    exportBtns.forEach((sel) => {
      const btn = $(sel);
      if (btn) btn.addEventListener("click", exportComplianceToExcel);
    });

    const filterStatus = $("#matrix-filter-status");
    if (filterStatus) {
      filterStatus.addEventListener("change", () => {
        state.compliance.filterStatus = filterStatus.value;
        render();
      });
    }
    const filterOwner = $("#matrix-filter-owner");
    if (filterOwner) {
      filterOwner.addEventListener("change", () => {
        state.compliance.filterOwner = filterOwner.value;
        render();
      });
    }
    const clearFilters = $("#btn-clear-matrix-filters");
    if (clearFilters) {
      clearFilters.addEventListener("click", () => {
        state.compliance.filterStatus = "";
        state.compliance.filterOwner = "";
        render();
      });
    }
  }

  // ---------- RFP Search interactions ----------
  function resetSearchToPageOne() {
    state.searchPage = 1;
  }

  function bindSearchPageEvents() {
    if (state.page !== "search") return;

    const debouncedRerender = (fn) => {
      let t;
      return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), 250);
      };
    };

    const searchInput = $("#rfp-search-input");
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        debouncedRerender(() => {
          state.searchQuery = searchInput.value;
          resetSearchToPageOne();
          render();
          const el = $("#rfp-search-input");
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        })
      );
    }

    const keywordsInput = $("#filter-keywords");
    if (keywordsInput) {
      keywordsInput.addEventListener(
        "input",
        debouncedRerender(() => {
          state.filters.keywords = keywordsInput.value;
          resetSearchToPageOne();
          render();
          const el = $("#filter-keywords");
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        })
      );
    }

    const bindSelect = (id, key) => {
      const el = $("#" + id);
      if (!el) return;
      el.addEventListener("change", () => {
        state.filters[key] = el.value;
        resetSearchToPageOne();
        render();
      });
    };
    bindSelect("filter-country", "country");
    bindSelect("filter-industry", "industry");
    bindSelect("filter-service", "service");
    bindSelect("filter-value", "valueRange");
    bindSelect("filter-deadline", "deadline");

    const clearFilters = $("#clear-filters");
    if (clearFilters) {
      clearFilters.addEventListener("click", () => {
        state.searchQuery = "";
        state.filters = { ...DEFAULT_SEARCH_FILTERS };
        state.searchSort = { key: "matchScore", dir: "desc" };
        state.searchPage = 1;
        render();
      });
    }

    $$("[data-sort-key]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.dataset.sortKey;
        if (state.searchSort.key === key) {
          state.searchSort.dir = state.searchSort.dir === "asc" ? "desc" : "asc";
        } else {
          state.searchSort.key = key;
          state.searchSort.dir = key === "title" || key === "organization" || key === "country" || key === "status" ? "asc" : "desc";
        }
        resetSearchToPageOne();
        render();
      });
    });

    $$("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const p = Number(btn.dataset.page);
        if (!Number.isNaN(p) && p >= 1) {
          state.searchPage = p;
          render();
          const table = $(".rfp-search-table");
          if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });

    const pageSize = $("#page-size");
    if (pageSize) {
      pageSize.addEventListener("change", () => {
        state.searchPageSize = Number(pageSize.value) || SEARCH_PAGE_SIZE;
        resetSearchToPageOne();
        render();
      });
    }

    const btnExport = $("#btn-export");
    if (btnExport) {
      btnExport.addEventListener("click", exportSearchCsv);
    }

    const openAddForm = () => {
      state.showAddRfpForm = true;
      render();
      const panel = $("#add-rfp-panel");
      if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
      $("#rfp-title")?.focus();
    };
    const closeAddForm = () => {
      state.showAddRfpForm = false;
      render();
    };

    ["#btn-show-add-rfp", "#btn-show-add-rfp-2", "#btn-show-add-rfp-empty"].forEach((sel) => {
      const btn = $(sel);
      if (btn) btn.addEventListener("click", openAddForm);
    });
    ["#btn-cancel-add-rfp", "#btn-cancel-add-rfp-2"].forEach((sel) => {
      const btn = $(sel);
      if (btn) btn.addEventListener("click", closeAddForm);
    });

    const addForm = $("#add-rfp-form");
    if (addForm) {
      addForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errEl = $("#add-rfp-error");
        const showFormErr = (msg) => {
          if (errEl) {
            errEl.hidden = false;
            errEl.textContent = msg;
          }
        };
        if (errEl) {
          errEl.hidden = true;
          errEl.textContent = "";
        }

        const title = $("#rfp-title")?.value?.trim();
        const buyer = $("#rfp-buyer")?.value?.trim();
        const country = $("#rfp-country")?.value?.trim();
        const summary = $("#rfp-summary")?.value?.trim();
        const deadline = $("#rfp-deadline")?.value;

        if (!title || !buyer || !country || !summary || !deadline) {
          showFormErr(
            "Please fill in all required fields (title, organization, country, deadline, summary)."
          );
          return;
        }

        const customId = $("#rfp-id")?.value?.trim();
        if (customId && APP_DATA.rfps.some((r) => r.id === customId)) {
          showFormErr("That RFP ID already exists. Leave blank to auto-generate, or use a unique ID.");
          return;
        }

        const formData = {
          id: customId,
          title,
          buyer,
          country,
          location: $("#rfp-location")?.value,
          industry: $("#rfp-industry")?.value,
          type: $("#rfp-type")?.value,
          value: $("#rfp-value")?.value,
          deadline,
          posted: $("#rfp-posted")?.value,
          status: $("#rfp-status")?.value,
          source: $("#rfp-source")?.value,
          naics: $("#rfp-naics")?.value,
          setAside: $("#rfp-setaside")?.value,
          summary,
          requirements: $("#rfp-requirements")?.value,
          contactName: $("#rfp-contact-name")?.value,
          contactEmail: $("#rfp-contact-email")?.value,
          contactRole: $("#rfp-contact-role")?.value,
        };

        const localRfp = createRfpFromForm(formData);
        const submitBtn = addForm.querySelector('[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        if (typeof Api !== "undefined") Api.showSpinner(true, "Saving RFP…");

        try {
          let rfp = localRfp;
          if (typeof Api !== "undefined" && Api.getToken()) {
            const created = await Api.createRfp(localRfp);
            rfp = Object.assign({}, localRfp, created || {}, {
              matchScore: localRfp.matchScore,
              matchBreakdown: localRfp.matchBreakdown,
              valueMid: localRfp.valueMid,
              source: localRfp.source,
              location: localRfp.location,
              naics: localRfp.naics,
              setAside: localRfp.setAside,
              aiInsights: localRfp.aiInsights,
            });
          }
          APP_DATA.rfps.unshift(rfp);
          persistRfps();
          applyProfileMatchScores();
          state.showAddRfpForm = false;
          state.selectedRfpId = rfp.id;
          toast(`RFP saved: ${rfp.title}`);
          navigate("opportunity", rfp.id);
        } catch (err) {
          console.error(err);
          showFormErr(err.message || "Failed to save RFP. Please try again.");
          toast(err.message || "Failed to save RFP");
        } finally {
          if (typeof Api !== "undefined") Api.showSpinner(false);
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }
  }

  function exportSearchCsv() {
    const rows = getFilteredSortedRfps();
    const header = [
      "RFP Title",
      "Organization",
      "Country",
      "Closing Date",
      "Estimated Value",
      "Match Score",
      "Status",
      "ID",
      "Industry",
      "Service Category",
    ];
    const escapeCsv = (v) => {
      const s = String(v ?? "");
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.title,
          r.buyer,
          rfpCountry(r),
          r.deadline,
          r.value,
          r.matchScore,
          r.status,
          r.id,
          r.industry,
          r.type,
        ]
          .map(escapeCsv)
          .join(",")
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rfp-search-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast(`Exported ${rows.length} RFP${rows.length === 1 ? "" : "s"} to CSV`);
  }

  // ---------- Company profile interactions ----------
  function markProfileDirty() {
    state.profileDirty = true;
    const dot = $("#profile-dirty-dot");
    const label = $("#profile-dirty-label");
    if (dot) dot.classList.remove("saved");
    if (label) label.textContent = "Unsaved changes";
  }

  function addChip(fieldKey, value) {
    const v = String(value || "").trim();
    if (!v) return;
    // Preserve any in-progress form edits before re-render
    if ($("#profile-name")) collectProfileFromForm();
    const p = getProfile();
    if (!Array.isArray(p[fieldKey])) p[fieldKey] = [];
    if (p[fieldKey].some((x) => x.toLowerCase() === v.toLowerCase())) return;
    p[fieldKey].push(v);
    markProfileDirty();
    render();
    const input = $(`[data-chip-input="${fieldKey}"]`);
    if (input) input.focus();
  }

  function removeChip(fieldKey, idx) {
    if ($("#profile-name")) collectProfileFromForm();
    const p = getProfile();
    if (!Array.isArray(p[fieldKey])) return;
    p[fieldKey].splice(Number(idx), 1);
    markProfileDirty();
    render();
  }

  function collectProfileFromForm() {
    const p = getProfile();
    const nameEl = $("#profile-name");
    const empEl = $("#profile-employees");
    const revEl = $("#profile-revenue");
    if (nameEl) p.name = nameEl.value.trim();
    if (empEl) p.employees = empEl.value.trim();
    if (revEl) p.annualRevenue = revEl.value.trim();

    // Case studies from DOM
    const caseCards = $$("[data-case-index]");
    const indices = [...new Set(caseCards.map((c) => c.dataset.caseIndex))];
    p.caseStudies = indices.map((idx) => {
      const get = (field) => {
        const el = $(`[data-case-field="${field}"][data-case-index="${idx}"]`);
        return el ? el.value.trim() : "";
      };
      return {
        client: get("client"),
        domain: get("domain"),
        value: get("value"),
        year: get("year"),
        summary: get("summary"),
      };
    });

    return p;
  }

  function bindCompanyProfileEvents() {
    if (state.page !== "company") return;

    ["profile-name", "profile-employees", "profile-revenue"].forEach((id) => {
      const el = $("#" + id);
      if (el) {
        el.addEventListener("input", markProfileDirty);
      }
    });

    $$("[data-case-field]").forEach((el) => {
      el.addEventListener("input", markProfileDirty);
    });

    $$("[data-chip-input]").forEach((input) => {
      const fieldKey = input.dataset.chipInput;
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          addChip(fieldKey, input.value.replace(/,/g, ""));
        } else if (e.key === "Backspace" && !input.value) {
          const list = getProfile()[fieldKey] || [];
          if (list.length) removeChip(fieldKey, list.length - 1);
        }
      });
      input.addEventListener("blur", () => {
        if (input.value.trim()) addChip(fieldKey, input.value);
      });
    });

    $$("[data-remove-chip]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removeChip(btn.dataset.removeChip, btn.dataset.idx);
      });
    });

    $$("[data-add-suggestion]").forEach((btn) => {
      btn.addEventListener("click", () => {
        addChip(btn.dataset.addSuggestion, btn.dataset.value);
      });
    });

    $$(".chip-field").forEach((field) => {
      field.addEventListener("click", () => {
        const input = field.querySelector(".chip-input");
        if (input) input.focus();
      });
    });

    const addCase = $("#btn-add-case");
    if (addCase) {
      addCase.addEventListener("click", () => {
        collectProfileFromForm();
        const p = getProfile();
        p.caseStudies = p.caseStudies || [];
        p.caseStudies.push({ client: "", domain: "", value: "", year: "", summary: "" });
        markProfileDirty();
        render();
      });
    }

    $$("[data-remove-case]").forEach((btn) => {
      btn.addEventListener("click", () => {
        collectProfileFromForm();
        const p = getProfile();
        const idx = Number(btn.dataset.removeCase);
        p.caseStudies.splice(idx, 1);
        markProfileDirty();
        render();
      });
    });

    const btnSave = $("#btn-save-profile");
    if (btnSave) {
      btnSave.addEventListener("click", async () => {
        const draft = collectProfileFromForm();
        if (!draft.name?.trim()) {
          toast("Company name is required");
          $("#profile-name")?.focus();
          return;
        }
        btnSave.disabled = true;
        const prevLabel = btnSave.textContent;
        btnSave.textContent = "Saving…";
        try {
          const saved = await persistProfile(draft);
          toast(`Profile saved for ${saved.name} — RFP match scores updated`);
          render();
        } catch (err) {
          console.error(err);
          toast(err.message || "Failed to save company profile");
        } finally {
          btnSave.disabled = false;
          btnSave.textContent = prevLabel || "Save profile";
        }
      });
    }

    const btnReset = $("#btn-reset-profile");
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (!confirm("Clear company profile? This removes saved profile data in this browser.")) {
          return;
        }
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        state.profile = normalizeProfile({
          name: "",
          countriesServed: [],
          servicesOffered: [],
          industryExpertise: [],
          certifications: [],
          employees: "",
          annualRevenue: "",
          technologyPartnerships: [],
          caseStudies: [],
          lastSaved: null,
        });
        APP_DATA.company = state.profile;
        state.profileDirty = true;
        applyProfileMatchScores();
        toast("Profile cleared — enter your data and Save");
        render();
      });
    }
  }

  // ---------- Auth UI ----------
  function showAuthError(id, message) {
    const el = $(id);
    if (!el) return;
    if (message) {
      el.hidden = false;
      el.textContent = message;
    } else {
      el.hidden = true;
      el.textContent = "";
    }
  }

  function showAuthView(view) {
    const login = $("#login-view");
    const register = $("#register-view");
    if (!login || !register) return;
    const isLogin = view === "login";
    login.hidden = !isLogin;
    register.hidden = isLogin;
    showAuthError("#login-error", null);
    showAuthError("#register-error", null);
  }

  function updateUserChrome() {
    const user = typeof Auth !== "undefined" ? Auth.currentUser() : null;
    const avatar = $("#user-avatar");
    const nameEl = $("#user-display-name");
    const roleEl = $("#user-display-role");
    if (!user) return;
    if (avatar) avatar.textContent = Auth.initials(user.name);
    if (nameEl) nameEl.textContent = user.name || "User";
    if (roleEl) roleEl.textContent = user.role || user.company || "User";
  }

  function showAppShell(show) {
    const auth = $("#auth-screen");
    const app = $("#app-shell");
    if (auth) auth.hidden = !!show;
    if (app) app.hidden = !show;
    document.body.classList.toggle("is-authenticated", !!show);
  }

  /**
   * Load company profile, RFPs, and dashboard metrics from the REST API.
   * Uses spinner and surfaces errors via toast without blocking the shell.
   */
  async function bootstrapFromApi() {
    if (typeof Api === "undefined" || !Api.getToken()) return;

    state.bootstrapping = true;
    Api.showSpinner(true, "Loading your workspace…");
    const errors = [];

    try {
      // Company profile
      try {
        const company = await Api.getMyCompany();
        if (company) {
          cacheProfileLocally(
            Object.assign({}, getProfile(), company, {
              caseStudies: (company.caseStudies && company.caseStudies.length)
                ? company.caseStudies
                : getProfile().caseStudies,
            })
          );
        } else {
          // Prefill empty company name from registration if available
          const user = Auth.currentUser();
          if (user?.company) {
            const profile = getProfile();
            if (!profile.name) {
              profile.name = user.company;
              APP_DATA.company = profile;
            }
          }
        }
      } catch (err) {
        console.error("Company load failed:", err);
        errors.push("company profile");
        state.profile = loadProfile();
        APP_DATA.company = state.profile;
      }

      // RFPs
      try {
        await loadSavedRfps();
      } catch (err) {
        console.error("RFP load failed:", err);
        errors.push("RFPs");
      }

      // Dashboard KPIs / charts
      try {
        state.dashboardApi = await Api.getDashboard();
      } catch (err) {
        console.error("Dashboard load failed:", err);
        state.dashboardApi = null;
        errors.push("dashboard");
      }

      if (errors.length) {
        toast(
          "Some data could not be loaded (" +
            errors.join(", ") +
            "). " +
            (errors.length === 3
              ? "Check that the API is running."
              : "Using any cached data available.")
        );
      }
    } finally {
      state.bootstrapping = false;
      Api.showSpinner(false);
    }
  }

  async function refreshDashboard() {
    if (typeof Api === "undefined" || !Api.getToken()) return;
    Api.showSpinner(true, "Refreshing dashboard…");
    try {
      state.dashboardApi = await Api.getDashboard();
      await loadSavedRfps();
      applyProfileMatchScores();
      if (state.page === "dashboard") render();
      toast("Dashboard refreshed");
    } catch (err) {
      console.error(err);
      toast(err.message || "Failed to refresh dashboard");
    } finally {
      Api.showSpinner(false);
    }
  }

  async function enterApp() {
    showAppShell(true);
    updateUserChrome();

    await bootstrapFromApi();

    // Prefill empty company name from registration if still empty
    const user = Auth.currentUser();
    if (user?.company) {
      const profile = getProfile();
      if (!profile.name) {
        profile.name = user.company;
        APP_DATA.company = profile;
      }
    }

    if (APP_DATA.rfps.length) {
      state.selectedRfpId = state.selectedRfpId || APP_DATA.rfps[0].id;
    } else {
      state.selectedRfpId = null;
    }
    applyProfileMatchScores();
    parseHash();
    render();
    toast(`Welcome, ${user?.name || "user"}`);
  }

  async function exitToLogin() {
    if (typeof Api !== "undefined") Api.showSpinner(true, "Signing out…");
    try {
      await Auth.logout();
    } catch (_) {
      Auth.clearSession();
    } finally {
      if (typeof Api !== "undefined") Api.showSpinner(false);
    }
    state.dashboardApi = null;
    APP_DATA.rfps = [];
    showAppShell(false);
    showAuthView("login");
    const loginForm = $("#login-form");
    if (loginForm) loginForm.reset();
    toast("You have been logged out");
  }

  function bindAuthEvents() {
    if (typeof Auth === "undefined") {
      console.error("Auth module not loaded");
      return;
    }

    $$("[data-toggle-password]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.togglePassword;
        const input = document.getElementById(id);
        if (!input) return;
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.textContent = show ? "Hide" : "Show";
      });
    });

    const gotoReg = $("#goto-register");
    if (gotoReg) gotoReg.addEventListener("click", () => showAuthView("register"));
    const gotoLogin = $("#goto-login");
    if (gotoLogin) gotoLogin.addEventListener("click", () => showAuthView("login"));

    const forgot = $("#btn-forgot");
    if (forgot) {
      forgot.addEventListener("click", () => {
        toast("Password reset is not enabled yet. Contact your admin or register a new account.");
      });
    }

    const loginForm = $("#login-form");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        showAuthError("#login-error", null);
        const submit = $("#login-submit");
        if (submit) {
          submit.disabled = true;
          submit.textContent = "Signing in…";
        }
        if (typeof Api !== "undefined") Api.showSpinner(true, "Signing in…");
        try {
          const result = await Auth.login({
            email: $("#login-email")?.value,
            password: $("#login-password")?.value,
            remember: $("#login-remember")?.checked,
          });
          if (!result.ok) {
            showAuthError("#login-error", result.error || "Login failed");
            return;
          }
          await enterApp();
        } catch (err) {
          showAuthError(
            "#login-error",
            (err && err.message) || "Login failed. Please try again."
          );
        } finally {
          if (typeof Api !== "undefined") Api.showSpinner(false);
          if (submit) {
            submit.disabled = false;
            submit.textContent = "Log in";
          }
        }
      });
    }

    const registerForm = $("#register-form");
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        showAuthError("#register-error", null);

        if (!$("#reg-terms")?.checked) {
          showAuthError("#register-error", "Please accept the terms to create an account.");
          return;
        }

        const submit = $("#register-submit");
        if (submit) {
          submit.disabled = true;
          submit.textContent = "Creating account…";
        }
        if (typeof Api !== "undefined") Api.showSpinner(true, "Creating account…");
        try {
          const result = await Auth.register({
            name: $("#reg-name")?.value,
            email: $("#reg-email")?.value,
            password: $("#reg-password")?.value,
            confirmPassword: $("#reg-confirm")?.value,
            company: $("#reg-company")?.value,
            role: $("#reg-role")?.value || "User",
          });
          if (!result.ok) {
            showAuthError("#register-error", result.error || "Registration failed");
            return;
          }
          await enterApp();
        } catch (err) {
          showAuthError(
            "#register-error",
            (err && err.message) || "Registration failed. Please try again."
          );
        } finally {
          if (typeof Api !== "undefined") Api.showSpinner(false);
          if (submit) {
            submit.disabled = false;
            submit.textContent = "Create account";
          }
        }
      });
    }

    const logoutBtn = $("#btn-logout");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        if (confirm("Log out of AI RFP Scout?")) await exitToLogin();
      });
    }
  }

  // ---------- Init ----------
  function clearStaleBrowserData() {
    // Bump this string whenever we need a clean browser cache (RFPs, profile, etc.)
    const DATA_VERSION = "clean-v3-fresh-admin-only-2026-07-15";
    const versionKey = "ai-rfp-scout-data-version";
    try {
      if (localStorage.getItem(versionKey) !== DATA_VERSION) {
        localStorage.removeItem(PROFILE_STORAGE_KEY);
        localStorage.removeItem(RFPS_STORAGE_KEY);
        localStorage.removeItem(COMPLIANCE_STORAGE_KEY);
        localStorage.removeItem(PROPOSAL_STORAGE_KEY);
        // Force re-login against the fresh server DB (admin credentials unchanged)
        try {
          const cfg = window.APP_CONFIG || {};
          localStorage.removeItem(cfg.SESSION_KEY || "ai-rfp-scout-session-v2");
          localStorage.removeItem(cfg.TOKEN_KEY || "ai-rfp-scout-access-token");
        } catch (_) {
          /* ignore */
        }
        localStorage.setItem(versionKey, DATA_VERSION);
      }
    } catch (_) {
      /* ignore */
    }
  }

  async function init() {
    clearStaleBrowserData();
    // Local seed only; API data replaces these after login
    loadSavedRfpsFromLocal();
    state.profile = loadProfile();
    APP_DATA.company = state.profile;

    bindAuthEvents();

    $("#menu-toggle")?.addEventListener("click", () => {
      $("#sidebar").classList.toggle("open");
      $("#sidebar-overlay").classList.toggle("open");
    });
    $("#sidebar-overlay")?.addEventListener("click", closeSidebar);

    $("#global-search")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        state.searchQuery = e.target.value;
        state.searchPage = 1;
        navigate("search");
      }
    });

    $("#btn-notifications")?.addEventListener("click", () => {
      toast("3 notifications: 2 new matches, 1 deadline tomorrow");
    });

    window.addEventListener("hashchange", () => {
      if (!Auth.isLoggedIn()) return;
      parseHash();
      render();
    });

    // Dashboard refresh (delegated — element is re-rendered)
    document.addEventListener("click", (e) => {
      const btn = e.target.closest && e.target.closest("#btn-refresh-dashboard");
      if (btn) {
        e.preventDefault();
        refreshDashboard();
      }
    });

    if (Auth.isLoggedIn()) {
      await enterApp();
    } else {
      showAppShell(false);
      showAuthView("login");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
