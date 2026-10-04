"use client";

import { useState } from "react";
import type { components } from "@/lib/api/schema";
import { formatDateTime } from "@/lib/format";
import { hasGlobal } from "@/lib/nav";
import { directoryKeys } from "@/lib/queries/directory";
import { useMe } from "@/lib/queries/me";
import { NoticeBar, button, field, primary, useRunner } from "./action-ui";
import { Info } from "./info-table";

type User = components["schemas"]["UserDetail"];
type Account = NonNullable<User["account"]>;
type Panel = "register" | "manage" | null;

/** The status as osTicket words it on a user's page. */
export function accountStatus(account: Account | null | undefined): string {
  if (!account) return "Guest";
  if (account.status === "locked") return "Locked (Administrative)";
  if (account.status === "pending") return "Pending (Registered)";
  return "Active (Registered)";
}

const zones = (() => {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return [] as string[];
  }
})();

/** A user's login account: register one, change it, lock it, and send the activation and reset emails. */
export function UserAccount({ user }: { user: User }) {
  const { data: me } = useMe();
  const { run, busy, notice, clear } = useRunner(`/api/v1/users/${user.id}`, directoryKeys.users);
  const [panel, setPanel] = useState<Panel>(null);
  const account = user.account;
  const manage = me ? hasGlobal(me, "user.manage") : false;

  function toggle(next: Panel) {
    clear();
    setPanel(panel === next ? null : next);
  }

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const body: Record<string, unknown> = {
      send_email: form.get("send_email") === "on",
      require_password_reset: form.get("require_password_reset") === "on",
      forbid_password_reset: form.get("forbid_password_reset") === "on",
    };
    if (text("username")) body.username = text("username");
    if (text("timezone")) body.timezone = text("timezone");
    if (text("password")) body.password = text("password");
    if (await run("account", body, `${user.name} is registered.`, "POST")) setPanel(null);
  }

  async function change(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!account) return;
    const form = new FormData(e.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim();
    const body: Record<string, unknown> = {};
    if (text("username") !== (account.username ?? "")) body.username = text("username");
    if (text("timezone") && text("timezone") !== account.timezone) body.timezone = text("timezone");
    if (text("password")) body.password = text("password");
    if ((form.get("require_password_reset") === "on") !== account.require_password_reset) body.require_password_reset = form.get("require_password_reset") === "on";
    if ((form.get("forbid_password_reset") === "on") !== account.forbid_password_reset) body.forbid_password_reset = form.get("forbid_password_reset") === "on";
    if (Object.keys(body).length === 0) {
      clear();
      return;
    }
    if (await run("account", body, "Account updated.", "PATCH")) setPanel(null);
  }

  // The status itself is in the user's info table above, as on osTicket's page.
  const rows: [string, React.ReactNode][] = [];
  if (account) {
    rows.push(
      ["Username", account.username ?? ""],
      ["Timezone", account.timezone],
      ["Registered", formatDateTime(account.registered)],
      ["Confirmed", account.is_confirmed ? "Yes" : "No"],
      ["Password reset", [account.require_password_reset && "Required at next login", account.forbid_password_reset && "Not allowed"].filter(Boolean).join(", ") || "Allowed"],
    );
  }

  return (
    <section className="mt-6" aria-label="Account">
      <h2 className="mb-2 border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">Account</h2>
      <div className="max-w-xl">
        {account ? <Info rows={rows} /> : <p className="text-sm text-slate-600">This user has no login account (a guest). Registering one lets them sign in.</p>}
      </div>

      {manage && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!account && (
            <button type="button" className={button} onClick={() => toggle("register")} aria-expanded={panel === "register"}>
              Register
            </button>
          )}
          {account && (
            <>
              <button type="button" className={button} onClick={() => toggle("manage")} aria-expanded={panel === "manage"}>
                Manage Account
              </button>
              <button
                type="button"
                className={button}
                disabled={busy}
                onClick={() => run("account", { is_locked: !account.is_locked }, account.is_locked ? "Account unlocked." : "Account locked.", "PATCH")}
              >
                {account.is_locked ? "Unlock" : "Lock"}
              </button>
              {!account.is_confirmed && (
                <button type="button" className={button} disabled={busy} onClick={() => run("account/confirmation", {}, "Account activation email sent.", "POST")}>
                  Send Activation Email
                </button>
              )}
              {!account.forbid_password_reset && (
                <button type="button" className={button} disabled={busy} onClick={() => run("account/password-reset", {}, "Password reset email sent.", "POST")}>
                  Send Password Reset Link
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="mt-3">
        <NoticeBar notice={notice} />
      </div>

      {manage && panel === "register" && (
        <form onSubmit={register} className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Register account">
          <h3 className="text-sm font-semibold text-slate-800">Register {user.name}</h3>
          <input name="username" aria-label="Username" placeholder="Username (optional: the email always works)" maxLength={64} className={field} autoComplete="off" />
          <input name="timezone" aria-label="Timezone" list="timezones" placeholder="Timezone (default)" className={field} />
          <input name="password" type="password" aria-label="Temporary password" placeholder="Temporary password (needed unless an email is sent)" maxLength={128} className={field} autoComplete="new-password" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="send_email" /> Send an account activation email
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="require_password_reset" /> Require a password change at the next login
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="forbid_password_reset" /> Do not allow the user to reset the password
          </label>
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Working…" : "Register"}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {manage && panel === "manage" && account && (
        <form onSubmit={change} className="mt-3 max-w-xl space-y-3 border border-slate-300 bg-white p-4" aria-label="Manage account">
          <h3 className="text-sm font-semibold text-slate-800">Manage Account</h3>
          <input name="username" aria-label="Username" defaultValue={account.username ?? ""} maxLength={64} className={field} autoComplete="off" />
          <input name="timezone" aria-label="Timezone" list="timezones" defaultValue={account.timezone} className={field} />
          <input name="password" type="password" aria-label="New password" placeholder="New password (leave empty to keep it)" maxLength={128} className={field} autoComplete="new-password" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="require_password_reset" defaultChecked={account.require_password_reset} /> Require a password change at the next login
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="forbid_password_reset" defaultChecked={account.forbid_password_reset} /> Do not allow the user to reset the password
          </label>
          <div className="flex gap-2">
            <button type="submit" className={primary} disabled={busy}>
              {busy ? "Working…" : "Save Account"}
            </button>
            <button type="button" className={button} onClick={() => setPanel(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}
      <datalist id="timezones">
        {zones.map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </section>
  );
}
