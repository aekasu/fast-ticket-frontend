import { expect, test } from "@playwright/test";
import { command, createTicket } from "./api";
import { AUTH } from "./global-setup";
import { osticketAdmin, osticketPageText } from "./osticket";

test.describe("Manage Forms", () => {
  test.use({ storageState: AUTH.admin });

  test("an extra form is added to a ticket, answered, reordered away and removed, as osTicket's page shows", async ({ page, request }) => {
    const os = await osticketAdmin();
    const stamp = Date.now();
    const title = `E2E Extra Form ${stamp}`;
    const label = `E2E Extra Field ${stamp}`;
    let formId: number | undefined;
    const ticket = await createTicket(request, { subject: `[e2e] manage forms ${stamp}`, message: "Add a form.", name: "Forms Tester", email: `forms.${stamp}@example.com` });
    try {
      const made = await command(request, "POST", "/api/v1/forms", { title, type: "G" });
      expect(made.status, made.error_message ?? "").toBe("done");
      formId = Number(Object.values(made.result).find((v) => typeof v === "number"));
      const field = await command(request, "POST", `/api/v1/forms/${formId}/fields`, { label, type: "text", name: `e2e_extra_${stamp}`, mode: "optional" });
      expect(field.status, field.error_message ?? "").toBe("done");

      await page.goto(`/tickets/${ticket.id}`);
      await page.getByRole("button", { name: "Manage Forms" }).click();
      const panel = page.getByRole("region", { name: "Manage forms" });
      await expect(panel.getByText("(built in)")).toBeVisible();
      await panel.getByLabel("Add a form").selectOption({ label: title });
      await panel.getByRole("button", { name: "Add", exact: true }).click();
      await panel.getByRole("button", { name: "Save Changes" }).click();
      await expect(panel.getByText("Successfully updated forms.")).toBeVisible();

      // The ticket now lists the form's field, empty, and osTicket's page shows the form.
      const detail = (await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { custom_fields: { label: string }[] };
      expect(detail.custom_fields.map((f) => f.label)).toContain(label);
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).toContain(label);

      // Removing it warns that its answers go too, and then removes it.
      await panel.getByRole("button", { name: `Remove ${title}` }).click();
      await expect(panel.getByRole("status")).toContainText("deletes the answers");
      await panel.getByRole("button", { name: "Save Changes" }).click();
      await expect(panel.getByText("Successfully updated forms.")).toBeVisible();
      const after = (await (await request.get(`/api/v1/tickets/${ticket.id}`)).json()) as { custom_fields: { label: string }[] };
      expect(after.custom_fields.map((f) => f.label)).not.toContain(label);
      expect(await osticketPageText(os, `tickets.php?id=${ticket.id}`)).not.toContain(label);
    } finally {
      await ticket.remove();
      if (formId) await command(request, "DELETE", `/api/v1/forms/${formId}`).catch(() => undefined);
      await os.dispose();
    }
  });
});
