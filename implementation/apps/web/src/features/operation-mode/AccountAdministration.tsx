import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../../components/primitives/Button";
import { getSupabaseClient } from "../../lib/supabase";
import { useIdentity } from "../identity/IdentityProvider";
import { MoreDetails } from "./OperationModeProvider";

interface RpcBoundary {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("La cuenta no está disponible.");
  const r = await (client as unknown as RpcBoundary).rpc(name, args);
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}
const money = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(n);
interface Invoice {
  id: string;
  series: string;
  number: string;
  trip_code: string;
  client_name: string;
  version: number;
  subtotal: number;
  tax: number;
  remaining: number;
  status: string;
  payments: readonly Payment[];
}
interface Payment {
  id: string;
  version: number;
  amount: number;
  paid_at: string;
  cancelled_at: string | null;
}
export function CommercialCorrections({
  onSaved,
}: {
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [rows, setRows] = useState<readonly Invoice[]>([]),
    [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const load = useCallback(async () => {
    try {
      setRows(await rpc<Invoice[]>("get_invoice_accounts"));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los saldos.");
    }
  }, []);
  useEffect(() => {
    if (opened) void load();
  }, [opened, load]);
  return (
    <details className="operation-more-details" onToggle={(e) => setOpened(e.currentTarget.open)}>
      <summary>Revisar o corregir facturas y pagos</summary>
      <p>
        Las correcciones conservan el historial y actualizan la deuda del cliente. Indica el motivo
        del cambio.
      </p>
      {error && <p role="alert">{error}</p>}
      {rows.map((i) => (
        <section className="admin-card" key={`${i.id}:${i.version}`}>
          <h3>
            {i.series}-{i.number} · {i.client_name}
          </h3>
          <p>
            {i.trip_code} · Saldo pendiente: {money(i.remaining)}
            {i.status === "cancelled" ? " · Anulada" : ""}
          </p>
          {i.status !== "cancelled" && (
            <CorrectionForm
              kind="invoice"
              row={i}
              onSaved={async () => {
                await load();
                onSaved();
              }}
            />
          )}
          <MoreDetails label="Pagos de esta factura">
            {i.payments.map((p) => (
              <div key={`${p.id}:${p.version}`}>
                <p>
                  {money(p.amount)} · {new Date(p.paid_at).toLocaleDateString("es-PE")}
                  {p.cancelled_at ? " · Anulado" : ""}
                </p>
                {!p.cancelled_at && (
                  <CorrectionForm
                    kind="payment"
                    row={p}
                    onSaved={async () => {
                      await load();
                      onSaved();
                    }}
                  />
                )}
              </div>
            ))}
          </MoreDetails>
        </section>
      ))}
    </details>
  );
}
function CorrectionForm({
  kind,
  row,
  onSaved,
}: {
  readonly kind: "invoice" | "payment";
  readonly row: Invoice | Payment;
  readonly onSaved: () => Promise<void>;
}): React.JSX.Element {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [requestId] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget),
      cancel = form.get("cancel") === "on";
    setBusy(true);
    setError(null);
    try {
      await rpc("correct_commercial_record", {
        p_request_id: requestId,
        p_kind: kind,
        p_id: row.id,
        p_expected_version: row.version,
        p_values: cancel
          ? { cancel: true }
          : kind === "invoice"
            ? { subtotal: Number(form.get("subtotal")), tax: Number(form.get("tax")) }
            : { amount: Number(form.get("amount")) },
        p_reason: String(form.get("reason")),
      });
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la corrección.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <MoreDetails label={kind === "invoice" ? "Corregir factura" : "Corregir pago"}>
      <form className="admin-form" onSubmit={(e) => void submit(e)}>
        {kind === "invoice" && "subtotal" in row ? (
          <>
            <label className="admin-field">
              <span>Subtotal</span>
              <input
                name="subtotal"
                type="number"
                min="0"
                step="0.01"
                defaultValue={row.subtotal}
                required
              />
            </label>
            <label className="admin-field">
              <span>Impuesto</span>
              <input name="tax" type="number" min="0" step="0.01" defaultValue={row.tax} required />
            </label>
          </>
        ) : (
          <label className="admin-field">
            <span>Importe correcto</span>
            <input
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={"amount" in row ? row.amount : 0}
              required
            />
          </label>
        )}
        <label>
          <input name="cancel" type="checkbox" /> Anular este registro por error de captura
        </label>
        <label className="admin-field">
          <span>Motivo de corrección o anulación</span>
          <input name="reason" required minLength={3} />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button type="submit" disabled={busy}>
          Guardar corrección
        </Button>
      </form>
    </MoreDetails>
  );
}

interface Category {
  id: string;
  name: string;
  active: boolean;
  updated_at: string;
}
export function ExpenseCategorySettings(): React.JSX.Element | null {
  const identity = useIdentity().state;
  const [rows, setRows] = useState<readonly Category[]>([]),
    [opened, setOpened] = useState(false),
    [error, setError] = useState<string | null>(null),
    [revision, setRevision] = useState(0);
  const role = identity.status === "READY" ? identity.identity.profile.role : null;
  useEffect(() => {
    if (!opened) return;
    const client = getSupabaseClient();
    if (!client) return;
    void client
      .from("expense_categories")
      .select("id,name,active,updated_at")
      .order("name")
      .then((r) => {
        if (r.error) setError(r.error.message);
        else setRows(r.data);
      });
  }, [opened, revision]);
  if (role !== "management" && role !== "administration") return null;
  return (
    <details className="operation-more-details" onToggle={(e) => setOpened(e.currentTarget.open)}>
      <summary>Categorías de gastos</summary>
      <p>
        Agrega categorías o desactiva las que ya no uses. Los registros anteriores se conservan.
      </p>
      {error && <p role="alert">{error}</p>}
      {opened && (
        <>
          <CategoryForm key={`new:${revision}`} onSaved={() => setRevision((r) => r + 1)} />
          {rows.map((c) => (
            <MoreDetails
              key={`${c.id}:${c.updated_at}`}
              label={`${c.name}${c.active ? "" : " · Inactiva"}`}
            >
              <CategoryForm category={c} onSaved={() => setRevision((r) => r + 1)} />
            </MoreDetails>
          ))}
        </>
      )}
    </details>
  );
}
function CategoryForm({
  category,
  onSaved,
}: {
  readonly category?: Category;
  readonly onSaved: () => void;
}): React.JSX.Element {
  const [id] = useState(() => category?.id ?? crypto.randomUUID()),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await rpc("manage_expense_category", {
        p_id: id,
        p_name: String(f.get("name")),
        p_active: f.get("active") === "on",
        p_expected_updated_at: category?.updated_at ?? null,
        p_reason: category ? String(f.get("reason")) : null,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar la categoría.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={(e) => void submit(e)}>
      <label className="admin-field">
        <span>{category ? "Nombre" : "Nueva categoría"}</span>
        <input name="name" defaultValue={category?.name ?? ""} required />
      </label>
      <label>
        <input name="active" type="checkbox" defaultChecked={category?.active ?? true} /> Disponible
        para nuevos gastos
      </label>
      {category && (
        <label className="admin-field">
          <span>Motivo del cambio</span>
          <input name="reason" required minLength={3} />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <Button type="submit" disabled={busy}>
        {category ? "Guardar cambio" : "Agregar categoría"}
      </Button>
    </form>
  );
}
