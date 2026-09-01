import {
  calculateInvoiceBalance,
  deriveInvoiceCollectionStatus,
  type InvoiceCollectionStatus,
} from "@rt-sitram/domain";
import {
  type ActorContext,
  requireFiniteNonNegative,
  requirePermission,
  requireSameCompany,
  requireText,
  toIsoTimestamp,
} from "../shared/application";
import type { ProductCommandTransport } from "../shared/supabase-rpc";

export interface InvoiceModel {
  readonly id: string;
  readonly companyId: string;
  readonly tripId: string;
  readonly clientId: string;
  readonly series: string;
  readonly number: string;
  readonly issuedAt: string;
  readonly dueAt: string;
  readonly total: number;
  readonly voided: boolean;
}

export interface PaymentModel {
  readonly id: string;
  readonly companyId: string;
  readonly invoiceId: string;
  readonly paidAt: string;
  readonly amount: number;
  readonly method: string;
  readonly reference: string;
}

export interface CollectionsReadStore {
  getInvoice(invoiceId: string): Promise<InvoiceModel | null>;
  listInvoicePayments(invoiceId: string): Promise<readonly PaymentModel[]>;
  listOpenInvoices(companyId: string): Promise<readonly InvoiceModel[]>;
}

export interface CollectionsCommandGateway {
  createInvoice(input: Omit<InvoiceModel, "id" | "companyId" | "voided">): Promise<string>;
  registerPayment(input: Omit<PaymentModel, "id" | "companyId">): Promise<string>;
}

export async function createInvoice(
  gateway: CollectionsCommandGateway,
  actor: ActorContext,
  input: Omit<InvoiceModel, "id" | "companyId" | "voided" | "issuedAt" | "dueAt"> & {
    readonly issuedAt: Date;
    readonly dueAt: Date;
  },
): Promise<string> {
  requirePermission(actor, "MANAGE_RECEIVABLES");
  requireFiniteNonNegative(input.total, "El total de la factura");
  if (input.total === 0) {
    throw new Error("El total de la factura debe ser mayor que cero.");
  }
  if (input.dueAt < input.issuedAt) {
    throw new Error("El vencimiento no puede ser anterior a la emisión.");
  }
  return gateway.createInvoice({
    tripId: requireText(input.tripId, "El viaje"),
    clientId: requireText(input.clientId, "El cliente"),
    series: requireText(input.series, "La serie"),
    number: requireText(input.number, "El número"),
    issuedAt: toIsoTimestamp(input.issuedAt),
    dueAt: toIsoTimestamp(input.dueAt),
    total: input.total,
  });
}

export async function registerPayment(
  store: CollectionsReadStore,
  gateway: CollectionsCommandGateway,
  actor: ActorContext,
  input: {
    readonly invoiceId: string;
    readonly paidAt: Date;
    readonly amount: number;
    readonly method: string;
    readonly reference: string;
  },
): Promise<string> {
  requirePermission(actor, "MANAGE_RECEIVABLES");
  requireFiniteNonNegative(input.amount, "El pago");
  if (input.amount === 0) {
    throw new Error("El pago debe ser mayor que cero.");
  }
  const invoice = await store.getInvoice(input.invoiceId);
  if (invoice === null) {
    throw new Error("La factura no existe o no está disponible.");
  }
  requireSameCompany(actor, invoice.companyId);
  if (invoice.voided) {
    throw new Error("No se puede pagar una factura anulada.");
  }
  const payments = await store.listInvoicePayments(invoice.id);
  const balance = calculateInvoiceBalance(
    invoice.total,
    payments.map((payment) => payment.amount),
  );
  if (input.amount > balance) {
    throw new Error("El pago no puede superar el saldo de la factura.");
  }
  return gateway.registerPayment({
    invoiceId: invoice.id,
    paidAt: toIsoTimestamp(input.paidAt),
    amount: input.amount,
    method: requireText(input.method, "El medio de pago"),
    reference: input.reference.trim(),
  });
}

export async function getInvoiceStatus(
  store: CollectionsReadStore,
  actor: ActorContext,
  invoice: InvoiceModel,
  asOf: Date,
): Promise<InvoiceCollectionStatus> {
  requirePermission(actor, "VIEW_FINANCIAL_DOCUMENTS");
  requireSameCompany(actor, invoice.companyId);
  const payments = await store.listInvoicePayments(invoice.id);
  return deriveInvoiceCollectionStatus({
    total: invoice.total,
    payments: payments.map((payment) => payment.amount),
    dueDate: new Date(invoice.dueAt),
    asOf,
    voided: invoice.voided,
  });
}

export function createRpcCollectionsCommandGateway(
  transport: ProductCommandTransport,
): CollectionsCommandGateway {
  async function invokeForId(
    functionName: string,
    args: Readonly<Record<string, unknown>>,
  ): Promise<string> {
    const value = await transport.invoke(functionName, args);
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`La operación ${functionName} no devolvió un identificador válido.`);
    }
    return value;
  }
  return {
    createInvoice: (input) =>
      invokeForId("create_trip_invoice", {
        trip_id: input.tripId,
        client_id: input.clientId,
        series: input.series,
        number: input.number,
        issued_at: input.issuedAt,
        due_at: input.dueAt,
        total: input.total,
      }),
    registerPayment: (input) =>
      invokeForId("register_invoice_payment", {
        invoice_id: input.invoiceId,
        paid_at: input.paidAt,
        amount: input.amount,
        method: input.method,
        reference: input.reference,
      }),
  };
}
