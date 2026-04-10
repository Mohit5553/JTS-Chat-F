import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import PaginationControls from "./PaginationControls.jsx";
import ActivityTimeline from "./ActivityTimeline.jsx";
import { hasPermission } from "../utils/permissions.js";
import { PERMISSIONS, SALES_ALLOWED_STATUS_TRANSITIONS } from "../constants/domain.js";
import {
  Search, Filter, User, Calendar, Tag, ChevronRight, MessageCircle,
  Ticket as TicketIcon, X, Plus, Save, ArrowRight, Clock, CheckCircle2,
  AlertCircle, Circle, TrendingUp, ExternalLink, LayoutGrid, List, Send,
  Zap, Shield, UserCheck, Phone, Mail, Users, Trash2, PlusCircle
} from "lucide-react";

const CRM_STAGE_CONFIG = {
  new: { label: "New", color: "bg-violet-50 text-violet-600 border-violet-100", dot: "bg-violet-500" },
  qualified: { label: "Qualified", color: "bg-indigo-50 text-indigo-600 border-indigo-100", dot: "bg-indigo-500" },
  hold: { label: "Hold", color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
  proposition: { label: "Proposition", color: "bg-amber-50 text-amber-600 border-amber-100", dot: "bg-amber-500" },
  won: { label: "Won", color: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
  lost: { label: "Lost", color: "bg-red-50 text-red-500 border-red-100", dot: "bg-red-400" }
};

const TICKET_STATUS_CONFIG = {
  open: { label: "Open", color: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: Circle },
  pending: { label: "Pending", color: "bg-amber-50 text-amber-600 border-amber-100", icon: Clock },
  resolved: { label: "Resolved", color: "bg-slate-100 text-slate-500 border-slate-200", icon: CheckCircle2 },
  closed: { label: "Closed", color: "bg-slate-100 text-slate-400 border-slate-100", icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  low: { color: "text-slate-400", label: "Low" },
  medium: { color: "text-sky-500", label: "Medium" },
  high: { color: "text-amber-500", label: "High" },
  urgent: { color: "text-red-500", label: "Urgent" },
};

const LEAD_STATUS_STYLES = {
  new: "bg-slate-100 text-slate-700 border-slate-200",
  contacted: "bg-sky-50 text-sky-700 border-sky-200",
  qualified: "bg-indigo-50 text-indigo-700 border-indigo-200",
  proposal_sent: "bg-amber-50 text-amber-700 border-amber-200",
  prospect: "bg-violet-50 text-violet-700 border-violet-200",
  lead: "bg-cyan-50 text-cyan-700 border-cyan-200",
  customer: "bg-emerald-50 text-emerald-700 border-emerald-200",
  won: "bg-emerald-50 text-emerald-700 border-emerald-200",
  lost: "bg-rose-50 text-rose-700 border-rose-200",
  inactive: "bg-slate-100 text-slate-500 border-slate-200"
};

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatCompactDate(value) {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  return date.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function formatCompactDateTime(value) {
  if (!value) return "Not scheduled";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";
  return date.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function LeadStatusBadge({ status }) {
  const normalized = status || "new";
  const classes = LEAD_STATUS_STYLES[normalized] || LEAD_STATUS_STYLES.new;

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-1 text-[9px] font-black uppercase tracking-[0.16em] ${classes}`}>
      {normalized.replaceAll("_", " ")}
    </span>
  );
}

function CRMStageBadge({ stage }) {
  const cfg = CRM_STAGE_CONFIG[stage] || CRM_STAGE_CONFIG.new;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function TicketStatusBadge({ status }) {
  const cfg = TICKET_STATUS_CONFIG[status] || TICKET_STATUS_CONFIG.open;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${cfg.color}`}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function PriorityDot({ priority }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.medium;
  return (
    <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color}`}>
      ● {cfg.label}
    </span>
  );
}

function HeatIndicator({ score }) {
  const isHot = score > 70;
  const isCold = score < 20;
  
  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest ${
      isHot ? "bg-orange-50 text-orange-600 border-orange-100" :
      isCold ? "bg-blue-50 text-blue-400 border-blue-100" :
      "bg-slate-50 text-slate-500 border-slate-100"
    }`}>
      {isHot ? <Zap size={10} className="animate-pulse" /> : <Clock size={10} />}
      Score: {score}
    </div>
  );
}

// CRM Pipeline mini-chart shown at the top of the list view
function CRMPipelineBar({ customers }) {
  const pipelineCounts = customers.reduce((acc, c) => {
    const stage = c.pipelineStage || "new";
    acc[stage] = (acc[stage] || 0) + 1;
    return acc;
  }, {});

  const stages = [
    { key: "new", label: "New", color: "bg-violet-500", count: pipelineCounts.new || 0 },
    { key: "qualified", label: "Qualified", color: "bg-indigo-500", count: pipelineCounts.qualified || 0 },
    { key: "hold", label: "Hold", color: "bg-slate-400", count: pipelineCounts.hold || 0 },
    { key: "proposition", label: "Proposition", color: "bg-amber-500", count: pipelineCounts.proposition || 0 },
    { key: "won", label: "Won", color: "bg-emerald-500", count: pipelineCounts.won || 0 },
    { key: "lost", label: "Lost", color: "bg-red-400", count: pipelineCounts.lost || 0 },
  ];

  const total = customers.length || 1;

  return (
    <div className="premium-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CRM Pipeline</p>
          <p className="text-sm font-black text-slate-900">{customers.length} Total Customers</p>
        </div>
        <TrendingUp size={18} className="text-indigo-400" />
      </div>

      {/* Pipeline bar */}
      <div className="flex rounded-xl overflow-hidden h-2.5 bg-slate-100 gap-0.5">
        {stages.map(s => s.count > 0 && (
          <div
            key={s.key}
            className={`${s.color} transition-all duration-700`}
            style={{ width: `${(s.count / total) * 100}%` }}
            title={`${s.label}: ${s.count}`}
          />
        ))}
      </div>

      <div className="flex gap-4 flex-wrap">
        {stages.map(s => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">{s.label} <span className="text-slate-900">{s.count}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CRMManager({ websiteId = "", initialLeadData = null, highlightLeadId = null }) {
  const { user } = useAuth();
  const isSales = user?.role === "sales";
  const isManager = user?.role === "manager" || user?.role === "client" || user?.role === "admin";
  const canEditCRM = hasPermission(user, PERMISSIONS.CRM_UPDATE);
  const canAssignOwners = hasPermission(user, PERMISSIONS.CRM_ASSIGN_OWNER);
  const canSendSalesEmail = hasPermission(user, PERMISSIONS.CRM_SEND_EMAIL);
  const canManagePipeline = hasPermission(user, PERMISSIONS.CRM_UPDATE);
  const canCreateLead = hasPermission(user, PERMISSIONS.CRM_CREATE);
  const canArchiveLead = hasPermission(user, PERMISSIONS.CRM_ARCHIVE);
  const canDeleteLead = hasPermission(user, PERMISSIONS.CRM_DELETE);
  const canManageTasks = hasPermission(user, PERMISSIONS.CRM_MANAGE_TASKS);
  const canAutoAssign = hasPermission(user, PERMISSIONS.CRM_AUTO_ASSIGN);
  const [viewMode, setViewMode] = useState("board");
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary] = useState({});
  const [teamMembers, setTeamMembers] = useState([]);
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  // Sales users always view only their own leads
  const [leadView, setLeadView] = useState(isSales ? "my_leads" : "all");
  const [autoAssigning, setAutoAssigning] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDrawer, setShowDrawer] = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [drawerTab, setDrawerTab] = useState("tickets"); // "tickets" | "chats" | "notes"
  const [savingNote, setSavingNote] = useState(false);
  const [noteSuccess, setNoteSuccess] = useState(false);
  const [ownerUpdateError, setOwnerUpdateError] = useState("");
  const [emailDraft, setEmailDraft] = useState({ subject: "", body: "" });
  const [creatingLead, setCreatingLead] = useState(false);
  const [leadActionSuccess, setLeadActionSuccess] = useState(false);

  useEffect(() => {
    if (initialLeadData) {
      setEditLeadId(null);
      setCreateLeadForm({
        name: initialLeadData.name || "",
        email: initialLeadData.email || "",
        phone: initialLeadData.phone || "",
        companyName: initialLeadData.companyName || "",
        leadSource: initialLeadData.leadSource || "website",
        leadValue: initialLeadData.leadValue || "",
        priority: initialLeadData.priority || "medium",
        ownerId: initialLeadData.ownerId || user?._id || "",
        notes: initialLeadData.notes || "",
        sessionId: initialLeadData.sessionId || ""
      });
      setShowCreateLead(true);
    }
  }, [initialLeadData, user?._id]);
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [emailAttachment, setEmailAttachment] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [draggedCustomerId, setDraggedCustomerId] = useState("");
  const [dropTargetStatus, setDropTargetStatus] = useState("");
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [createLeadError, setCreateLeadError] = useState("");
  const [removeLeadError, setRemoveLeadError] = useState("");
  const [removingLead, setRemovingLead] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: "", text: "" });
  const [taskForm, setTaskForm] = useState({ title: "", type: "follow_up", dueAt: "", notes: "" });
  const [taskSaving, setTaskSaving] = useState(false);
  const [interactionType, setInteractionType] = useState("call"); // "call" | "meeting" | "manual_email"
  const [interactionNote, setInteractionNote] = useState("");
  const [interactionSaving, setInteractionSaving] = useState(false);
  const [createLeadForm, setCreateLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    leadSource: "",
    leadValue: 0,
    expectedCloseDate: "",
    websiteId: websiteId || "",
    status: "new",
    pipelineStage: "new",
    priority: "medium",
    ownerId: "",
    tags: "",
    notes: "",
    sessionId: ""
  });
  const [editLeadId, setEditLeadId] = useState(null);

  useEffect(() => {
    if (highlightLeadId) {
      const loadAndOpen = async () => {
        try {
          const leadData = await api(`/api/crm/${highlightLeadId}`);
          if (leadData?.customer) {
            openCustomer(leadData.customer);
          }
        } catch (err) {
          console.error("Failed to open highlighted lead", err);
        }
      };
      loadAndOpen();
    }
  }, [highlightLeadId]);

  const openEditLead = () => {
    if (!selectedCustomer) return;
    setCreateLeadForm({
      name: selectedCustomer.name || "",
      email: selectedCustomer.email || "",
      phone: selectedCustomer.phone || "",
      companyName: selectedCustomer.companyName || "",
      leadSource: selectedCustomer.leadSource || "",
      leadValue: selectedCustomer.leadValue || 0,
      expectedCloseDate: selectedCustomer.expectedCloseDate ? selectedCustomer.expectedCloseDate.substring(0, 10) : "",
      websiteId: selectedCustomer.websiteId?._id || selectedCustomer.websiteId || websiteId || "",
      status: selectedCustomer.status || "new",
      pipelineStage: selectedCustomer.pipelineStage || "new",
      priority: selectedCustomer.priority || "medium",
      ownerId: selectedCustomer.ownerId?._id || selectedCustomer.ownerId || "",
      tags: selectedCustomer.tags ? selectedCustomer.tags.join(", ") : "",
      notes: "",
      sessionId: selectedCustomer.sessionId || ""
    });
    setEditLeadId(selectedCustomer._id);
    setShowCreateLead(true);
  };

  const buildSalesEmailDraft = (customer, currentUser) => {
    const customerName = customer?.name || "there";
    const salesName = currentUser?.name || "Sales Team";
    const websiteName = customer?.websiteId?.websiteName || "our team";
    return {
      subject: `Follow-up from ${websiteName}`,
      body: `Hi ${customerName},

Thank you for your interest. I am ${salesName} from ${websiteName}.

I am following up regarding your recent inquiry. Please reply with a convenient time or any details you would like us to prepare before we connect.

Best regards,
${salesName}`
    };
  };

  const fetchCustomers = async (page = 1) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page,
        search,
        status: statusFilter,
        websiteId,
        view: leadView
      }).toString();
      const data = await api(`/api/crm?${query}`);
      setCustomers(data.customers || []);
      setSummary(data.summary || {});
      setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    try {
      const data = await api("/api/users/agents");
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch CRM owners:", err);
    }
  };

  const fetchWebsites = async () => {
    try {
      const data = await api("/api/websites");
      setWebsites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch CRM websites:", err);
    }
  };

  useEffect(() => { fetchCustomers(); }, [search, statusFilter, websiteId, leadView]);
  useEffect(() => { if (canAssignOwners) fetchTeamMembers(); }, [canAssignOwners]);
  useEffect(() => { if (canCreateLead) fetchWebsites(); }, [canCreateLead]);
  useEffect(() => {
    setCreateLeadForm((prev) => ({
      ...prev,
      websiteId: websiteId || prev.websiteId || ""
    }));
  }, [websiteId]);
  useEffect(() => {
    if (!actionMessage.text) return;
    const timer = setTimeout(() => setActionMessage({ type: "", text: "" }), 3000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  const selectedWebsiteId = customerDetails?.customer?.websiteId?._id
    || selectedCustomer?.websiteId?._id
    || selectedCustomer?.websiteId
    || "";

  const crmOwners = teamMembers.filter((member) => {
    if (!["sales", "manager"].includes(member.role)) return false;
    if (!selectedWebsiteId) return true;
    if (!Array.isArray(member.websiteIds) || member.websiteIds.length === 0) return true;
    return member.websiteIds.some((website) => String(website?._id || website) === String(selectedWebsiteId));
  });

  const openCustomer = async (customer) => {
    setSelectedCustomer(customer);
    setShowDrawer(true);
    setLoadingDetails(true);
    setCustomerDetails(null);
    setDrawerTab("tickets");
    setEmailDraft(buildSalesEmailDraft(customer, user));
    setEmailAttachment(null);
    setEmailError("");
    setEmailSuccess(false);
    try {
      const data = await api(`/api/crm/${customer._id}`);
      setCustomerDetails(data);
      setEmailDraft((prev) => (
        prev.subject || prev.body
          ? prev
          : buildSalesEmailDraft(data.customer, user)
      ));
    } catch (err) {
      console.error("Failed to fetch customer details:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const syncCustomerState = (updatedCustomer) => {
    if (!updatedCustomer?._id) return;
    setCustomers(prev => prev.map((customer) => (
      customer._id === updatedCustomer._id ? { ...customer, ...updatedCustomer } : customer
    )));
    if (selectedCustomer?._id === updatedCustomer._id) {
      setSelectedCustomer(prev => prev ? { ...prev, ...updatedCustomer } : prev);
    }
    setCustomerDetails(prev => prev ? { ...prev, customer: updatedCustomer } : prev);
  };

  const removeCustomerFromState = (customerId) => {
    setCustomers((prev) => prev.filter((customer) => customer._id !== customerId));
    setPagination((prev) => ({ ...prev, total: Math.max(0, (prev.total || 1) - 1) }));
    if (selectedCustomer?._id === customerId) {
      setSelectedCustomer(null);
      setCustomerDetails(null);
      setShowDrawer(false);
    }
  };

  const updateCustomerFields = async (id, payload) => {
    try {
      setOwnerUpdateError("");
      setActionMessage({ type: "", text: "" });
      const updated = await api(`/api/crm/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
      syncCustomerState(updated);
      if (showDrawer && selectedCustomer?._id === id) {
        const refreshed = await api(`/api/crm/${id}`);
        setCustomerDetails(refreshed);
        setSelectedCustomer((prev) => prev ? { ...prev, ...refreshed.customer } : prev);
      }
      setActionMessage({ type: "success", text: "CRM record updated." });
    } catch (err) {
      console.error("Update failed", err);
      setOwnerUpdateError(err.message || "CRM owner update failed");
      setActionMessage({ type: "error", text: err.message || "CRM update failed." });
    }
  };

  const updateStatus = async (id, status) => updateCustomerFields(id, { status });
  const updatePipelineStage = async (id, pipelineStage) => updateCustomerFields(id, { pipelineStage });
  const updateOwner = async (id, ownerId) => updateCustomerFields(id, {
    ownerId: ownerId || null,
    assignmentReason: ownerId ? "manager_dashboard_assignment" : "manager_dashboard_unassignment"
  });
  const updateNextFollowUp = async (id, nextFollowUpAt) => updateCustomerFields(id, { nextFollowUpAt: nextFollowUpAt || null });

  const createTask = async (e) => {
    e.preventDefault();
    if (!selectedCustomer?._id) return;
    setTaskSaving(true);
    try {
      await api(`/api/crm/${selectedCustomer._id}/tasks`, {
        method: "POST",
        body: JSON.stringify(taskForm)
      });
      const refreshed = await api(`/api/crm/${selectedCustomer._id}`);
      setCustomerDetails(refreshed);
      setTaskForm({ title: "", type: "follow_up", dueAt: "", notes: "" });
      setActionMessage({ type: "success", text: "Follow-up task created." });
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Task creation failed." });
    } finally {
      setTaskSaving(false);
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    if (!selectedCustomer?._id) return;
    try {
      await api(`/api/crm/${selectedCustomer._id}/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });
      const refreshed = await api(`/api/crm/${selectedCustomer._id}`);
      setCustomerDetails(refreshed);
      setActionMessage({ type: "success", text: "Task updated." });
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Task update failed." });
    }
  };

  const sendSalesEmail = async (e) => {
    e.preventDefault();
    if (!selectedCustomer?._id || !emailDraft.subject.trim() || !emailDraft.body.trim()) return;
    setSendingEmail(true);
    setEmailError("");
    setEmailSuccess(false);
    try {
      const updated = await api(`/api/crm/${selectedCustomer._id}/send-email`, {
        method: "POST",
        body: (() => {
          const formData = new FormData();
          formData.append("subject", emailDraft.subject.trim());
          formData.append("body", emailDraft.body.trim());
          if (emailAttachment) {
            formData.append("attachment", emailAttachment);
          }
          return formData;
        })()
      });
      syncCustomerState(updated);
      setCustomerDetails((prev) => prev ? { ...prev, customer: updated } : prev);
      setEmailAttachment(null);
      setEmailSuccess(true);
      setActionMessage({ type: "success", text: "Sales email sent successfully." });
      setTimeout(() => setEmailSuccess(false), 2500);
    } catch (err) {
      console.error("Sales email failed", err);
      setEmailError(err.message || "Email send failed");
      setActionMessage({ type: "error", text: err.message || "Email send failed." });
    } finally {
      setSendingEmail(false);
    }
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const updated = await api(`/api/crm/${selectedCustomer._id}/notes`, {
        method: "POST",
        body: JSON.stringify({ text: newNote })
      });
      syncCustomerState(updated);
      setNewNote("");
      setNoteSuccess(true);
      setActionMessage({ type: "success", text: "CRM note added." });
      setTimeout(() => setNoteSuccess(false), 2000);
    } catch (err) {
      console.error("Note addition failed", err);
      setActionMessage({ type: "error", text: err.message || "Note addition failed." });
    } finally {
      setSavingNote(false);
    }
  };

  const logManualInteraction = async (e) => {
    e.preventDefault();
    if (!interactionNote.trim() || !customerDetails?.customer?._id) return;
    setInteractionSaving(true);
    try {
      const updated = await api(`/api/crm/${customerDetails.customer._id}/notes`, {
        method: "POST",
        body: JSON.stringify({
          type: interactionType,
          content: interactionNote
        })
      });
      syncCustomerState(updated);
      // Refresh details to ensure Activity Timeline reflects the new log instantly
      const refreshed = await api(`/api/crm/${customerDetails.customer._id}`);
      setCustomerDetails(refreshed);
      setInteractionNote("");
      setActionMessage({ 
        type: "success", 
        text: `${interactionType.charAt(0).toUpperCase() + interactionType.slice(1).replace("_", " ")} logged successfully.` 
      });
    } catch (err) {
      console.error("Interaction logging failed", err);
      setActionMessage({ type: "error", text: err.message || "Failed to log interaction." });
    } finally {
      setInteractionSaving(false);
    }
  };

  const openTicketCount = customerDetails?.tickets?.filter(t => ["open", "pending", "in_progress"].includes(t.status)).length || 0;
  const boardColumns = [
    { key: "new", label: "New", tone: "from-violet-500 to-fuchsia-500" },
    { key: "qualified", label: "Qualified", tone: "from-indigo-500 to-sky-500" },
    { key: "hold", label: "Hold", tone: "from-slate-400 to-slate-500" },
    { key: "proposition", label: "Proposition", tone: "from-amber-500 to-orange-500" },
    { key: "won", label: "Won", tone: "from-emerald-500 to-teal-500" },
    { key: "lost", label: "Lost", tone: "from-rose-500 to-red-500" }
  ];

  const workspaceCards = [
    { key: "all", label: "Pipeline", value: pagination.total || customers.length, helper: "Active records in current view", icon: LayoutGrid },
    { key: "my_leads", label: "Assigned to Me", value: summary.myLeads || 0, helper: "Owned by current seller", icon: UserCheck },
    { key: "due_today", label: "Follow Up Today", value: summary.dueToday || 0, helper: "Activities due this business day", icon: Clock },
    { key: "no_follow_up", label: "Missing Next Step", value: summary.noFollowUp || 0, helper: "Needs an activity planned", icon: AlertCircle },
    { key: "archived", label: "Archived", value: summary.archived || 0, helper: "Inactive and hidden records", icon: Shield }
  ];

  const handleBoardDrop = async (nextStatus, explicitCustomerId = "") => {
    const customerId = explicitCustomerId || draggedCustomerId;
    setDropTargetStatus("");
    setDraggedCustomerId("");
    if (!customerId || !nextStatus || !canManagePipeline) return;

    const existing = customers.find((customer) => customer._id === customerId);
    if (!existing || existing.pipelineStage === nextStatus) return;

    setCustomers((prev) => prev.map((customer) => (
      customer._id === customerId ? { ...customer, pipelineStage: nextStatus } : customer
    )));

    try {
      await updatePipelineStage(customerId, nextStatus);
    } catch (err) {
      setCustomers((prev) => prev.map((customer) => (
        customer._id === customerId ? { ...customer, pipelineStage: existing.pipelineStage } : customer
      )));
    }
  };


  const resetCreateLeadForm = () => {
    setCreateLeadForm({
      name: "",
      email: "",
      phone: "",
      companyName: "",
      leadSource: "",
      leadValue: 0,
      expectedCloseDate: "",
      websiteId: websiteId || "",
      status: "new",
      pipelineStage: "new",
      priority: "medium",
      ownerId: "",
      tags: "",
      notes: "",
      sessionId: ""
    });
    setCreateLeadError("");
    setEditLeadId(null);
  };

  const submitCreateLead = async (e) => {
    e.preventDefault();
    setCreatingLead(true);
    setCreateLeadError("");

    let finalWebsiteId = createLeadForm.websiteId;
    if (!finalWebsiteId && websites && websites.length > 0) {
      finalWebsiteId = websites[0]._id;
    }

    if (!finalWebsiteId && !editLeadId) {
      setCreateLeadError("No valid website found to link this lead.");
      setCreatingLead(false);
      return;
    }

    try {
      if (editLeadId) {
        const payload = {
          ...createLeadForm,
          leadValue: Number(createLeadForm.leadValue || 0),
          ownerId: createLeadForm.ownerId || null,
          tags: createLeadForm.tags
            ? createLeadForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
            : [],
          notes: createLeadForm.notes,
          sessionId: createLeadForm.sessionId
        };
        // Backend ignores or errors on email updates. Notes are only captured on creation in this form.
        delete payload.email;
        delete payload.notes;
        delete payload.websiteId;

        const updated = await api(`/api/crm/${editLeadId}`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        syncCustomerState(updated);
        setSelectedCustomer((prev) => prev ? { ...prev, ...updated } : prev);
        if (showDrawer && selectedCustomer?._id === editLeadId) {
           const refreshed = await api(`/api/crm/${editLeadId}`);
           setCustomerDetails(refreshed);
        }
        setActionMessage({ type: "success", text: "Lead updated successfully." });
      } else {
        const created = await api("/api/crm", {
          method: "POST",
          body: JSON.stringify({
            ...createLeadForm,
            websiteId: finalWebsiteId,
            leadValue: Number(createLeadForm.leadValue || 0),
            ownerId: createLeadForm.ownerId || null,
            tags: createLeadForm.tags
              ? createLeadForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
              : [],
            notes: createLeadForm.notes?.trim() || undefined
          })
        });
        setCustomers((prev) => [created, ...prev]);
        setPagination((prev) => ({ ...prev, total: (prev.total || 0) + 1 }));
        setActionMessage({ type: "success", text: "Lead created successfully." });
        openCustomer(created);
      }
      setShowCreateLead(false);
      resetCreateLeadForm();
    } catch (err) {
      setCreateLeadError(err.message || (editLeadId ? "Lead update failed." : "Lead creation failed"));
      setActionMessage({ type: "error", text: err.message || (editLeadId ? "Lead update failed." : "Lead creation failed.") });
    } finally {
      setCreatingLead(false);
    }
  };

  const autoAssignLead = async (customer) => {
    if (!customer?._id) return;
    setAutoAssigning(customer._id);
    try {
      const updated = await api(`/api/crm/${customer._id}/auto-assign`, { method: "POST" });
      syncCustomerState(updated);
      setSelectedCustomer((prev) => prev ? { ...prev, ...updated } : prev);
      if (showDrawer && selectedCustomer?._id === customer._id) {
        const refreshed = await api(`/api/crm/${customer._id}`);
        setCustomerDetails(refreshed);
      }
      setActionMessage({ type: "success", text: `Assigned to ${updated.ownerId?.name || "sales agent"}.` });
    } catch (err) {
      setActionMessage({ type: "error", text: err.message || "Auto-assign failed." });
    } finally {
      setAutoAssigning("");
    }
  };

  const archiveLead = async (customer) => {
    if (!customer?._id || !window.confirm(`Archive ${customer.name || "this lead"}? It will move to Lost / Inactive.`)) return;
    setRemovingLead(true);
    setRemoveLeadError("");
    try {
      const updated = await api(`/api/crm/${customer._id}/archive`, { method: "POST" });
      syncCustomerState(updated);
      setSelectedCustomer((prev) => prev ? { ...prev, ...updated } : prev);
      if (showDrawer && selectedCustomer?._id === customer._id) {
        const refreshed = await api(`/api/crm/${customer._id}`);
        setCustomerDetails(refreshed);
      }
      setActionMessage({ type: "success", text: "Lead archived successfully." });
    } catch (err) {
      setRemoveLeadError(err.message || "Failed to archive lead");
      setActionMessage({ type: "error", text: err.message || "Failed to archive lead." });
    } finally {
      setRemovingLead(false);
    }
  };

  const deleteLead = async (customer) => {
    if (!customer?._id || !window.confirm(`Delete ${customer.name || "this lead"} permanently? This cannot be undone.`)) return;
    setRemovingLead(true);
    setRemoveLeadError("");
    try {
      await api(`/api/crm/${customer._id}`, { method: "DELETE" });
      removeCustomerFromState(customer._id);
      setActionMessage({ type: "success", text: "Lead deleted permanently." });
    } catch (err) {
      setRemoveLeadError(err.message || "Failed to delete lead");
      setActionMessage({ type: "error", text: err.message || "Failed to delete lead." });
    } finally {
      setRemovingLead(false);
    }
  };

  return (
    <>
      <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700 relative">

        <section className="overflow-hidden rounded-[30px] border border-slate-200/80 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-5 py-5 md:px-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <TrendingUp size={12} className="text-indigo-500" />
                  Sales Workspace
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-950">Pipeline Management</h2>
                  <p className="mt-1 text-[11px] font-bold text-slate-500">
                    Manage opportunities, activities, ownership, and conversion signals from a single operating view.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:w-[540px]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Open Pipeline</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{pagination.total || customers.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Expected Value</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{formatCurrency(customers.reduce((sum, customer) => sum + Number(customer.leadValue || 0), 0))}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">Won Deals</p>
                  <p className="mt-2 text-lg font-black text-emerald-600">{summary.won || customers.filter((customer) => customer.pipelineStage === "won").length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">At Risk</p>
                  <p className="mt-2 text-lg font-black text-amber-600">{(summary.noFollowUp || 0) + (summary.dueToday || 0)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 py-5 md:px-6">
            <div className="mt-0 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
              {workspaceCards.map((card) => {
                const Icon = card.icon;
                const active = leadView === card.key;
                return (
                  <button
                    key={card.key}
                    type="button"
                    onClick={() => setLeadView(card.key)}
                    className={`rounded-2xl border px-4 py-4 text-left transition-all ${active ? "border-slate-900 bg-slate-900 text-white shadow-md" : "border-slate-200 bg-slate-50 hover:bg-white"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className={`text-[9px] font-black uppercase tracking-[0.18em] ${active ? "text-slate-300" : "text-slate-400"}`}>{card.label}</p>
                        <p className={`mt-2 text-2xl font-black ${active ? "text-white" : "text-slate-950"}`}>{card.value}</p>
                        <p className={`mt-1 text-[10px] font-bold ${active ? "text-slate-400" : "text-slate-500"}`}>{card.helper}</p>
                      </div>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${active ? "bg-white/10 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
                        <Icon size={16} />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Search & Filter */}
            <div className="mt-5 flex flex-col items-center justify-between gap-4 md:flex-row">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name, email, or CRN…"
                  className="w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/5"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-700 outline-none transition-all focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/5"
              >
                <option value="">All statuses</option>
                <option value="prospect">Prospect</option>
                <option value="lead">Lead</option>
                <option value="customer">Customer</option>
                <option value="inactive">Inactive</option>
              </select>
              <div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 p-1.5 self-stretch md:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode("board")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${viewMode === "board" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <LayoutGrid size={13} />
                  Pipeline
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${viewMode === "list" ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:text-slate-800"
                    }`}
                >
                  <List size={13} />
                  List
                </button>
              </div>
              {canCreateLead ? (
                <button
                  type="button"
                  onClick={() => {
                    resetCreateLeadForm();
                    setShowCreateLead(true);
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700"
                >
                  <Plus size={14} />
                  New Opportunity
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {!loading && customers.length > 0 && <CRMPipelineBar customers={customers} />}

        {actionMessage.text ? (
          <div className={`rounded-2xl border px-5 py-4 text-[11px] font-bold ${actionMessage.type === "error"
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
            {actionMessage.text}
          </div>
        ) : null}

        {viewMode === "board" && canManagePipeline ? (
          <div className="px-1">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
              Drag and drop CRM cards between lanes to update lead stage.
            </p>
          </div>
        ) : null}

        {viewMode === "board" ? (
          <div className="overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin]">
            <div className="flex items-start gap-4 min-w-max pr-2 snap-x snap-mandatory">
              {boardColumns.map((column, index) => {
                const columnCustomers = customers.filter((customer) => (customer.pipelineStage || "new") === column.key);
                const columnValue = columnCustomers.reduce((sum, customer) => sum + Number(customer.leadValue || 0), 0);
                return (
                  <section key={column.key} className="w-[340px] shrink-0 snap-start rounded-[28px] border border-slate-200 bg-white shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${column.tone} text-white flex items-center justify-center font-black shadow-lg shrink-0`}>
                          {columnCustomers.length}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{column.label}</h3>
                            {index > 0 && customers.length > 0 && (
                              <div className="text-[9px] font-black text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100 flex items-center gap-1">
                                {Math.round((columnCustomers.length / customers.filter(c => !c.archivedAt).length) * 100)}% <span className="text-[7px] opacity-60">OF TOTAL</span>
                              </div>
                            )}
                          </div>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em]">{columnCustomers.length} records</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-black text-slate-950 tracking-tight">{formatCurrency(columnValue)}</p>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Value</p>
                      </div>
                    </div>
                    <div
                      onDragOver={(e) => {
                        if (!canManagePipeline) return;
                        e.preventDefault();
                        setDropTargetStatus(column.key);
                      }}
                      onDragLeave={() => {
                        if (dropTargetStatus === column.key) setDropTargetStatus("");
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleBoardDrop(column.key);
                      }}
                      className={`p-3 space-y-3 min-h-[500px] max-h-[760px] overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.95),rgba(255,255,255,1))] transition-colors ${dropTargetStatus === column.key ? "bg-indigo-50/60" : ""
                        }`}
                    >
                      {columnCustomers.length === 0 ? (
                        <div className={`h-40 border-2 border-dashed rounded-[22px] flex items-center justify-center text-center px-6 transition-colors ${dropTargetStatus === column.key ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200"
                          }`}>
                          <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No records in this stage</p>
                        </div>
                      ) : columnCustomers.map((customer) => (
                        <article
                          key={customer._id}
                          draggable={canManagePipeline}
                          onDragStart={() => setDraggedCustomerId(customer._id)}
                          onDragEnd={() => {
                            setDraggedCustomerId("");
                            setDropTargetStatus("");
                          }}
                          onClick={() => openCustomer(customer)}
                          className={`rounded-[22px] border bg-white p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer group relative ${draggedCustomerId === customer._id ? "border-indigo-300 opacity-70 scale-[0.98]" : "border-slate-200"} ${
                            new Date().getTime() - new Date(customer.lastInteraction).getTime() > 5 * 24 * 60 * 60 * 1000 
                              ? "ring-2 ring-amber-400/30 ring-offset-2 animate-pulse-subtle bg-amber-50/10" 
                              : ""
                          }`}
                        >
                          {new Date().getTime() - new Date(customer.lastInteraction).getTime() > 5 * 24 * 60 * 60 * 1000 && (
                            <div className="absolute -top-2 -left-2 bg-amber-500 text-white text-[7px] font-black uppercase tracking-widest px-2 py-1 rounded-lg shadow-lg z-10">
                              Stale
                            </div>
                          )}
                          <div className="flex items-start justify-between gap-3 mb-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                                {customer.name?.[0]?.toUpperCase() || "U"}
                              </div>
                              <div className="min-w-0">
                                <h4 className="text-[12px] font-black text-slate-950 tracking-tight truncate">{customer.name}</h4>
                                <p className="text-[10px] text-slate-400 font-bold truncate">{customer.companyName || customer.email}</p>
                              </div>
                            </div>
                            <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                          </div>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <LeadStatusBadge status={customer.status} />
                                <span className={`px-2 py-0.5 rounded-lg text-[7px] font-black uppercase tracking-widest border ${
                                  customer.priority === "high" ? "bg-rose-50 text-rose-500 border-rose-100" :
                                  customer.priority === "medium" ? "bg-indigo-50 text-indigo-500 border-indigo-100" :
                                  "bg-slate-100 text-slate-400 border-slate-200"
                                }`}>
                                  {customer.priority || "Med"}
                                </span>
                              </div>
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest shrink-0">
                                {customer.crn || "No CRN"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                                 <HeatIndicator score={customer.heatScore || 0} />
                                 <div className="flex -space-x-2">
                                    {customer.ownerId ? (
                                      <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black" title={customer.ownerId.name}>
                                         {customer.ownerId.name[0]}
                                      </div>
                                    ) : (
                                      <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-50 flex items-center justify-center text-slate-300">
                                         <User size={10} />
                                      </div>
                                    )}
                                 </div>
                              </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Expected Value</p>
                                <p className="mt-1 text-[11px] font-black text-slate-900">{formatCurrency(customer.leadValue)}</p>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-[8px] font-black uppercase tracking-[0.16em] text-slate-400">Next Activity</p>
                                <p className="mt-1 text-[11px] font-black text-slate-900">{customer.nextFollowUpAt ? formatCompactDate(customer.nextFollowUpAt) : "Not planned"}</p>
                              </div>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 space-y-2">
                              <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.16em]">
                                <span className="text-slate-400">Owner</span>
                                <span className="text-slate-700 truncate text-right">{customer.ownerId?.name || "Unassigned"}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.16em]">
                                <span className="text-slate-400">Source</span>
                                <span className="text-slate-700 truncate text-right">{customer.leadSource || "Manual"}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.16em]">
                                <span className="text-slate-400">Last touch</span>
                                <span className="text-slate-700 truncate text-right">{formatCompactDate(customer.lastInteraction)}</span>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {customer.tags?.length > 0 ? customer.tags.slice(0, 3).map((tag) => (
                                <span key={tag} className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 text-slate-500 text-[8px] font-black uppercase tracking-[0.16em]">
                                  {tag}
                                </span>
                              )) : (
                                <span className="text-[9px] font-bold text-slate-300">No tags</span>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Lead Register</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.18em] mt-0.5">{pagination.total || customers.length} records in current scope</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                {leadView.replaceAll("_", " ")}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white border-b border-slate-200">
                    <th className="px-6 py-4 small-label">Opportunity</th>
                    <th className="px-6 py-4 small-label">Heat</th>
                    <th className="px-6 py-4 small-label">Stage</th>
                    <th className="px-6 py-4 small-label">Status</th>
                    <th className="px-6 py-4 small-label">Owner</th>
                    <th className="px-6 py-4 small-label">Source</th>
                    <th className="px-6 py-4 small-label">Expected Revenue</th>
                    <th className="px-6 py-4 small-label">Next Activity</th>
                    <th className="px-6 py-4 small-label">Updated</th>
                    <th className="px-6 py-4 small-label" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td colSpan={9} className="px-6 py-6">
                          <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
                        </td>
                      </tr>
                    ))
                  ) : customers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-8 py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
                            <User size={20} className="text-slate-300" />
                          </div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No customers found</p>
                          <p className="text-[10px] text-slate-300 font-bold">Customers are created automatically when visitors start a chat.</p>
                        </div>
                      </td>
                    </tr>
                  ) : customers.map((c) => (
                    <tr
                      key={c._id}
                      onClick={() => openCustomer(c)}
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer group"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black text-sm shadow-lg shadow-indigo-200 shrink-0">
                            {c.name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{c.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${c.status === "customer" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                          c.status === "lead" ? "bg-sky-50 text-sky-600 border-sky-100" :
                            c.status === "prospect" ? "bg-indigo-50 text-indigo-600 border-indigo-100" :
                              "bg-slate-100 text-slate-400 border-slate-200"
                          }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-[9px] font-black text-indigo-500 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 tracking-widest uppercase">
                          {c.crn || "—"}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div>
                          <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                            {c.ownerId?.name || "Unassigned"}
                          </p>
                          <p className="text-[9px] text-slate-400 font-bold">
                            {c.ownerId?.role || "needs routing"}
                          </p>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-1">
                          {c.tags?.length > 0
                            ? c.tags.slice(0, 2).map(t => (
                              <span key={t} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-tighter">{t}</span>
                            ))
                            : <span className="text-[9px] text-slate-300 italic">No tags</span>
                          }
                          {c.tags?.length > 2 && <span className="text-[8px] font-bold text-slate-400">+{c.tags.length - 2}</span>}
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                          {new Date(c.lastInteraction).toLocaleDateString()}
                        </p>
                        <p className="text-[9px] text-slate-400 font-bold">
                          {new Date(c.lastInteraction).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <div className="w-8 h-8 rounded-full hover:bg-indigo-50 flex items-center justify-center text-slate-300 group-hover:text-indigo-500 transition-all ml-auto">
                          <ChevronRight size={18} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        )}

        <PaginationControls
          currentPage={pagination.page || 1}
          totalPages={pagination.pages || 1}
          totalItems={pagination.total || customers.length}
          itemLabel="customers"
          onPageChange={fetchCustomers}
        />
      </div>

      {/* ── Customer Intelligence Drawer ── */}
      {showDrawer && createPortal(
        <>
          <div
            className="fixed inset-0 bg-slate-950/20 backdrop-blur-[2px] z-[99] animate-in fade-in duration-300"
            onClick={() => setShowDrawer(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-full md:w-[860px] bg-white border-l border-slate-200 z-[100] shadow-[0_0_50px_rgba(0,0,0,0.15)] overflow-hidden animate-in slide-in-from-right duration-500 flex flex-col">

            {/* Drawer Header */}
            <div className="px-5 py-5 md:px-8 border-b border-slate-100 flex items-start justify-between gap-4 bg-white shrink-0">
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center font-black text-xl shadow-xl shadow-indigo-500/20 shrink-0">
                  {selectedCustomer?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight truncate">
                      {selectedCustomer?.name}
                    </h3>
                    {selectedCustomer?.priority && (
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${
                        selectedCustomer.priority === "high" ? "bg-rose-50 text-rose-600 border-rose-100" :
                        selectedCustomer.priority === "medium" ? "bg-amber-50 text-amber-600 border-amber-100" :
                        "bg-slate-50 text-slate-500 border-slate-200"
                      }`}>
                        {selectedCustomer.priority}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">
                      {selectedCustomer?.crn}
                    </p>
                    {selectedCustomer?.email && (
                      <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                        <Mail size={10} /> {selectedCustomer.email}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {canEditCRM && (
                  <button
                    onClick={openEditLead}
                    className="p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all border border-transparent hover:border-indigo-100"
                  >
                    <PlusCircle size={20} />
                  </button>
                )}
                <button
                  onClick={() => setShowDrawer(false)}
                  className="p-2.5 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable Context Wrapper */}
            <div className="flex-1 overflow-y-auto bg-slate-50/40 custom-scrollbar">
              {/* Quick Stats Banner */}
              <div className="px-5 py-4 md:px-8 border-b border-slate-100 bg-white grid grid-cols-4 gap-4 sticky top-0 z-[11]">
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Pipeline Stage</p>
                  <CRMStageBadge stage={selectedCustomer?.status} />
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Est. Value</p>
                  <p className="text-xs font-black text-slate-900">{formatCurrency(selectedCustomer?.leadValue)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Conversion</p>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-12 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: "65%" }} />
                    </div>
                    <span className="text-[10px] font-black text-indigo-600">65%</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Chats</p>
                  <p className="text-xs font-black text-slate-900">{customerDetails?.sessions?.length || 0}</p>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-slate-100 bg-white sticky top-[65px] z-10 overflow-x-auto scrollbar-hide">
                {[
                  { key: "tickets", label: "Tickets", icon: TicketIcon, badge: customerDetails?.tickets?.length },
                  { key: "chats", label: "Chats", icon: MessageCircle, badge: customerDetails?.sessions?.length },
                  { key: "notes", label: "Notes", icon: Tag, badge: customerDetails?.customer?.internalNotes?.length },
                  { key: "tasks", label: "Tasks", icon: Clock, badge: customerDetails?.tasks?.length },
                  { key: "journey", label: "Journey", icon: Zap },
                  { key: "activity", label: "Timeline", icon: Calendar },
                  { key: "actions", label: "Actions", icon: Zap }
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setDrawerTab(t.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-4 px-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all min-w-[110px] ${
                      drawerTab === t.key
                        ? "border-indigo-600 text-indigo-600 bg-indigo-50/10"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <t.icon size={12} />
                    {t.label}
                    {t.badge > 0 && (
                      <span className={`w-4 h-4 rounded-full text-[8px] flex items-center justify-center ${
                        drawerTab === t.key ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"
                      }`}>
                        {t.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Drawer Content Container Starts Here */}
              <div className="p-5 md:p-8 space-y-6">
                {loadingDetails ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <span className="animate-spin w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">Synchronizing intelligence…</p>
                  </div>
                ) : (
                  <>
                    {/* ── TICKETS TAB ── */}
                    {drawerTab === "tickets" && (
                      <div className="space-y-3">
                        {customerDetails?.tickets?.length > 0 ? customerDetails.tickets.map(ticket => (
                          <div key={ticket._id} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:border-indigo-200 transition-all">
                            <div className="flex justify-between items-start mb-3">
                              <TicketStatusBadge status={ticket.status} />
                              <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                            </div>
                            <h4 className="text-xs font-black text-slate-900 mb-1">{ticket.subject}</h4>
                            <p className="text-[10px] font-medium text-slate-500 line-clamp-2">{ticket.description}</p>
                          </div>
                        )) : (
                          <div className="py-20 text-center space-y-3">
                            <TicketIcon size={32} className="mx-auto text-slate-200" />
                            <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">No tickets linked</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── CHATS TAB ── */}
                    {drawerTab === "chats" && (
                      <div className="space-y-3">
                        {customerDetails?.sessions?.length > 0 ? customerDetails.sessions.map(session => (
                          <div key={session._id} className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center justify-between shadow-sm hover:border-indigo-200 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <MessageCircle size={18} />
                              </div>
                              <div>
                                <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{session.sessionId?.substring(0, 12)}…</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{new Date(session.createdAt).toLocaleDateString()}</p>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300" />
                          </div>
                        )) : (
                          <div className="py-20 text-center space-y-3">
                            <MessageCircle size={32} className="mx-auto text-slate-200" />
                            <p className="text-[10px] font-black uppercase text-slate-300 tracking-widest">No chat history</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── NOTES TAB ── */}
                    {drawerTab === "notes" && (
                      <div className="space-y-6">
                        <div className="bg-white rounded-2xl border border-indigo-100 p-5 shadow-sm">
                          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-indigo-500 mb-3">Add Internal Note</p>
                          <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Record key lead requirements or conversation highlights..."
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all resize-none shadow-sm"
                          />
                          <div className="flex justify-end mt-3">
                            <button
                              onClick={addNote}
                              disabled={savingNote || !newNote.trim()}
                              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-lg shadow-indigo-100"
                            >
                              {savingNote ? "Recording..." : "Add Note"}
                            </button>
                          </div>
                        </div>
                        <div className="space-y-3">
                          {customerDetails?.customer?.internalNotes?.length > 0 ? (
                            [...customerDetails.customer.internalNotes].reverse().map((note, idx) => (
                              <div key={idx} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                <p className="text-[11px] font-medium text-slate-700 leading-relaxed mb-4">{note.text}</p>
                                <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{note.authorName}</span>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(note.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="py-12 text-center text-slate-300">
                              <Tag size={24} className="mx-auto mb-2 opacity-50" />
                              <p className="text-[10px] font-black uppercase tracking-widest">No notes recorded</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ── TASKS TAB ── */}
                    {drawerTab === "tasks" && (
                      <div className="space-y-4">
                        {customerDetails?.tasks?.length > 0 ? customerDetails.tasks.map(task => (
                          <div key={task._id} className={`bg-white rounded-2xl border p-5 flex items-start gap-4 transition-all ${task.status === "completed" ? "bg-slate-50 opacity-60" : "border-slate-100 shadow-sm"}`}>
                            <button
                              onClick={() => task.status !== "completed" && updateTaskStatus(task._id, "completed")}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all shrink-0 ${
                                task.status === "completed" ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-200 text-transparent hover:border-indigo-400"
                              }`}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-4 mb-2">
                                <p className={`text-[11px] font-black uppercase tracking-tight ${task.status === "completed" ? "line-through text-slate-400" : "text-slate-900"}`}>{task.title}</p>
                                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest">{task.type}</span>
                              </div>
                              <div className="flex items-center gap-3 text-slate-400 text-[9px] font-bold uppercase">
                                <span className="flex items-center gap-1"><Calendar size={10} /> {new Date(task.dueAt).toLocaleDateString()}</span>
                                <span className="flex items-center gap-1"><Clock size={10} /> {task.status}</span>
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="py-16 text-center text-slate-300">
                            <Clock size={32} className="mx-auto mb-3 opacity-20" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Zero scheduled actions</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── JOURNEY TAB ── */}
                    {drawerTab === "journey" && (
                      <div className="space-y-4">
                        <div className="bg-teal-50 border border-teal-100 rounded-3xl p-6 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-teal-600 mb-1">Intent Intelligence</p>
                            <h4 className="text-sm font-black text-teal-900 uppercase tracking-tight">Visitor Website Journey</h4>
                          </div>
                          <Zap size={24} className="text-teal-400" />
                        </div>
                        <ActivityTimeline 
                          items={customerDetails?.activity?.filter(a => a.type === "page_view") || []} 
                          emptyLabel="No page journey recorded yet." 
                        />
                      </div>
                    )}

                    {/* ── TIMELINE TAB ── */}
                    {drawerTab === "activity" && (
                      <div className="bg-white rounded-3xl border border-slate-100 p-2 shadow-sm min-h-[400px]">
                        <ActivityTimeline items={customerDetails?.activity?.filter(a => a.type !== "page_view") || []} />
                      </div>
                    )}

                    {/* ── ACTIONS TAB ── */}
                    {drawerTab === "actions" && (
                      <div className="space-y-6 pb-12">
                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
                              <Phone size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Log Interaction</p>
                              <p className="text-[9px] font-bold text-slate-400">Record a phone call, meeting or email.</p>
                            </div>
                          </div>
                          <form onSubmit={logManualInteraction} className="space-y-4">
                            <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                              {["call", "meeting", "manual_email"].map(type => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setInteractionType(type)}
                                  className={`flex-1 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    interactionType === type ? "bg-white text-indigo-600 shadow-sm" : "text-slate-400"
                                  }`}
                                >
                                  {type === "manual_email" ? "Email" : type}
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={interactionNote}
                              onChange={(e) => setInteractionNote(e.target.value)}
                              placeholder={`What was the outcome of this ${interactionType}?`}
                              rows={3}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all resize-none shadow-sm"
                              required
                            />
                            <button
                              type="submit"
                              disabled={interactionSaving || !interactionNote.trim()}
                              className="w-full py-3.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.22em] hover:bg-slate-800 transition-all shadow-xl disabled:opacity-50"
                            >
                              {interactionSaving ? "Recording..." : "Log Interaction"}
                            </button>
                          </form>
                        </div>

                        <div className="bg-white rounded-2xl border border-amber-100 p-6 shadow-sm">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
                              <Clock size={18} />
                            </div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Schedule Task</p>
                              <p className="text-[9px] font-bold text-slate-400">Plan a follow-up action for this lead.</p>
                            </div>
                          </div>
                          <form onSubmit={createTask} className="space-y-5">
                            <div className="space-y-1.5">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Action Description</label>
                              <input
                                value={taskForm.title}
                                onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                                placeholder="e.g. Discuss proposal breakdown"
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-amber-500/5"
                                required
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Type</label>
                                <select
                                  value={taskForm.type}
                                  onChange={(e) => setTaskForm(prev => ({ ...prev, type: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-amber-500/5"
                                >
                                  <option value="call">Call</option>
                                  <option value="email">Email</option>
                                  <option value="meeting">Meeting</option>
                                  <option value="task">General</option>
                                </select>
                              </div>
                              <div className="space-y-1.5">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Due Date</label>
                                <input
                                  type="date"
                                  value={taskForm.dueAt}
                                  onChange={(e) => setTaskForm(prev => ({ ...prev, dueAt: e.target.value }))}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-[11px] text-[10px] font-black uppercase outline-none focus:ring-4 focus:ring-amber-500/5"
                                  required
                                />
                              </div>
                            </div>
                            <button
                              type="submit"
                              disabled={taskSaving || !taskForm.title.trim() || !taskForm.dueAt}
                              className="w-full py-3.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-[0.22em] hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                            >
                              {taskSaving ? "Scheduling..." : "Create Action Task"}
                            </button>
                          </form>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}


      {/* ── CREATE / EDIT LEAD MODAL ── */}
      {showCreateLead && createPortal(
        <>
          <div
            className="fixed inset-0 bg-slate-950/20 backdrop-blur-sm z-[99] animate-in fade-in duration-300"
            onClick={() => {
              setShowCreateLead(false);
              resetCreateLeadForm();
            }}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-full md:w-[680px] bg-white border-l border-slate-200 z-[100] shadow-[0_0_60px_rgba(0,0,0,0.2)] flex flex-col animate-in slide-in-from-right duration-500">
            <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.25em] text-slate-900">{editLeadId ? "Refine Lead" : "Inject Lead"}</h3>
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mt-1">Populate the pipeline with high-fidelity customer intelligence.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateLead(false);
                  resetCreateLeadForm();
                }}
                className="p-3 rounded-2xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={submitCreateLead} className="p-8 space-y-10 overflow-y-auto flex-1 custom-scrollbar">
              {/* Identity Section */}
              <div className="space-y-5">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] flex items-center gap-2">Identity & Reach</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Full Name ⭐</label>
                    <input
                      value={createLeadForm.name}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g. Siddharth Malhotra"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email Address ⭐</label>
                    <input
                      type="email"
                      value={createLeadForm.email}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="siddharth@company.com"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 disabled:opacity-50"
                      required
                      disabled={!!editLeadId}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone Number ⭐</label>
                    <input
                      value={createLeadForm.phone}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+91 91234 56789"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Organization</label>
                    <input
                      value={createLeadForm.companyName}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, companyName: e.target.value }))}
                      placeholder="Zen Global"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5"
                    />
                  </div>
                </div>
              </div>

              {/* Qualification Section */}
              <div className="space-y-5">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] flex items-center gap-2">Qualification</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Source ⭐</label>
                    <select
                      value={createLeadForm.leadSource}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, leadSource: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5"
                      required
                    >
                      <option value="">Select source...</option>
                      <option value="website">Website</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="facebook">Facebook Ads</option>
                      <option value="google">Google Ads</option>
                      <option value="referral">Referral</option>
                      <option value="manual">Manual</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Priority ⭐</label>
                    <select
                      value={createLeadForm.priority}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5"
                      required
                    >
                      <option value="low">Low Priority</option>
                      <option value="medium">Medium Priority</option>
                      <option value="high">High Priority</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Revenue & Assignment */}
              <div className="space-y-5">
                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.4em] flex items-center gap-2">Financial Weight & Ownership</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Est. Value (₹)</label>
                    <input
                      type="number"
                      value={createLeadForm.leadValue}
                      onChange={(e) => setCreateLeadForm(prev => ({ ...prev, leadValue: e.target.value }))}
                      placeholder="0.00"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5"
                    />
                  </div>
                  {canAssignOwners && (
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assign Lead To</label>
                      <select
                        value={createLeadForm.ownerId}
                        onChange={(e) => setCreateLeadForm(prev => ({ ...prev, ownerId: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3.5 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 appearance-none"
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.filter(m => ["sales", "manager"].includes(m.role)).map(m => (
                          <option key={m._id} value={m._id}>{m.name} ({m.role})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Insight / Requirements</label>
                <textarea
                  value={createLeadForm.notes}
                  onChange={(e) => setCreateLeadForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={4}
                  placeholder="Record strategic context or requirements..."
                  className="w-full bg-slate-50 border border-slate-100 rounded-3xl p-5 text-xs font-medium outline-none focus:ring-4 focus:ring-indigo-500/5 transition-all resize-none shadow-sm"
                />
              </div>

              <div className="flex gap-4 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateLead(false);
                    resetCreateLeadForm();
                  }}
                  className="flex-1 py-4 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 hover:bg-slate-50 transition-all font-black"
                >
                  Discard
                </button>
                <button
                  type="submit"
                  disabled={creatingLead}
                  className="flex-[2] py-4 rounded-2xl bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em] hover:bg-slate-800 transition-all shadow-2xl disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  {creatingLead ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (editLeadId ? "Update Lead" : "Deploy Lead")}
                </button>
              </div>
            </form>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
