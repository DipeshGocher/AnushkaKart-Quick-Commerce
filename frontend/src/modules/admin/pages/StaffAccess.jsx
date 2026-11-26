import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Eye,
  EyeOff,
  Wand2,
  Copy,
  Check,
  X,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { adminStaffApi } from "../services/api/staffApi";
import { generateStrongPassword, groupModules, passwordProblem } from "../utils/adminAccess";

const inputClass =
  "w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60";
const labelClass = "block text-sm font-medium text-gray-700 mb-1";

const errorText = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const formatDate = (value) => {
  if (!value) return "Never";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "-"
    : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const AccessBadge = ({ accessType }) => (
  <span
    className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${
      accessType === "read" ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
    }`}
  >
    {accessType === "read" ? "View only" : "Read / Write"}
  </span>
);

const Modal = ({ title, subtitle, onClose, children, wide = false }) => (
  <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 p-4">
    <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-xl ${wide ? "max-w-2xl" : "max-w-md"}`}>
      <div className="flex items-start justify-between border-b border-gray-100 p-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600" aria-label="Close">
          <X size={18} />
        </button>
      </div>
      <div className="overflow-y-auto p-5">{children}</div>
    </div>
  </div>
);

/* ───────────── Role form ───────────── */

const RoleModal = ({ role, modules, onClose, onSaved }) => {
  const editing = Boolean(role);
  const [form, setForm] = useState({
    name: role?.name || "",
    description: role?.description || "",
    accessType: role?.accessType || "write",
    isActive: role ? role.isActive : true,
    permissions: role?.permissions || [],
  });
  const [saving, setSaving] = useState(false);
  const groups = useMemo(() => groupModules(modules), [modules]);

  const toggle = (key) =>
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(key) ? prev.permissions.filter((k) => k !== key) : [...prev.permissions, key],
    }));

  const setGroup = (groupModulesList, on) =>
    setForm((prev) => {
      const keys = groupModulesList.map((m) => m.key);
      const rest = prev.permissions.filter((k) => !keys.includes(k));
      return { ...prev, permissions: on ? [...rest, ...keys] : rest };
    });

  const allKeys = modules.map((m) => m.key);

  const submit = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 2) return toast.error("Give the role a name (at least 2 letters)");
    if (form.permissions.length === 0) return toast.error("Pick at least one page for this role");
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        accessType: form.accessType,
        isActive: form.isActive,
        permissions: form.permissions,
      };
      if (editing) await adminStaffApi.updateStaffRole(role.id, payload);
      else await adminStaffApi.createStaffRole(payload);
      toast.success(editing ? "Role updated" : "Role created");
      onSaved();
    } catch (error) {
      toast.error(errorText(error, "Could not save the role"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? "Edit Role" : "Add New Role"}
      subtitle="Tick the pages this role can open. Changes apply to everyone with this role straight away."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Role name *</label>
            <input className={inputClass} value={form.name} maxLength={60} placeholder="e.g. Manager" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Access type</label>
            <select className={inputClass} value={form.accessType} onChange={(e) => setForm({ ...form, accessType: e.target.value })}>
              <option value="write">Read / Write (can view and change)</option>
              <option value="read">View only (cannot change anything)</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Description (optional)</label>
          <input className={inputClass} value={form.description} maxLength={300} placeholder="What this role is for" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">
              Pages this role can open <span className="text-gray-400">({form.permissions.length} selected)</span>
            </label>
            <div className="flex gap-3 text-xs font-semibold">
              <button type="button" className="text-primary hover:underline" onClick={() => setForm({ ...form, permissions: allKeys })}>
                Select all
              </button>
              <button type="button" className="text-gray-500 hover:underline" onClick={() => setForm({ ...form, permissions: [] })}>
                Clear
              </button>
            </div>
          </div>
          <div className="max-h-72 space-y-4 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50/60 p-4">
            {groups.map(({ group, modules: items }) => {
              const allOn = items.every((m) => form.permissions.includes(m.key));
              return (
                <div key={group}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{group}</span>
                    <button type="button" className="text-[11px] font-semibold text-primary hover:underline" onClick={() => setGroup(items, !allOn)}>
                      {allOn ? "Clear group" : "Select group"}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {items.map((m) => (
                      <label key={m.key} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-700 border border-gray-100 hover:border-primary/40">
                        <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.permissions.includes(m.key)} onChange={() => toggle(m.key)} />
                        {m.label}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {editing && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Role is on (switching it off blocks everyone who has it)
          </label>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary/90 disabled:opacity-60">
            {saving ? "Saving..." : editing ? "Save Role" : "Create Role"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

/* ───────────── Staff login form ───────────── */

const PasswordField = ({ value, onChange, required, label }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className={`${inputClass} pr-10`}
            type={show ? "text" : "password"}
            value={value}
            required={required}
            autoComplete="new-password"
            placeholder="10+ characters, upper, lower, number"
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" aria-label={show ? "Hide password" : "Show password"}>
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            onChange(generateStrongPassword());
            setShow(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          <Wand2 size={14} /> Generate
        </button>
      </div>
    </div>
  );
};

const CredentialsCard = ({ email, password, roleName, onDone }) => {
  const [copied, setCopied] = useState(false);
  const text = `Admin panel login\nEmail: ${email}\nPassword: ${password}\nRole: ${roleName}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy. Please select and copy it by hand.");
    }
  };
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-800">
        Login created. Share these details with the staff member. The password cannot be shown again later (you can set a new one by editing the login).
      </div>
      <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-4 text-sm text-gray-800 border border-gray-100">{text}</pre>
      <div className="flex gap-3">
        <button type="button" onClick={copy} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
          {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy details"}
        </button>
        <button type="button" onClick={onDone} className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary/90">
          Done
        </button>
      </div>
    </div>
  );
};

const StaffModal = ({ member, roles, onClose, onSaved }) => {
  const editing = Boolean(member);
  const activeRoles = roles.filter((r) => r.isActive || r.id === member?.role?.id);
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    phone: member?.phone || "",
    roleId: member?.role?.id || activeRoles[0]?.id || "",
    isActive: member ? member.isActive : true,
    password: "",
  });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const chosenRole = roles.find((r) => r.id === form.roleId);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.roleId) return toast.error("Choose a role");
    if (!editing || form.password) {
      const problem = passwordProblem(form.password);
      if (problem) return toast.error(problem);
    }
    setSaving(true);
    try {
      if (editing) {
        const payload = { name: form.name.trim(), phone: form.phone.trim(), roleId: form.roleId, isActive: form.isActive };
        if (form.password) payload.password = form.password;
        await adminStaffApi.updateStaffMember(member.id, payload);
        toast.success("Login updated");
        onSaved();
      } else {
        await adminStaffApi.createStaffMember({
          name: form.name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          roleId: form.roleId,
          password: form.password,
        });
        setCreated({ email: form.email.trim().toLowerCase(), password: form.password, roleName: chosenRole?.name || "" });
      }
    } catch (error) {
      toast.error(errorText(error, "Could not save the login"));
    } finally {
      setSaving(false);
    }
  };

  if (created) {
    return (
      <Modal title="Staff login ready" onClose={() => onSaved()}>
        <CredentialsCard {...created} onDone={() => onSaved()} />
      </Modal>
    );
  }

  return (
    <Modal
      title={editing ? "Edit Staff Login" : "Add Staff Login"}
      subtitle={editing ? "Change the role, switch the login off, or set a new password." : "They sign in at the normal admin login with this email and password."}
      onClose={onClose}
    >
      {roles.length === 0 ? (
        <p className="text-sm text-gray-600">Create a role first, then you can add staff logins to it.</p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className={labelClass}>Full name *</label>
            <input className={inputClass} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Email *</label>
            <input className={inputClass} type="email" required disabled={editing} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Mobile number (optional)</label>
            <input className={inputClass} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Role *</label>
            <select className={inputClass} value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })}>
              {activeRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.permissions.length} pages, {r.accessType === "read" ? "view only" : "read/write"})
                </option>
              ))}
            </select>
          </div>
          <PasswordField
            label={editing ? "New password (leave empty to keep the current one)" : "Password *"}
            value={form.password}
            required={!editing}
            onChange={(password) => setForm({ ...form, password })}
          />
          {editing && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Login is on (switch off to block this person immediately)
            </label>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-primary px-4 py-2.5 font-medium text-white hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Login"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

/* ───────────── Page ───────────── */

const StaffAccess = () => {
  const [tab, setTab] = useState("team");
  const [roles, setRoles] = useState([]);
  const [members, setMembers] = useState([]);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleModal, setRoleModal] = useState(null); // null | "new" | role
  const [staffModal, setStaffModal] = useState(null); // null | "new" | member

  const moduleLabel = useMemo(() => new Map(modules.map((m) => [m.key, m.label])), [modules]);

  const load = useCallback(async () => {
    try {
      const [rolesRes, membersRes, modulesRes] = await Promise.all([
        adminStaffApi.listStaffRoles(),
        adminStaffApi.listStaffMembers(),
        adminStaffApi.getStaffModules(),
      ]);
      setRoles(rolesRes?.data?.result?.items || []);
      setMembers(membersRes?.data?.result?.items || []);
      setModules(modulesRes?.data?.result?.modules || []);
    } catch (error) {
      toast.error(errorText(error, "Could not load staff and roles"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const deleteRole = async (role) => {
    if (!window.confirm(`Delete the role "${role.name}"?`)) return;
    try {
      await adminStaffApi.deleteStaffRole(role.id);
      toast.success("Role deleted");
      load();
    } catch (error) {
      toast.error(errorText(error, "Could not delete the role"));
    }
  };

  const deleteMember = async (member) => {
    if (!window.confirm(`Delete the login of ${member.name}? They will be signed out and cannot log in again.`)) return;
    try {
      await adminStaffApi.deleteStaffMember(member.id);
      toast.success("Login deleted");
      load();
    } catch (error) {
      toast.error(errorText(error, "Could not delete the login"));
    }
  };

  const toggleMember = async (member) => {
    try {
      await adminStaffApi.updateStaffMember(member.id, { isActive: !member.isActive });
      toast.success(member.isActive ? "Login switched off" : "Login switched on");
      load();
    } catch (error) {
      toast.error(errorText(error, "Could not change the login"));
    }
  };

  if (loading) {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Loading...</p>
      </div>
    );
  }

  const staffCount = members.filter((m) => !m.isMainAdmin).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff &amp; Roles</h1>
          <p className="mt-1 text-sm text-gray-500">
            Make roles (like Manager or Employee) by ticking the pages they can open, then give people a login with a role.
          </p>
        </div>
        <button
          type="button"
          onClick={() => (tab === "team" ? setStaffModal("new") : setRoleModal("new"))}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-primary/90"
        >
          <Plus size={20} />
          {tab === "team" ? "Add Staff Login" : "Add New Role"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Staff logins</p>
            <h3 className="text-2xl font-bold text-gray-900">{staffCount}</h3>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Roles</p>
            <h3 className="text-2xl font-bold text-gray-900">{roles.length}</h3>
          </div>
        </div>
      </div>

      <div className="flex gap-2 rounded-xl bg-gray-100 p-1 sm:w-fit">
        {[
          ["team", "Staff Logins"],
          ["roles", "Roles & Pages"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-lg px-5 py-2 text-sm font-semibold transition-all sm:flex-none ${tab === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "team" && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 font-medium text-gray-500">
                <tr>
                  <th className="px-6 py-4">Admin Profile</th>
                  <th className="px-6 py-4">Assigned Role</th>
                  <th className="px-6 py-4">Access Type</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((m) => (
                  <tr key={m.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-gray-900">{m.name}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {m.email}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-gray-900">{m.isMainAdmin ? "Main Admin" : m.role?.name || "-"}</td>
                    <td className="px-6 py-4">
                      <AccessBadge accessType={m.isMainAdmin ? "write" : m.role?.accessType} />
                    </td>
                    <td className="px-6 py-4">
                      {m.isMainAdmin ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                          <Lock size={12} /> Active
                        </span>
                      ) : (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${m.isActive && m.role?.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                          {!m.isActive ? "Switched off" : m.role?.isActive ? "Active" : "Role off"}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(m.lastLogin)}</td>
                    <td className="px-6 py-4">
                      {m.isMainAdmin ? (
                        <div className="text-right text-gray-300">-</div>
                      ) : (
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => toggleMember(m)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">
                            {m.isActive ? "Switch off" : "Switch on"}
                          </button>
                          <button type="button" onClick={() => setStaffModal(m)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary" aria-label="Edit">
                            <Pencil size={16} />
                          </button>
                          <button type="button" onClick={() => deleteMember(m)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {staffCount === 0 && (
            <div className="border-t border-gray-100 px-6 py-10 text-center text-sm text-gray-500">
              No staff logins yet. {roles.length === 0 ? "Start by creating a role in the Roles & Pages tab." : "Click Add Staff Login to create one."}
            </div>
          )}
        </div>
      )}

      {tab === "roles" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {roles.map((role) => (
            <div key={role.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">{role.name}</h3>
                    <AccessBadge accessType={role.accessType} />
                    {!role.isActive && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Off</span>}
                  </div>
                  {role.description && <p className="mt-1 text-sm text-gray-500">{role.description}</p>}
                  <p className="mt-1 text-xs text-gray-400">
                    {role.memberCount} staff login{role.memberCount === 1 ? "" : "s"} · {role.permissions.length} page{role.permissions.length === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => setRoleModal(role)} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-primary" aria-label="Edit role">
                    <Pencil size={16} />
                  </button>
                  <button type="button" onClick={() => deleteRole(role)} className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600" aria-label="Delete role">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {role.permissions.map((key) => (
                  <span key={key} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700">
                    {moduleLabel.get(key) || key}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {roles.length === 0 && (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 lg:col-span-2">
              No roles yet. Click Add New Role, name it (for example Manager or Employee) and tick the pages it can open.
            </div>
          )}
        </div>
      )}

      {roleModal && (
        <RoleModal
          role={roleModal === "new" ? null : roleModal}
          modules={modules}
          onClose={() => setRoleModal(null)}
          onSaved={() => {
            setRoleModal(null);
            load();
          }}
        />
      )}
      {staffModal && (
        <StaffModal
          member={staffModal === "new" ? null : staffModal}
          roles={roles}
          onClose={() => setStaffModal(null)}
          onSaved={() => {
            setStaffModal(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default StaffAccess;
