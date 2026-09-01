import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../shared/application";
import {
  listPrioritizedAlerts,
  resolveAlert,
  type AlertCommandGateway,
  type AlertReadStore,
} from "./alerts";

const actor: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };

describe("alerts", () => {
  it("filters company scope and sorts critical items first", async () => {
    const store: AlertReadStore = {
      listActiveAlerts: () =>
        Promise.resolve([
          {
            id: "info",
            companyId: "company-a",
            type: "INFO",
            priority: "INFO",
            title: "Info",
            state: "NEW",
            dueAt: null,
          },
          {
            id: "foreign",
            companyId: "company-b",
            type: "X",
            priority: "CRITICAL",
            title: "Foreign",
            state: "NEW",
            dueAt: null,
          },
          {
            id: "critical",
            companyId: "company-a",
            type: "X",
            priority: "CRITICAL",
            title: "Critical",
            state: "NEW",
            dueAt: null,
          },
        ]),
    };
    await expect(listPrioritizedAlerts(store, actor)).resolves.toMatchObject([
      { id: "critical" },
      { id: "info" },
    ]);
  });

  it("resolves active own-company alerts through a command gateway", async () => {
    const resolve = vi.fn(() => Promise.resolve());
    const gateway: AlertCommandGateway = { resolveAlert: resolve };
    await resolveAlert(
      gateway,
      actor,
      {
        id: "alert",
        companyId: "company-a",
        type: "X",
        priority: "WARNING",
        title: "X",
        state: "NEW",
        dueAt: null,
      },
      "Atendido",
    );
    expect(resolve).toHaveBeenCalledWith("alert", "Atendido");
  });
});
