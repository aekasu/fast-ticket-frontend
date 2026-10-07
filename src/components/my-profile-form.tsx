"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api/client";
import { errorMessage } from "@/lib/api/errors";
import { runCommand, CommandFailed, useActionKey } from "@/lib/queries/commands";
import { NoticeBar, field, primary, type Notice } from "./action-ui";

function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/profile");
      if (!data) throw new Error(errorMessage(error));
      return data;
    },
  });
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid items-center gap-1 sm:grid-cols-[13rem_1fr]">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

const Select = ({ name, value, options }: { name: string; value: string; options: [string, string][] }) => (
  <select name={name} defaultValue={value} className={field}>
    {options.map(([v, l]) => (
      <option key={v} value={v}>
        {l}
      </option>
    ))}
  </select>
);

/** osTicket's profile.php: the agent's own account, preferences and signature, and a password change. */
export function MyProfileForm() {
  const profile = useProfile();
  const queryClient = useQueryClient();
  const key = useActionKey();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const pwKey = useActionKey();
  const [pwNotice, setPwNotice] = useState<Notice | null>(null);

  const p = profile.data;
  if (profile.isLoading) return <p className="text-sm text-slate-500">Loading…</p>;
  if (!p) return <p role="alert" className="text-sm text-red-700">{profile.error?.message ?? "Unable to load the profile."}</p>;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice(null);
    setBusy(true);
    const f = new FormData(e.currentTarget);
    const t = (n: string) => String(f.get(n) ?? "");
    const body = {
      firstname: t("firstname").trim(),
      lastname: t("lastname").trim(),
      email: t("email").trim(),
      phone: t("phone").trim(),
      phone_ext: t("phone_ext").trim(),
      mobile: t("mobile").trim(),
      signature: t("signature"),
      timezone: t("timezone").trim(),
      max_page_size: Number(t("max_page_size") || 0),
      auto_refresh_rate: Number(t("auto_refresh_rate") || 0),
      default_signature_type: t("default_signature_type"),
      default_paper_size: t("default_paper_size"),
      default_from_name: t("default_from_name"),
      thread_view_order: t("thread_view_order"),
      reply_redirect: t("reply_redirect"),
      datetime_format: t("datetime_format"),
      img_att_view: t("img_att_view"),
      editor_spacing: t("editor_spacing"),
      onvacation: f.get("onvacation") === "on",
    };
    try {
      await runCommand({ method: "PATCH", path: "/api/v1/profile", body, key: key.current() });
      key.renew();
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["profile"] }), queryClient.invalidateQueries({ queryKey: ["me"] })]);
      setNotice({ kind: "ok", text: "Profile updated successfully." });
    } catch (error) {
      if (error instanceof CommandFailed) key.renew();
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    }
    setBusy(false);
  }

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPwNotice(null);
    const f = new FormData(e.currentTarget);
    const next = String(f.get("new_password") ?? "");
    if (next !== String(f.get("confirm") ?? "")) return setPwNotice({ kind: "error", text: "The new passwords do not match." });
    try {
      await runCommand({
        method: "POST",
        path: "/api/v1/profile/password",
        body: { current_password: String(f.get("current_password") ?? ""), new_password: next },
        key: pwKey.current(),
      });
      // A password change voids the agent's tokens: the session is over, so go back to the login screen.
      await fetch("/api/session", { method: "DELETE" });
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/login";
    } catch (error) {
      if (error instanceof CommandFailed) pwKey.renew();
      setPwNotice({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={save} className="max-w-3xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Profile">
        <NoticeBar notice={notice} />
        <h2 className="text-sm font-bold text-slate-800">Account</h2>
        <Row label="Username">
          <span className="text-sm">{p.username}</span>
        </Row>
        <Row label="First Name">
          <input name="firstname" required maxLength={32} defaultValue={p.firstname} className={field} />
        </Row>
        <Row label="Last Name">
          <input name="lastname" required maxLength={32} defaultValue={p.lastname} className={field} />
        </Row>
        <Row label="Email Address">
          <input name="email" type="email" required maxLength={255} defaultValue={p.email} className={field} />
        </Row>
        <Row label="Phone Number">
          <input name="phone" maxLength={24} defaultValue={p.phone} className={field} />
        </Row>
        <Row label="Phone Extension">
          <input name="phone_ext" maxLength={6} defaultValue={p.phone_ext} className={field} />
        </Row>
        <Row label="Mobile Number">
          <input name="mobile" maxLength={24} defaultValue={p.mobile} className={field} />
        </Row>
        <Row label="Time Zone">
          <input name="timezone" maxLength={64} defaultValue={p.timezone} placeholder="e.g. Europe/Berlin" className={field} />
        </Row>

        <h2 className="pt-2 text-sm font-bold text-slate-800">Preferences</h2>
        <Row label="Maximum Page Size">
          <input name="max_page_size" type="number" min={0} max={50} defaultValue={p.max_page_size} className={field} />
        </Row>
        <Row label="Auto Refresh Rate (minutes)">
          <input name="auto_refresh_rate" type="number" min={0} max={30} defaultValue={p.auto_refresh_rate} className={field} />
        </Row>
        <Row label="Default Signature">
          <Select name="default_signature_type" value={p.default_signature_type} options={[["none", "None"], ["mine", "My Signature"], ["dept", "Department Signature"]]} />
        </Row>
        <Row label="Default Paper Size">
          <Select name="default_paper_size" value={p.default_paper_size} options={["Letter", "Legal", "Ledger", "A4", "A3"].map((x) => [x, x])} />
        </Row>
        <Row label="Default From Name">
          <Select name="default_from_name" value={p.default_from_name} options={[["", "System default"], ["email", "Email address name"], ["dept", "Department name"], ["mine", "My name"]]} />
        </Row>
        <Row label="Thread View Order">
          <Select name="thread_view_order" value={p.thread_view_order} options={[["", "System default"], ["asc", "Oldest first"], ["desc", "Newest first"]]} />
        </Row>
        <Row label="After Replying">
          <Select name="reply_redirect" value={p.reply_redirect} options={[["Ticket", "Stay on the ticket"], ["Queue", "Return to the queue"]]} />
        </Row>
        <Row label="Date and Time Format">
          <Select name="datetime_format" value={p.datetime_format} options={[["", "System default"], ["relative", "Relative"]]} />
        </Row>
        <Row label="Image Attachments">
          <Select name="img_att_view" value={p.img_att_view} options={[["download", "Download"], ["inline", "Inline"]]} />
        </Row>
        <Row label="Editor Spacing">
          <Select name="editor_spacing" value={p.editor_spacing} options={[["single", "Single"], ["double", "Double"]]} />
        </Row>
        <Row label="Vacation Mode">
          <input name="onvacation" type="checkbox" defaultChecked={p.onvacation} className="h-4 w-4 justify-self-start" />
        </Row>
        <Row label="Signature">
          <textarea name="signature" rows={4} defaultValue={p.signature} className={field} />
        </Row>
        <button type="submit" disabled={busy} className={primary}>
          {busy ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <form onSubmit={changePassword} className="max-w-3xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Change password">
        <NoticeBar notice={pwNotice} />
        <h2 className="text-sm font-bold text-slate-800">Change Password</h2>
        <Row label="Current Password">
          <input name="current_password" type="password" required autoComplete="current-password" className={field} />
        </Row>
        <Row label="New Password">
          <input name="new_password" type="password" required minLength={1} maxLength={128} autoComplete="new-password" className={field} />
        </Row>
        <Row label="Confirm New Password">
          <input name="confirm" type="password" required autoComplete="new-password" className={field} />
        </Row>
        <p className="text-xs text-slate-500">Changing your password ends your session: you will sign in again.</p>
        <button type="submit" className={primary}>
          Change Password
        </button>
      </form>
    </div>
  );
}
