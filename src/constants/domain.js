export const ROLES = Object.freeze({
  ADMIN: "admin",
  CLIENT: "client",
  MANAGER: "manager",
  AGENT: "agent",
  SALES: "sales",
  USER: "user"
});

export const PERMISSIONS = Object.freeze({
  CRM_VIEW: "crm.view",
  CRM_CREATE: "crm.create",
  CRM_UPDATE: "crm.update",
  CRM_ARCHIVE: "crm.archive",
  CRM_DELETE: "crm.delete",
  CRM_ASSIGN_OWNER: "crm.assign_owner",
  CRM_MERGE: "crm.merge",
  CRM_SEND_EMAIL: "crm.send_email",
  CRM_MANAGE_TASKS: "crm.manage_tasks",
  ACTIVITY_VIEW: "activity.view"
});
