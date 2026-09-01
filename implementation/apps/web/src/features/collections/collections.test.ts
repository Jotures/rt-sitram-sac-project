import { describe, expect, it, vi } from "vitest";
import type { ActorContext } from "../shared/application";
import {
  createInvoice,
  getInvoiceStatus,
  registerPayment,
  type CollectionsCommandGateway,
  type CollectionsReadStore,
  type InvoiceModel,
} from "./collections";

const admin: ActorContext = { profileId: "admin", companyId: "company-a", role: "administration" };
const driver: ActorContext = { profileId: "driver", companyId: "company-a", role: "driver" };
const invoice: InvoiceModel = {
  id: "invoice-a",
  companyId: "company-a",
  tripId: "trip-a",
  clientId: "client-a",
  series: "F001",
  number: "123",
  issuedAt: "2026-08-01T00:00:00.000Z",
  dueAt: "2026-08-15T00:00:00.000Z",
  total: 1000,
  voided: false,
};

function store(paymentAmounts: readonly number[] = []): CollectionsReadStore {
  return {
    getInvoice: () => Promise.resolve(invoice),
    listInvoicePayments: () =>
      Promise.resolve(
        paymentAmounts.map((amount, index) => ({
          id: `payment-${index}`,
          companyId: "company-a",
          invoiceId: invoice.id,
          paidAt: "2026-08-10T00:00:00.000Z",
          amount,
          method: "TRANSFER",
          reference: "",
        })),
      ),
    listOpenInvoices: () => Promise.resolve([invoice]),
  };
}

function gateway(): CollectionsCommandGateway {
  return {
    createInvoice: vi.fn(() => Promise.resolve("invoice-a")),
    registerPayment: vi.fn(() => Promise.resolve("payment-a")),
  };
}

describe("collections application", () => {
  it("creates invoices through the remote authority", async () => {
    const commands = gateway();
    await expect(
      createInvoice(commands, driver, {
        tripId: "trip",
        clientId: "client",
        series: "F001",
        number: "1",
        issuedAt: new Date("2026-08-01T00:00:00.000Z"),
        dueAt: new Date("2026-08-15T00:00:00.000Z"),
        total: 100,
      }),
    ).rejects.toThrow("No tienes permiso");
    await expect(
      createInvoice(commands, admin, {
        tripId: "trip",
        clientId: "client",
        series: "F001",
        number: "1",
        issuedAt: new Date("2026-08-15T00:00:00.000Z"),
        dueAt: new Date("2026-08-01T00:00:00.000Z"),
        total: 100,
      }),
    ).rejects.toThrow("anterior");
  });

  it("prevents overpayment using the current local projection", async () => {
    const commands = gateway();
    await expect(
      registerPayment(store([800]), commands, admin, {
        invoiceId: "invoice-a",
        paidAt: new Date("2026-08-13T00:00:00.000Z"),
        amount: 250,
        method: "Transferencia",
        reference: "OP-1",
      }),
    ).rejects.toThrow("superar el saldo");
    await expect(
      registerPayment(store([800]), commands, admin, {
        invoiceId: "invoice-a",
        paidAt: new Date("2026-08-13T00:00:00.000Z"),
        amount: 200,
        method: "Transferencia",
        reference: "OP-1",
      }),
    ).resolves.toBe("payment-a");
  });

  it("derives overdue status from invoice and valid payments", async () => {
    await expect(
      getInvoiceStatus(store([200]), admin, invoice, new Date("2026-08-16T00:00:00.000Z")),
    ).resolves.toBe("OVERDUE");
  });
});
