"use client";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="underline hover:text-white"
      onClick={async () => {
        await fetch("/api/session", { method: "DELETE" });
        // Full page load on purpose: it drops the client-side query cache between sessions.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }}
    >
      Log Out
    </button>
  );
}
