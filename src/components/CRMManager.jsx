import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import PaginationControls from "./PaginationControls.jsx";
import ActivityTimeline from "./ActivityTimeline.jsx";
import { hasPermission } from "../utils/permissions.js";
import { PERMISSIONS } from "../constants/domain.js";
import {
  Search, Filter, User, Calendar, Tag, ChevronRight, MessageCircle,
  Ticket as TicketIcon, X, Plus, Save, ArrowRight, Clock, CheckCircle2,
  AlertCircle, Circle, TrendingUp, ExternalLink, LayoutGrid, List, Send
} from "lucide-react";

const CRM_STAGE_CONFIG = {
  new:         { label: "New",         color: "bg-violet-50 text-violet-600 border-violet-100", dot: "bg-violet-500" },
  qualified:   { label: "Qualified",   color: "bg-indigo-50 text-indigo-600 border-indigo-100", dot: "bg-indigo-500" },
  hold:        { label: "Hold",        color: "bg-slate-100 text-slate-500 border-slate-200", dot: "bg-slate-400" },
  proposition: { label: "Proposition", color: "bg-amber-50 text-amber-600 border-amber-100",  dot: "bg-amber-500" },
  won:         { label: "Won",         color: "bg-emerald-50 text-emerald-600 border-emerald-100", dot: "bg-emerald-500" },
  lost:        { label: "Lost",        color: "bg-red-50 text-red-500 border-red-100",         dot: "bg-red-400" }
};

const TICKET_STATUS_CONFIG = {
  open:       { label: "Open",       color: "bg-emerald-50 text-emerald-600 border-emerald-100", icon: Circle },
  pending:    { label: "Pending",    color: "bg-amber-50 text-amber-600 border-amber-100",       icon: Clock },
  resolved:   { label: "Resolved",   color: "bg-slate-100 text-slate-500 border-slate-200",     icon: CheckCircle2 },
  closed:     { label: "Closed",     color: "bg-slate-100 text-slate-400 border-slate-100",     icon: CheckCircle2 },
};

const PRIORITY_CONFIG = {
  low:    { color: "text-slate-400", label: "Low" },
  medium: { color: "text-sky-500",   label: "Medium" },
  high:   { color: "text-amber-500", label: "High" },
  urgent: { color: "text-red-500",   label: "Urgent" },
};

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

export default function CRMManager({ websiteId = "" }) {
  const { user } = useAuth();
  const canEditCRM = hasPermission(user, PERMISSIONS.CRM_UPDATE);
  const canAssignOwners = hasPermission(user, PERMISSIONS.CRM_ASSIGN_OWNER);
  const canSendSalesEmail = hasPermission(user, PERMISSIONS.CRM_SEND_EMAIL);
  const canManagePipeline = hasPermission(user, PERMISSIONS.CRM_UPDATE);
  const canCreateLead = hasPermission(user, PERMISSIONS.CRM_CREATE);
  const canArchiveLead = hasPermission(user, PERMISSIONS.CRM_ARCHIVE);
  const canDeleteLead = hasPermission(user, PERMISSIONS.CRM_DELETE);
  const canManageTasks = hasPermission(user, PERMISSIONS.CRM_MANAGE_TASKS);
  const [viewMode, setViewMode]             = useState("board");
  const [customers, setCustomers]           = useState([]);
  const [summary, setSummary]               = useState({});
  const [teamMembers, setTeamMembers]       = useState([]);
  const [websites, setWebsites]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState("");
  const [statusFilter, setStatusFilter]     = useState("");
  const [leadView, setLeadView]             = useState("all");
  const [pagination, setPagination]         = useState({ page: 1, pages: 1, total: 0 });
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showDrawer, setShowDrawer]         = useState(false);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [newNote, setNewNote]               = useState("");
  const [drawerTab, setDrawerTab]           = useState("tickets"); // "tickets" | "chats" | "notes"
  const [savingNote, setSavingNote]         = useState(false);
  const [noteSuccess, setNoteSuccess]       = useState(false);
  const [ownerUpdateError, setOwnerUpdateError] = useState("");
  const [emailDraft, setEmailDraft]         = useState({ subject: "", body: "" });
  const [sendingEmail, setSendingEmail]     = useState(false);
  const [emailSuccess, setEmailSuccess]     = useState(false);
  const [emailError, setEmailError]         = useState("");
  const [emailAttachment, setEmailAttachment] = useState(null);
  const [draggedCustomerId, setDraggedCustomerId] = useState("");
  const [dropTargetStatus, setDropTargetStatus] = useState("");
  const [showCreateLead, setShowCreateLead] = useState(false);
  const [creatingLead, setCreatingLead]     = useState(false);
  const [createLeadError, setCreateLeadError] = useState("");
  const [removeLeadError, setRemoveLeadError] = useState("");
  const [removingLead, setRemovingLead]     = useState(false);
  const [actionMessage, setActionMessage]   = useState({ type: "", text: "" });
  const [taskForm, setTaskForm]             = useState({ title: "", type: "follow_up", dueAt: "", notes: "" });
  const [taskSaving, setTaskSaving]         = useState(false);
  const [createLeadForm, setCreateLeadForm] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    leadSource: "",
    leadValue: 0,
    expectedCloseDate: "",
    websiteId: websiteId || "",
    status: "lead",
    pipelineStage: "new",
    ownerId: "",
    tags: ""
  });

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

  const openTicketCount = customerDetails?.tickets?.filter(t => ["open", "pending", "in_progress"].includes(t.status)).length || 0;
  const boardColumns = [
    { key: "new", label: "New", tone: "from-violet-500 to-fuchsia-500" },
    { key: "qualified", label: "Qualified", tone: "from-indigo-500 to-sky-500" },
    { key: "hold", label: "Hold", tone: "from-slate-400 to-slate-500" },
    { key: "proposition", label: "Proposition", tone: "from-amber-500 to-orange-500" },
    { key: "won", label: "Won", tone: "from-emerald-500 to-teal-500" },
    { key: "lost", label: "Lost", tone: "from-rose-500 to-red-500" }
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
      status: "lead",
      pipelineStage: "new",
      ownerId: "",
      tags: ""
    });
    setCreateLeadError("");
  };

  const submitCreateLead = async (e) => {
    e.preventDefault();
    setCreatingLead(true);
    setCreateLeadError("");
    try {
      const created = await api("/api/crm", {
        method: "POST",
        body: JSON.stringify({
          ...createLeadForm,
          leadValue: Number(createLeadForm.leadValue || 0),
          ownerId: createLeadForm.ownerId || null,
          tags: createLeadForm.tags
            ? createLeadForm.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
            : []
        })
      });
      setCustomers((prev) => [created, ...prev]);
      setPagination((prev) => ({ ...prev, total: (prev.total || 0) + 1 }));
      setShowCreateLead(false);
      resetCreateLeadForm();
      setActionMessage({ type: "success", text: "Lead created successfully." });
      openCustomer(created);
    } catch (err) {
      setCreateLeadError(err.message || "Lead creation failed");
      setActionMessage({ type: "error", text: err.message || "Lead creation failed." });
    } finally {
      setCreatingLead(false);
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
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700 relative">

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        {[
          { key: "all", label: "All Leads", value: pagination.total || customers.length },
          { key: "my_leads", label: "My Leads", value: summary.myLeads || 0 },
          { key: "due_today", label: "Due Today", value: summary.dueToday || 0 },
          { key: "no_follow_up", label: "No Follow-up", value: summary.noFollowUp || 0 },
          { key: "archived", label: "Archived", value: summary.archived || 0 }
        ].map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setLeadView(card.key)}
            className={`rounded-[24px] border px-5 py-4 text-left transition-all ${
              leadView === card.key ? "border-indigo-200 bg-indigo-50 shadow-sm" : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">{card.label}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{card.value}</p>
          </button>
        ))}
      </div>

      {/* Pipeline Summary */}
      {!loading && customers.length > 0 && <CRMPipelineBar customers={customers} />}

      {actionMessage.text ? (
        <div className={`rounded-2xl border px-5 py-4 text-[11px] font-bold ${
          actionMessage.type === "error"
            ? "border-red-200 bg-red-50 text-red-600"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {actionMessage.text}
        </div>
      ) : null}

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-5 rounded-[28px] border border-slate-200/60 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, or CRN…"
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-11 pr-4 py-3 text-xs font-bold focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300 outline-none transition-all placeholder:text-slate-300"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500/10"
        >
          <option value="">All Statuses</option>
          <option value="prospect">Prospect</option>
          <option value="lead">Lead</option>
          <option value="customer">Customer</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
          View: {leadView.replaceAll("_", " ")}
        </div>
        <div className="flex items-center bg-slate-50 border border-slate-100 rounded-2xl p-1.5 self-stretch md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              viewMode === "board" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-700"
            }`}
          >
            <LayoutGrid size={13} />
            Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
              viewMode === "list" ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-700"
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
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] transition-all flex items-center gap-2 shadow-lg shadow-indigo-100"
          >
            <Plus size={14} />
            Create Lead
          </button>
        ) : null}
      </div>

      {viewMode === "board" && canManagePipeline ? (
        <div className="px-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.18em]">
            Drag and drop CRM cards between lanes to update lead stage.
          </p>
        </div>
      ) : null}

      {viewMode === "board" ? (
        <div className="overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:thin]">
        <div className="flex items-start gap-6 min-w-max pr-2 snap-x snap-mandatory">
          {boardColumns.map((column) => {
            const columnCustomers = customers.filter((customer) => (customer.pipelineStage || "new") === column.key);
            return (
              <section key={column.key} className="w-[320px] shrink-0 snap-start rounded-[32px] border border-slate-200/70 bg-white shadow-sm overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/70">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl bg-gradient-to-br ${column.tone} text-white flex items-center justify-center font-black shadow-lg`}>
                      {columnCustomers.length}
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">{column.label}</h3>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{columnCustomers.length} records</p>
                    </div>
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
                  className={`p-4 space-y-4 min-h-[420px] max-h-[720px] overflow-y-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(255,255,255,1))] transition-colors ${
                    dropTargetStatus === column.key ? "bg-indigo-50/60" : ""
                  }`}
                >
                  {columnCustomers.length === 0 ? (
                    <div className={`h-40 border-2 border-dashed rounded-[28px] flex items-center justify-center text-center px-6 transition-colors ${
                      dropTargetStatus === column.key ? "border-indigo-300 bg-indigo-50/70" : "border-slate-200"
                    }`}>
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">No customers in this lane</p>
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
                      className={`rounded-[28px] border bg-white p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group ${
                        draggedCustomerId === customer._id ? "border-indigo-300 opacity-70 scale-[0.98]" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center font-black shadow-lg shrink-0">
                            {customer.name?.[0]?.toUpperCase() || "U"}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">{customer.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold truncate">{customer.email}</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-500 transition-colors shrink-0" />
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[8px] font-black text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-1 rounded-lg uppercase tracking-widest">
                            {customer.crn || "No CRN"}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {new Date(customer.lastInteraction).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {customer.tags?.length > 0 ? customer.tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[8px] font-black uppercase tracking-widest">
                              {tag}
                            </span>
                          )) : (
                            <span className="text-[9px] font-bold text-slate-300">No tags</span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-widest">
                          <span className="text-slate-400">Owner</span>
                          <span className="text-slate-700">{customer.ownerId?.name || "Unassigned"}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-widest">
                          <span className="text-slate-400">Stage</span>
                          <CRMStageBadge stage={customer.pipelineStage || "new"} />
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
      <div className="premium-card p-0 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h3 className="heading-md">Customer Registry</h3>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{pagination.total || customers.length} total entries</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-4 small-label">Customer</th>
                <th className="px-8 py-4 small-label">Status</th>
                <th className="px-8 py-4 small-label">CRN</th>
                <th className="px-8 py-4 small-label">Owner</th>
                <th className="px-8 py-4 small-label">Tags</th>
                <th className="px-8 py-4 small-label">Last Interaction</th>
                <th className="px-8 py-4 small-label" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={7} className="px-8 py-6">
                      <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
                    </td>
                  </tr>
                ))
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-8 py-20 text-center">
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
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                      c.status === "customer" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                      c.status === "lead"     ? "bg-sky-50 text-sky-600 border-sky-100"             :
                      c.status === "prospect" ? "bg-indigo-50 text-indigo-600 border-indigo-100"    :
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

      {/* ── Customer Intelligence Drawer ── */}
      {showDrawer && (
        <>
          <div
            className="fixed inset-0 bg-slate-950/20 z-[99]"
            onClick={() => setShowDrawer(false)}
          />
          <div className="fixed inset-x-3 top-3 bottom-3 md:left-auto md:right-4 md:w-[min(760px,calc(100vw-2rem))] bg-white border border-slate-200/80 z-[100] shadow-2xl rounded-[28px] overflow-hidden animate-in slide-in-from-right-full duration-400 flex flex-col">

            {/* Drawer Header */}
            <div className="px-5 py-4 md:px-6 md:py-5 border-b border-slate-100 flex items-start justify-between gap-4 bg-gradient-to-r from-slate-50/90 to-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white flex items-center justify-center font-black text-lg shadow-xl shadow-indigo-500/20 shrink-0">
                  {selectedCustomer?.name?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight leading-none mb-1 truncate">
                    {selectedCustomer?.name}
                  </h3>
                  <p className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.22em] truncate">
                    {selectedCustomer?.crn}
                  </p>
                  {selectedCustomer?.email && (
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">{selectedCustomer.email}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setShowDrawer(false)}
                className="p-2.5 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all shrink-0"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {/* Status + Stats Row */}
            <div className="px-5 py-4 md:px-6 border-b border-slate-100 bg-white">
              {(canArchiveLead || canDeleteLead) && selectedCustomer ? (
                <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                  {removeLeadError ? (
                    <p className="w-full text-[10px] font-bold text-red-500 text-right">{removeLeadError}</p>
                  ) : null}
                  {canArchiveLead ? (
                    <button
                      type="button"
                      onClick={() => archiveLead(selectedCustomer)}
                      disabled={removingLead}
                      className="px-4 py-2 rounded-xl border border-amber-200 bg-amber-50 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 disabled:opacity-50"
                    >
                      {removingLead ? "Working..." : "Archive"}
                    </button>
                  ) : null}
                  {canDeleteLead ? (
                    <button
                      type="button"
                      onClick={() => deleteLead(selectedCustomer)}
                      disabled={removingLead}
                      className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-[10px] font-black uppercase tracking-[0.18em] text-red-600 disabled:opacity-50"
                    >
                      {removingLead ? "Working..." : "Delete Permanently"}
                    </button>
                  ) : null}
                </div>
              ) : null}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                {/* Relationship stage */}
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline Stage</label>
                  <select
                    value={customerDetails?.customer?.pipelineStage || selectedCustomer?.pipelineStage || "new"}
                    onChange={(e) => updatePipelineStage(selectedCustomer._id, e.target.value)}
                    disabled={!canAssignOwners}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all text-indigo-600"
                  >
                    <option value="new">New</option>
                    <option value="qualified">Qualified</option>
                    <option value="hold">Hold</option>
                    <option value="proposition">Proposition</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                  {!canEditCRM ? (
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Read only for agent role</p>
                  ) : null}
                </div>
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relationship Status</label>
                  <select
                    value={customerDetails?.customer?.status || selectedCustomer?.status}
                    onChange={(e) => updateStatus(selectedCustomer._id, e.target.value)}
                    disabled={!canAssignOwners}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all text-slate-700"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="lead">Lead</option>
                    <option value="customer">Customer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2 md:col-span-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CRM Owner</label>
                  <select
                  value={String(customerDetails?.customer?.ownerId?._id || "")}
                  onChange={(e) => updateOwner(selectedCustomer._id, e.target.value)}
                  disabled={!canAssignOwners}
                    className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all text-indigo-600"
                  >
                    <option value="">Unassigned</option>
                    {crmOwners.map((owner) => (
                      <option key={owner._id} value={owner._id}>{owner.name} ({owner.role})</option>
                    ))}
                  </select>
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                    {customerDetails?.customer?.ownerAssignedAt ? `Assigned ${new Date(customerDetails.customer.ownerAssignedAt).toLocaleDateString()}` : "No owner yet"}
                  </p>
                  {ownerUpdateError ? (
                    <p className="text-[10px] font-bold text-red-500">{ownerUpdateError}</p>
                  ) : null}
                </div>

                {/* Open tickets count */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center min-h-[74px]">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Open Tickets</p>
                  <p className={`text-xl font-black ${openTicketCount > 0 ? "text-red-500" : "text-emerald-500"}`}>
                    {loadingDetails ? "—" : openTicketCount}
                  </p>
                </div>

                {/* Total chats */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center justify-center text-center min-h-[74px]">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Chats</p>
                  <p className="text-xl font-black text-indigo-600">
                    {loadingDetails ? "—" : customerDetails?.sessions?.length ?? 0}
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-1.5">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Next Follow Up</label>
                <input
                  type="datetime-local"
                  value={customerDetails?.customer?.nextFollowUpAt ? new Date(customerDetails.customer.nextFollowUpAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => updateNextFollowUp(selectedCustomer._id, e.target.value)}
                  disabled={!canEditCRM}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 text-[11px] font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-300 transition-all text-slate-700"
                />
              </div>
            </div>

            {/* Tab Nav */}
            <div className="sticky top-0 z-10 flex border-b border-slate-100 bg-white/95 backdrop-blur overflow-x-auto">
              {[ 
                { key: "tickets", label: "Tickets",  icon: TicketIcon,    badge: customerDetails?.tickets?.length },
                { key: "chats",   label: "Chats",    icon: MessageCircle, badge: customerDetails?.sessions?.length },
                { key: "notes",   label: "Intel Notes", icon: Tag,        badge: customerDetails?.customer?.internalNotes?.length },
                { key: "tasks",   label: "Tasks",    icon: Clock,         badge: customerDetails?.tasks?.length },
                { key: "activity",label: "Timeline", icon: Calendar,      badge: customerDetails?.activity?.length },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.key}
                    onClick={() => setDrawerTab(t.key)}
                    className={`min-w-[140px] flex-1 flex items-center justify-center gap-2 py-4 px-3 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all whitespace-nowrap ${
                      drawerTab === t.key
                        ? "border-indigo-600 text-indigo-600 bg-indigo-50/30"
                        : "border-transparent text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    <Icon size={13} />
                    {t.label}
                    {t.badge > 0 && (
                      <span className={`w-4 h-4 rounded-full text-[8px] font-black flex items-center justify-center ${
                        drawerTab === t.key ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-600"
                      }`}>
                        {t.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Drawer Content */}
            <div className="px-5 py-5 md:px-6 md:py-6 space-y-4 bg-slate-50/40 min-h-full">
              {loadingDetails ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-300">
                  <span className="animate-spin w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Loading intelligence…</p>
                </div>
              ) : (
                <>
                  {/* ── TICKETS TAB ── */}
                  {drawerTab === "tickets" && (
                    <div className="space-y-3">
                      {customerDetails?.tickets?.length > 0 ? customerDetails.tickets.map(ticket => (
                        <div
                          key={ticket._id}
                          className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group"
                        >
                          {/* Ticket header */}
                          <div className="p-5 flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="bg-indigo-50 text-indigo-700 text-[8px] font-black px-2 py-1 rounded tracking-widest border border-indigo-100">
                                  {ticket.ticketId}
                                </span>
                                <TicketStatusBadge status={ticket.status} />
                                <PriorityDot priority={ticket.priority} />
                              </div>
                              <p className="text-xs font-bold text-slate-800 truncate">{ticket.subject}</p>
                              <div className="flex items-center gap-3 flex-wrap">
                                {ticket.crmStage && ticket.crmStage !== "none" && (
                                  <CRMStageBadge stage={ticket.crmStage} />
                                )}
                                {ticket.websiteId?.websiteName && (
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                                    🌐 {ticket.websiteId.websiteName}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="text-right shrink-0 space-y-1">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {new Date(ticket.createdAt).toLocaleDateString()}
                              </p>
                              {ticket.assignedAgent && (
                                <p className="text-[9px] font-bold text-slate-400">
                                  👤 {ticket.assignedAgent.name}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Notes preview */}
                          {ticket.notes?.filter(n => n.isPublic).length > 0 && (
                            <div className="px-5 pb-4 border-t border-slate-50 pt-3">
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Latest Update</p>
                              <p className="text-[10px] text-slate-600 font-medium leading-relaxed line-clamp-2">
                                {ticket.notes.filter(n => n.isPublic).at(-1)?.content}
                              </p>
                            </div>
                          )}
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-300">
                          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                            <TicketIcon size={22} className="text-slate-300" />
                          </div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No tickets yet</p>
                          <p className="text-[10px] text-slate-300 font-bold text-center max-w-xs">
                            When an Agent converts a chat to a ticket, it will appear here linked to this customer's CRN.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── CHATS TAB ── */}
                  {drawerTab === "chats" && (
                    <div className="space-y-3">
                      {customerDetails?.sessions?.length > 0 ? customerDetails.sessions.map(session => (
                        <div
                          key={session._id}
                          className="bg-white rounded-2xl border border-slate-100 p-5 group hover:border-indigo-100 transition-all shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                                <MessageCircle size={18} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-slate-900 uppercase tracking-tight mb-0.5">
                                  {session.sessionId?.substring(0, 14)}…
                                </p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                                  {new Date(session.createdAt).toLocaleDateString()} — {session.websiteId?.websiteName}
                                </p>
                                {session.lastMessagePreview && (
                                  <p className="text-[9px] text-slate-400 mt-1 line-clamp-1">{session.lastMessagePreview}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                                session.status === "active" ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                session.status === "queued" ? "bg-amber-50 text-amber-600 border-amber-100" :
                                "bg-slate-100 text-slate-400 border-slate-200"
                              }`}>{session.status}</span>
                              {session.assignedAgent && (
                                <p className="text-[9px] text-slate-400 font-bold">👤 {session.assignedAgent.name}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                            <MessageCircle size={22} className="text-slate-300" />
                          </div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No chat history</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── NOTES TAB ── */}
                  {drawerTab === "notes" && (
                    <div className="space-y-5">
                      {canEditCRM ? (
                        <form onSubmit={addNote} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Add Private Observation</p>
                          <textarea
                            value={newNote}
                            onChange={(e) => setNewNote(e.target.value)}
                            placeholder="Add an internal note about this customer (only visible to your team)…"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300 min-h-[110px] resize-y transition-all"
                          />
                          <button
                            type="submit"
                            disabled={savingNote || !newNote.trim()}
                            className={`w-full font-black text-[10px] uppercase tracking-[0.2em] py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                              noteSuccess
                                ? "bg-emerald-500 text-white"
                                : "bg-slate-900 hover:bg-black text-white disabled:opacity-40"
                            }`}
                          >
                            {savingNote ? (
                              <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                            ) : noteSuccess ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <Save size={13} />
                            )}
                            {noteSuccess ? "Saved!" : "Submit Observation"}
                          </button>
                        </form>
                      ) : (
                        <div className="bg-slate-100/70 rounded-2xl border border-slate-200 p-5 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Read Only Access</p>
                          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">
                            Agents can review CRM notes here, but only sales, manager, and client roles can add notes or change CRM status.
                          </p>
                        </div>
                      )}

                      {canSendSalesEmail ? (
                        <form onSubmit={sendSalesEmail} className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sales Email</p>
                          <input
                            value={emailDraft.subject}
                            onChange={(e) => setEmailDraft((prev) => ({ ...prev, subject: e.target.value }))}
                            placeholder="Email subject"
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                          />
                          <textarea
                            value={emailDraft.body}
                            onChange={(e) => setEmailDraft((prev) => ({ ...prev, body: e.target.value }))}
                            placeholder="Write your email here..."
                            className="w-full bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs font-medium placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300 min-h-[220px] resize-y transition-all"
                          />
                          <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Attachment</label>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                              onChange={(e) => setEmailAttachment(e.target.files?.[0] || null)}
                              className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-[10px] font-bold text-slate-500 outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                            />
                            <p className="text-[10px] font-bold text-slate-400">
                              {emailAttachment
                                ? `Selected: ${emailAttachment.name}`
                                : "Optional. JPG, PNG, GIF, WEBP, or PDF up to 10MB."}
                            </p>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400">
                            {customerDetails?.customer?.email?.endsWith("@visitor.local")
                              ? "This customer does not have a real email address yet."
                              : `This email will be sent to ${customerDetails?.customer?.email || selectedCustomer?.email || "the customer"}.`}
                          </p>
                          {emailError ? <p className="text-[10px] font-bold text-red-500">{emailError}</p> : null}
                          <button
                            type="submit"
                            disabled={sendingEmail || !emailDraft.subject.trim() || !emailDraft.body.trim() || customerDetails?.customer?.email?.endsWith("@visitor.local")}
                            className={`w-full font-black text-[10px] uppercase tracking-[0.2em] py-3 rounded-xl transition-all flex items-center justify-center gap-2 ${
                              emailSuccess
                                ? "bg-emerald-500 text-white"
                                : "bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40"
                            }`}
                          >
                            {sendingEmail ? (
                              <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                            ) : emailSuccess ? (
                              <CheckCircle2 size={13} />
                            ) : (
                              <Send size={13} />
                            )}
                            {emailSuccess ? "Email Sent" : "Send Email"}
                          </button>
                        </form>
                      ) : null}

                      <div className="bg-slate-100/70 rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Ownership</p>
                        <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                          {customerDetails?.customer?.ownerId?.name || "No CRM owner assigned"} {customerDetails?.customer?.ownerId?.role ? `(${customerDetails.customer.ownerId.role})` : ""}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-2">
                          Next follow up: {customerDetails?.customer?.nextFollowUpAt ? new Date(customerDetails.customer.nextFollowUpAt).toLocaleString() : "Not scheduled"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-2">
                          Company: {customerDetails?.customer?.companyName || "Not set"}
                        </p>
                        <p className="text-[10px] text-slate-400 font-bold mt-2">
                          Source: {customerDetails?.customer?.leadSource || "Not set"} • Value: {customerDetails?.customer?.leadValue || 0}
                        </p>
                      </div>

                      {customerDetails?.duplicateCandidates?.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Duplicate Watch</p>
                          {customerDetails.duplicateCandidates.map((entry) => (
                            <div key={entry._id} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                              <p className="text-[11px] font-black text-amber-900">{entry.name}</p>
                              <p className="mt-1 text-[10px] font-bold text-amber-700">{entry.email || "No email"} {entry.companyName ? `• ${entry.companyName}` : ""}</p>
                              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-amber-600">Match score {entry.duplicateScore}</p>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {customerDetails?.customer?.assignmentHistory?.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Assignment History</p>
                          {customerDetails.customer.assignmentHistory.map((entry, index) => (
                            <div key={`${entry.assignedAt}-${index}`} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                              <p className="text-[11px] font-medium text-slate-700 leading-relaxed">
                                {entry.ownerId?.name || "Unassigned"} by {entry.assignedBy?.name || "System"}
                              </p>
                              <div className="flex justify-between items-center mt-3">
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{entry.reason || "routing_update"}</span>
                                <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(entry.assignedAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {customerDetails?.customer?.communications?.length > 0 ? (
                        <div className="space-y-3">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email History</p>
                          {customerDetails.customer.communications.map((entry, index) => (
                            <div key={`${entry.sentAt}-${index}`} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-[11px] font-black text-slate-900 truncate">{entry.subject}</p>
                                  <p className="text-[9px] font-bold text-slate-400 mt-1">
                                    To {entry.to} {entry.sentBy?.name ? `• by ${entry.sentBy.name}` : ""}
                                  </p>
                                </div>
                                <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{entry.status || "sent"}</span>
                              </div>
                              <p className="text-[10px] text-slate-600 font-medium leading-relaxed mt-3 whitespace-pre-wrap">{entry.body}</p>
                              {entry.attachments?.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-3">
                                  {entry.attachments.map((attachment, attachmentIndex) => (
                                    <a
                                      key={`${attachment.url}-${attachmentIndex}`}
                                      href={attachment.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-indigo-600"
                                    >
                                      {attachment.filename || "Attachment"}
                                    </a>
                                  ))}
                                </div>
                              ) : null}
                              <div className="flex justify-between items-center mt-3">
                                <span className="text-[9px] font-bold text-slate-300 uppercase">
                                  {entry.ticketId?.ticketId ? `Linked ${entry.ticketId.ticketId}` : "CRM Email"}
                                </span>
                                <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(entry.sentAt).toLocaleString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Existing notes */}
                      <div className="space-y-3">
                        {customerDetails?.customer?.internalNotes?.length > 0
                          ? customerDetails.customer.internalNotes.map((note, i) => (
                              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm">
                                <p className="text-[11px] font-medium text-slate-700 leading-relaxed mb-3">{note.text}</p>
                                <div className="flex justify-between items-center">
                                  <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{note.authorName}</span>
                                  <span className="text-[9px] font-bold text-slate-300 uppercase">{new Date(note.createdAt).toLocaleDateString()}</span>
                                </div>
                              </div>
                            ))
                          : (
                            <div className="flex flex-col items-center justify-center py-10 gap-3">
                              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No observations recorded yet</p>
                            </div>
                          )}
                      </div>
                    </div>
                  )}

                  {drawerTab === "tasks" && (
                    <div className="space-y-5">
                      {canManageTasks ? (
                        <form onSubmit={createTask} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Create Follow-up Task</p>
                          <input
                            value={taskForm.title}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, title: e.target.value }))}
                            placeholder="Call to discuss quotation"
                            className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold outline-none"
                          />
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <select
                              value={taskForm.type}
                              onChange={(e) => setTaskForm((prev) => ({ ...prev, type: e.target.value }))}
                              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold outline-none"
                            >
                              <option value="follow_up">Follow Up</option>
                              <option value="call">Call</option>
                              <option value="email">Email</option>
                              <option value="meeting">Meeting</option>
                              <option value="demo">Demo</option>
                              <option value="quotation">Quotation</option>
                            </select>
                            <input
                              type="datetime-local"
                              value={taskForm.dueAt}
                              onChange={(e) => setTaskForm((prev) => ({ ...prev, dueAt: e.target.value }))}
                              className="w-full rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-bold outline-none"
                            />
                          </div>
                          <textarea
                            value={taskForm.notes}
                            onChange={(e) => setTaskForm((prev) => ({ ...prev, notes: e.target.value }))}
                            placeholder="Optional preparation notes"
                            className="w-full min-h-[90px] rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs font-medium outline-none"
                          />
                          <button type="submit" disabled={taskSaving || !taskForm.title || !taskForm.dueAt} className="w-full rounded-xl bg-indigo-600 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white disabled:opacity-50">
                            {taskSaving ? "Creating..." : "Create Task"}
                          </button>
                        </form>
                      ) : null}

                      <div className="space-y-3">
                        {(customerDetails?.tasks || []).length > 0 ? customerDetails.tasks.map((task) => (
                          <div key={task._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <p className="text-[11px] font-black text-slate-900">{task.title}</p>
                                <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">{task.type} • {task.status}</p>
                                <p className="mt-2 text-[10px] font-bold text-slate-500">{task.notes || "No notes"}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black uppercase text-slate-400">{new Date(task.dueAt).toLocaleString()}</p>
                                {canManageTasks && task.status !== "completed" ? (
                                  <button onClick={() => updateTaskStatus(task._id, "completed")} className="mt-3 rounded-lg bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-emerald-600">
                                    Complete
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        )) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-10 text-center">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">No follow-up tasks yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {drawerTab === "activity" && (
                    <ActivityTimeline items={customerDetails?.activity || []} emptyLabel="No CRM activity recorded yet." />
                  )}
                </>
              )}
            </div>
            </div>
          </div>
        </>
      )}

      {showCreateLead ? (
        <div className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-[32px] bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.18em] text-slate-900">Create Lead</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-1">Add a new CRM record directly into the pipeline.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateLead(false);
                  resetCreateLeadForm();
                }}
                className="p-2.5 rounded-xl text-slate-300 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitCreateLead} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lead Name</label>
                  <input
                    value={createLeadForm.name}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Email</label>
                  <input
                    type="email"
                    value={createLeadForm.email}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Phone</label>
                  <input
                    value={createLeadForm.phone}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, phone: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Company</label>
                  <input
                    value={createLeadForm.companyName}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, companyName: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Website</label>
                  <select
                    value={createLeadForm.websiteId}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, websiteId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                    required
                  >
                    <option value="">Select website</option>
                    {websites.map((website) => (
                      <option key={website._id} value={website._id}>{website.websiteName}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lead Source</label>
                  <input
                    value={createLeadForm.leadSource}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, leadSource: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Lead Value</label>
                  <input
                    type="number"
                    min="0"
                    value={createLeadForm.leadValue}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, leadValue: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Expected Close</label>
                  <input
                    type="date"
                    value={createLeadForm.expectedCloseDate}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, expectedCloseDate: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Pipeline Stage</label>
                  <select
                    value={createLeadForm.pipelineStage}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, pipelineStage: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  >
                    {Object.entries(CRM_STAGE_CONFIG).map(([key, cfg]) => (
                      <option key={key} value={key}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Relationship Status</label>
                  <select
                    value={createLeadForm.status}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  >
                    <option value="prospect">Prospect</option>
                    <option value="lead">Lead</option>
                    <option value="customer">Customer</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">CRM Owner</label>
                  <select
                    value={createLeadForm.ownerId}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, ownerId: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  >
                    <option value="">Unassigned</option>
                    {teamMembers.filter((member) => ["sales", "manager"].includes(member.role)).map((owner) => (
                      <option key={owner._id} value={owner._id}>{owner.name} ({owner.role})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Tags</label>
                  <input
                    value={createLeadForm.tags}
                    onChange={(e) => setCreateLeadForm((prev) => ({ ...prev, tags: e.target.value }))}
                    placeholder="comma, separated, tags"
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-300"
                  />
                </div>
              </div>
              {createLeadError ? <p className="text-[10px] font-bold text-red-500">{createLeadError}</p> : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateLead(false);
                    resetCreateLeadForm();
                  }}
                  className="px-5 py-3 rounded-2xl border border-slate-200 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingLead}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-[0.18em] disabled:opacity-50 flex items-center gap-2"
                >
                  <Plus size={14} />
                  {creatingLead ? "Creating..." : "Create Lead"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
