/* AI RFP Scout — Application Data (clean slate) */

const APP_DATA = {
  company: {
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
  },

  stats: {
    activeRfps: 0,
    highMatch: 0,
    proposalsInProgress: 0,
    winRate: 0,
    pipelineValue: "$0",
    dueThisWeek: 0,
  },

  rfps: [],

  proposalSections: [
    {
      id: "executive-summary",
      title: "Executive Summary",
      status: "todo",
      owner: "Chitra",
      content: "",
    },
    {
      id: "win-themes",
      title: "Win Themes",
      status: "todo",
      owner: "Manoj",
      content: "",
    },
    {
      id: "solution-overview",
      title: "Solution Overview",
      status: "todo",
      owner: "Chiranjib",
      content: "",
    },
    {
      id: "delivery-model",
      title: "Delivery Model",
      status: "todo",
      owner: "John",
      content: "",
    },
    {
      id: "governance",
      title: "Governance",
      status: "todo",
      owner: "Chitra",
      content: "",
    },
    {
      id: "pricing-assumptions",
      title: "Pricing Assumptions",
      status: "todo",
      owner: "Manoj",
      content: "",
    },
    {
      id: "risks",
      title: "Risks",
      status: "todo",
      owner: "Chiranjib",
      content: "",
    },
    {
      id: "clarifications",
      title: "Clarifications",
      status: "todo",
      owner: "John",
      content: "",
    },
  ],

  complianceMatrix: [],

  complianceOwners: ["Chitra", "Manoj", "Chiranjib", "John", "Unassigned"],

  responseStatuses: [
    "Not Started",
    "In Progress",
    "Comply",
    "Partial",
    "Exception",
    "N/A",
  ],

  activity: [],

  pipelineByType: [],

  settings: {
    notifications: {
      newRfpMatch: true,
      deadlineReminders: true,
      proposalUpdates: true,
      weeklyDigest: false,
      competitorAlerts: true,
    },
    search: {
      minMatchScore: 70,
      autoQualify: true,
      sources: ["SAM.gov", "GovWin", "State Portals", "Company Portals", "Brokers"],
      industries: ["Banking", "Insurance", "Healthcare", "Government", "Technology", "Retail"],
    },
    team: [
      { name: "Chitra", role: "Team Member", email: "" },
      { name: "Manoj", role: "Team Member", email: "" },
      { name: "Chiranjib", role: "Team Member", email: "" },
      { name: "John", role: "Team Member", email: "" },
    ],
  },
};
