import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../components/primitives/Button";
import { Icon } from "../../components/primitives/Icon";
import { StatusChip } from "../../components/primitives/StatusChip";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { getSupabaseClient } from "../../lib/supabase";
import { useIdentity } from "../identity/IdentityProvider";
import {
  authorityStatusLabel,
  bootstrapActionLabel,
  canManageGpsOdometer,
  canOfferTestPlaceholderCorrection,
  createGpsOdometerIdempotencyKey,
  getGpsOdometerManagementScreenState,
  shouldLoadGpsOdometerManagement,
  validateGpsOdometerPositiveDecimal,
  validateGpsOdometerReason,
  type ConfigureGpsOdometerPlausibilityPolicyInput,
  type GpsOdometerAuthority,
  type GpsOdometerBootstrapMode,
  type GpsOdometerCandidate,
  type GpsOdometerManagementBootstrap,
  type GpsOdometerReviewDecision,
  type PendingGpsOdometerReview,
} from "./gps-odometer-management";
import {
  createSupabaseGpsOdometerManagementGateway,
  type GpsOdometerManagementGateway,
} from "./gps-odometer-management-data";
import "./gps-odometer-management.css";

type LoadState =
  | { readonly kind: "LOADING" }
  | { readonly kind: "READY"; readonly data: GpsOdometerManagementBootstrap }
  | { readonly kind: "ERROR"; readonly message: string };

type DialogState =
  | {
      readonly kind: "ACTIVATE";
      readonly candidate: GpsOdometerCandidate;
      readonly idempotencyKey: string;
    }
  | { readonly kind: "SUSPEND"; readonly authority: GpsOdometerAuthority }
  | {
      readonly kind: "REVIEW";
      readonly review: PendingGpsOdometerReview;
      readonly idempotencyKey: string;
    };

/**
 * A narrow, online-only management surface. It never queries PowerSync and
 * never contains an operational GPS map or location data.
 */
export function GpsOdometerManagementPage(): React.JSX.Element {
  const { state: identityState } = useIdentity();
  const networkStatus = useNetworkStatus();
  const client = getSupabaseClient();
  const role = identityState.status === "READY" ? identityState.identity.profile.role : null;
  const mayManage = role !== null && canManageGpsOdometer(role);
  const gateway = useMemo<GpsOdometerManagementGateway | null>(() => {
    if (!mayManage || client === null) return null;
    return createSupabaseGpsOdometerManagementGateway(client);
  }, [client, mayManage]);
  const [loadState, setLoadState] = useState<LoadState>({ kind: "LOADING" });
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [busyAction, setBusyAction] = useState<DialogState["kind"] | "POLICY" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const screenState = getGpsOdometerManagementScreenState({
    identityReady: identityState.status === "READY",
    role,
    online: networkStatus === "ONLINE",
    serverConfigured: gateway !== null,
  });
  const shouldLoad = shouldLoadGpsOdometerManagement(
    role,
    networkStatus === "ONLINE",
    gateway !== null,
  );

  const reload = useCallback(async (): Promise<void> => {
    if (gateway === null) return;
    setLoadState({ kind: "LOADING" });
    try {
      setLoadState({ kind: "READY", data: await gateway.loadBootstrap() });
    } catch {
      setLoadState({
        kind: "ERROR",
        message: "No fue posible consultar la configuración de odómetro. No se cambió ningún dato.",
      });
    }
  }, [gateway]);

  useEffect(() => {
    if (!shouldLoad) return;
    void reload();
  }, [reload, shouldLoad]);

  function openActivation(candidate: GpsOdometerCandidate): void {
    try {
      setDialog({
        kind: "ACTIVATE",
        candidate,
        idempotencyKey: createGpsOdometerIdempotencyKey(),
      });
      setActionError(null);
      setNotice(null);
    } catch (error) {
      setActionError(clientErrorMessage(error));
    }
  }

  function openReview(review: PendingGpsOdometerReview): void {
    try {
      setDialog({ kind: "REVIEW", review, idempotencyKey: createGpsOdometerIdempotencyKey() });
      setActionError(null);
      setNotice(null);
    } catch (error) {
      setActionError(clientErrorMessage(error));
    }
  }

  async function activate(
    candidate: GpsOdometerCandidate,
    bootstrapMode: GpsOdometerBootstrapMode,
    reason: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (gateway === null) return;
    setBusyAction("ACTIVATE");
    setActionError(null);
    try {
      await gateway.activateAuthority({
        candidate,
        expectedCurrentOdometerKm: candidate.currentOdometerKm,
        bootstrapMode,
        reason,
        idempotencyKey,
      });
      setDialog(null);
      setNotice(
        bootstrapMode === "test_placeholder"
          ? "La corrección excepcional fue confirmada por el servidor y quedó auditada."
          : "La fuente Goldcar quedó registrada como fuente oficial y su lectura inicial fue confirmada por el servidor.",
      );
      await reload();
    } catch (error) {
      setActionError(clientErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function suspend(authority: GpsOdometerAuthority, reason: string): Promise<void> {
    if (gateway === null) return;
    setBusyAction("SUSPEND");
    setActionError(null);
    try {
      await gateway.suspendAuthority({ authorityId: authority.id, reason });
      setDialog(null);
      setNotice(
        "La fuente GPS fue suspendida. La telemetría deja de mostrarse en las superficies operativas; la evidencia histórica se conserva.",
      );
      await reload();
    } catch (error) {
      setActionError(clientErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function review(
    item: PendingGpsOdometerReview,
    decision: GpsOdometerReviewDecision,
    reason: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (gateway === null) return;
    setBusyAction("REVIEW");
    setActionError(null);
    try {
      await gateway.reviewPromotion({
        promotionId: item.promotionId,
        decision,
        reason,
        idempotencyKey,
      });
      setDialog(null);
      setNotice(
        decision === "approved"
          ? "La lectura Goldcar fue aprobada por el servidor. El kilometraje oficial se actualizó solo si la evidencia seguía vigente."
          : "La lectura Goldcar fue rechazada y el kilometraje oficial no cambió.",
      );
      await reload();
    } catch (error) {
      setActionError(clientErrorMessage(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function configurePolicy(
    input: ConfigureGpsOdometerPlausibilityPolicyInput,
  ): Promise<boolean> {
    if (gateway === null) return false;
    setBusyAction("POLICY");
    setActionError(null);
    setNotice(null);
    try {
      await gateway.configurePlausibilityPolicy(input);
      setNotice(
        "Los límites para futuras lecturas fueron confirmados y auditados por el servidor.",
      );
      await reload();
      return true;
    } catch (error) {
      setActionError(clientErrorMessage(error));
      return false;
    } finally {
      setBusyAction(null);
    }
  }

  if (screenState === "PREPARING") {
    return (
      <PageNotice
        title="Preparando la configuración GPS"
        copy="Verificando los permisos de la sesión…"
      />
    );
  }
  if (screenState === "FORBIDDEN") {
    return (
      <PageNotice
        title="Configuración reservada a Gerencia"
        copy="Las fuentes oficiales de kilometraje Goldcar solo pueden consultarse y modificarse desde una sesión de Gerencia."
      />
    );
  }
  if (screenState === "OFFLINE") {
    return (
      <PageNotice
        title="Esta configuración requiere conexión"
        copy="No forma parte de la copia local. Conéctate para consultar evidencia actual y ejecutar acciones auditadas en el servidor."
        icon="offline"
      />
    );
  }
  if (screenState === "UNAVAILABLE") {
    return (
      <PageNotice
        title="No se configuró el acceso al servidor"
        copy="No se pueden consultar ni modificar las fuentes oficiales de kilometraje desde este dispositivo."
      />
    );
  }

  return (
    <div className="gps-odometer-management">
      <header className="gps-odometer-management__header">
        <div>
          <p className="gps-odometer-management__eyebrow">Configuración de Gerencia</p>
          <h1>Kilometraje oficial desde Goldcar</h1>
          <p>
            Revisa qué lectura validada de <strong>Odómetro</strong> puede actualizar el kilometraje
            oficial de cada unidad. Distancia, ignición y ubicación no sustituyen esta lectura.
          </p>
        </div>
        <div className="gps-odometer-management__header-status">
          <StatusChip label="Configuración solo en línea" tone="info" />
          <small>
            Cada cambio espera la confirmación del servidor antes de mostrarse como aplicado.
          </small>
        </div>
      </header>

      <p className="gps-odometer-management__boundary" role="note">
        <Icon name="alert" size={18} />
        <span>
          <strong>Alcance de esta pantalla:</strong> activar o aprobar una lectura puede actualizar
          el kilometraje oficial tras la confirmación del servidor. No cierra viajes ni modifica
          rendiciones, gastos o mantenimiento por sí sola.
        </span>
      </p>

      {notice === null ? null : (
        <p
          className="gps-odometer-management__feedback gps-odometer-management__feedback--success"
          role="status"
        >
          {notice}
        </p>
      )}
      {actionError === null || dialog !== null ? null : (
        <p
          className="gps-odometer-management__feedback gps-odometer-management__feedback--error"
          role="alert"
        >
          {actionError}
        </p>
      )}

      {loadState.kind === "LOADING" ? (
        <PageNotice
          title="Consultando evidencia de odómetro"
          copy="Buscando lecturas Goldcar validadas, fuentes oficiales y revisiones pendientes…"
        />
      ) : null}
      {loadState.kind === "ERROR" ? (
        <PageNotice
          title="No se pudo abrir la configuración"
          copy={loadState.message}
          action={
            <Button icon="wifi" onClick={() => void reload()} variant="secondary">
              Reintentar
            </Button>
          }
        />
      ) : null}
      {loadState.kind !== "READY" ? null : (
        <ManagementWorkspace
          busyAction={busyAction}
          data={loadState.data}
          onActivate={openActivation}
          onConfigurePolicy={configurePolicy}
          onReview={openReview}
          onSuspend={(authority) => {
            setDialog({ kind: "SUSPEND", authority });
            setActionError(null);
            setNotice(null);
          }}
        />
      )}

      {dialog?.kind === "ACTIVATE" ? (
        <ActivationDialog
          busy={busyAction === "ACTIVATE"}
          candidate={dialog.candidate}
          onClose={() => setDialog(null)}
          onConfirm={(mode, reason) =>
            void activate(dialog.candidate, mode, reason, dialog.idempotencyKey)
          }
          serverError={actionError}
        />
      ) : null}
      {dialog?.kind === "SUSPEND" ? (
        <ReasonDialog
          busy={busyAction === "SUSPEND"}
          confirmLabel="Suspender fuente oficial"
          copy="La telemetría dejará de mostrarse en las superficies operativas y ninguna lectura GPS podrá actualizar el kilometraje oficial hasta que vuelvas a activar una fuente de forma explícita. La evidencia histórica se conserva."
          eyebrow="Suspensión de fuente"
          onClose={() => setDialog(null)}
          onConfirm={(reason) => void suspend(dialog.authority, reason)}
          title={`Suspender fuente oficial de ${dialog.authority.vehicleLabel}`}
          variant="danger"
          serverError={actionError}
        />
      ) : null}
      {dialog?.kind === "REVIEW" ? (
        <ReviewDialog
          busy={busyAction === "REVIEW"}
          item={dialog.review}
          onClose={() => setDialog(null)}
          onConfirm={(decision, reason) =>
            void review(dialog.review, decision, reason, dialog.idempotencyKey)
          }
          serverError={actionError}
        />
      ) : null}
    </div>
  );
}

function ManagementWorkspace({
  busyAction,
  data,
  onActivate,
  onConfigurePolicy,
  onReview,
  onSuspend,
}: {
  readonly busyAction: DialogState["kind"] | "POLICY" | null;
  readonly data: GpsOdometerManagementBootstrap;
  readonly onActivate: (candidate: GpsOdometerCandidate) => void;
  readonly onConfigurePolicy: (
    input: ConfigureGpsOdometerPlausibilityPolicyInput,
  ) => Promise<boolean>;
  readonly onReview: (item: PendingGpsOdometerReview) => void;
  readonly onSuspend: (authority: GpsOdometerAuthority) => void;
}): React.JSX.Element {
  return (
    <div className="gps-odometer-management__workspace">
      <section
        className="gps-odometer-management__section"
        aria-labelledby="gps-odometer-candidates"
      >
        <SectionHeading
          count={data.candidates.length}
          eyebrow="Paso 1 · Verificar evidencia"
          id="gps-odometer-candidates"
          title="Lecturas Goldcar disponibles"
          copy="Cada lectura proviene del sensor Odómetro validado, no del contador Distancia. Compara el valor, la hora y el kilometraje oficial antes de usar una fuente."
        />
        {data.candidates.length === 0 ? (
          <EmptyState
            copy="Aún no hay una lectura Goldcar validada que puedas usar como fuente oficial. El kilometraje oficial no puede cambiar desde esta pantalla."
            title="No hay una fuente oficial disponible"
          />
        ) : (
          <div className="gps-odometer-management__candidate-list">
            {data.candidates.map((candidate) => (
              <CandidateCard
                candidate={candidate}
                key={candidate.positionId}
                onActivate={onActivate}
              />
            ))}
          </div>
        )}
      </section>

      <PolicySection
        busy={busyAction === "POLICY"}
        policy={data.plausibilityPolicy}
        onConfigure={onConfigurePolicy}
      />

      <section
        className="gps-odometer-management__section"
        aria-labelledby="gps-odometer-authorities"
      >
        <SectionHeading
          count={data.authorities.length}
          eyebrow="Estado de las fuentes"
          id="gps-odometer-authorities"
          title="Fuentes oficiales por unidad"
          copy="Una fuente activa puede aportar futuras actualizaciones del kilometraje oficial y su telemetría puede mostrarse en operación. Suspenderla detiene esas actualizaciones y oculta la telemetría, sin borrar la evidencia GPS ni el historial."
        />
        {data.authorities.length === 0 ? (
          <EmptyState
            copy="Ninguna unidad tiene todavía una fuente Goldcar activa o suspendida."
            title="Sin fuentes oficiales"
          />
        ) : (
          <ul className="gps-odometer-management__authority-list">
            {data.authorities.map((authority) => (
              <li key={authority.id}>
                <div>
                  <strong className="technical-value">{authority.vehicleLabel}</strong>
                  <small>
                    Enrolada {formatDateTime(authority.activatedAt)} ·{" "}
                    {bootstrapModeLabel(authority.bootstrapMode)}
                  </small>
                  {authority.suspendedAt === null ? null : (
                    <small>Suspendida {formatDateTime(authority.suspendedAt)}</small>
                  )}
                  {authority.suspensionReason === null ? null : (
                    <small>Motivo de suspensión: {authority.suspensionReason}</small>
                  )}
                </div>
                <div className="gps-odometer-management__authority-action">
                  <StatusChip
                    label={authorityStatusLabel(authority.status)}
                    tone={authority.status === "active" ? "success" : "warning"}
                  />
                  {authority.status === "active" ? (
                    <Button onClick={() => onSuspend(authority)} variant="danger">
                      Suspender
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="gps-odometer-management__section" aria-labelledby="gps-odometer-reviews">
        <SectionHeading
          count={data.pendingReviews.length}
          eyebrow="Paso 3 · Decisión necesaria"
          id="gps-odometer-reviews"
          title="Lecturas que requieren revisión"
          copy="El sistema no actualizó el kilometraje oficial automáticamente. Verifica la lectura y decide si debe aprobarse o mantenerse sin cambio."
        />
        {data.pendingReviews.length === 0 ? (
          <EmptyState
            copy="No hay lecturas Goldcar pendientes de una decisión de Gerencia."
            title="Sin revisiones pendientes"
          />
        ) : (
          <ul className="gps-odometer-management__review-list">
            {data.pendingReviews.map((item) => (
              <li key={item.promotionId}>
                <div>
                  <strong className="technical-value">{item.vehicleLabel}</strong>
                  <small>
                    Lectura Goldcar: {formatKilometers(item.reportedOdometerKm)} · oficial al
                    detectar: {formatKilometers(item.previousOdometerKm)}
                  </small>
                  <small>Lectura registrada {formatDateTime(item.recordedAt)}</small>
                </div>
                <Button onClick={() => onReview(item)} variant="secondary">
                  Revisar lectura
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CandidateCard({
  candidate,
  onActivate,
}: {
  readonly candidate: GpsOdometerCandidate;
  readonly onActivate: (candidate: GpsOdometerCandidate) => void;
}): React.JSX.Element {
  const active = candidate.authorityStatus === "active";
  return (
    <article className="gps-odometer-management__candidate">
      <div className="gps-odometer-management__candidate-heading">
        <div>
          <p className="technical-value">{candidate.vehicleLabel}</p>
          <h3>Lectura validada de Goldcar</h3>
        </div>
        <StatusChip
          label={authorityStatusLabel(candidate.authorityStatus)}
          tone={
            active ? "success" : candidate.authorityStatus === "suspended" ? "warning" : "neutral"
          }
        />
      </div>
      <dl className="gps-odometer-management__metrics">
        <Metric
          label="Lectura de odómetro Goldcar"
          value={formatKilometers(candidate.odometerKm)}
          emphasized
        />
        <Metric
          label="Kilometraje oficial actual"
          value={formatKilometers(candidate.currentOdometerKm)}
        />
        <Metric label="Hora de la lectura" value={formatDateTime(candidate.recordedAt)} />
        <Metric label="Recibida por R&T" value={formatDateTime(candidate.receivedAt)} />
      </dl>
      <p>
        Esta evidencia contiene el sensor <strong>Odómetro</strong>. Antes de aceptarla, el servidor
        volverá a verificar que siga vigente, que la unidad no tenga un viaje activo y que el
        kilometraje oficial no haya cambiado.
      </p>
      {active ? (
        <p className="gps-odometer-management__candidate-note">
          Esta fuente ya está activa. Una lectura futura solo actualizará el kilometraje oficial si
          cumple los límites configurados; de lo contrario, quedará para revisión de Gerencia.
        </p>
      ) : (
        <Button icon="gauge" onClick={() => onActivate(candidate)}>
          {bootstrapActionLabel(candidate)}
        </Button>
      )}
    </article>
  );
}

function PolicySection({
  busy,
  policy,
  onConfigure,
}: {
  readonly busy: boolean;
  readonly policy: GpsOdometerManagementBootstrap["plausibilityPolicy"];
  readonly onConfigure: (input: ConfigureGpsOdometerPlausibilityPolicyInput) => Promise<boolean>;
}): React.JSX.Element {
  return (
    <section className="gps-odometer-management__section" aria-labelledby="gps-odometer-policy">
      <SectionHeading
        eyebrow="Paso 2 · Regla para lecturas futuras"
        id="gps-odometer-policy"
        title="Límites para actualizar automáticamente"
        copy="Definen cuándo una lectura posterior de Goldcar puede actualizar el kilometraje oficial sin revisión manual. Se aplican a todas las fuentes Goldcar activas de la empresa."
      />
      {policy === null ? (
        <div className="gps-odometer-management__policy-state gps-odometer-management__policy-state--missing">
          <Icon name="settings" size={20} />
          <div>
            <strong>Sin límites configurados</strong>
            <p>
              Hasta que los definas, las lecturas posteriores no actualizarán el kilometraje oficial
              automáticamente y quedarán para revisión de Gerencia.
            </p>
          </div>
        </div>
      ) : (
        <div className="gps-odometer-management__policy-state">
          <dl className="gps-odometer-management__metrics">
            <Metric
              label="Avance automático máximo por lectura"
              value={formatKilometers(policy.maxAutoAdvanceKm)}
            />
            <Metric
              label="Velocidad promedio máxima entre lecturas"
              value={`${formatNumber(policy.maxAverageSpeedKmh)} km/h`}
            />
            <Metric label="Versión de estos límites" value={`v${policy.version}`} />
          </dl>
          <p>
            Configurados {formatDateTime(policy.configuredAt)}. Motivo registrado: {policy.reason}
          </p>
        </div>
      )}
      <details className="gps-odometer-management__policy-disclosure">
        <summary>
          <span>
            <strong>{policy === null ? "Definir límites" : "Cambiar límites"}</strong>
            <small>El servidor registra el motivo y conserva una versión de cada cambio.</small>
          </span>
          <Icon name="chevron" size={18} />
        </summary>
        <PolicyForm busy={busy} onConfigure={onConfigure} />
      </details>
    </section>
  );
}

function PolicyForm({
  busy,
  onConfigure,
}: {
  readonly busy: boolean;
  readonly onConfigure: (input: ConfigureGpsOdometerPlausibilityPolicyInput) => Promise<boolean>;
}): React.JSX.Element {
  const [maxAutoAdvanceKm, setMaxAutoAdvanceKm] = useState("");
  const [maxAverageSpeedKmh, setMaxAverageSpeedKmh] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    try {
      const requestKey = idempotencyKey ?? createGpsOdometerIdempotencyKey();
      if (idempotencyKey === null) setIdempotencyKey(requestKey);
      const published = await onConfigure({
        maxAutoAdvanceKm: validateGpsOdometerPositiveDecimal(
          maxAutoAdvanceKm,
          "El avance automático máximo",
        ),
        maxAverageSpeedKmh: validateGpsOdometerPositiveDecimal(
          maxAverageSpeedKmh,
          "La velocidad promedio máxima",
        ),
        reason: validateGpsOdometerReason(reason),
        idempotencyKey: requestKey,
      });
      setError(null);
      if (published) {
        setMaxAutoAdvanceKm("");
        setMaxAverageSpeedKmh("");
        setReason("");
        setConfirmed(false);
        setIdempotencyKey(null);
      }
    } catch (caught) {
      setError(clientErrorMessage(caught));
    }
  }

  return (
    <form className="gps-odometer-management__policy-form" onSubmit={submit}>
      <p className="gps-odometer-management__form-intro">
        Estos valores no modifican el kilometraje oficial actual. Solo se aplican a lecturas Goldcar
        futuras después de la confirmación del servidor.
      </p>
      <fieldset disabled={busy}>
        <label>
          <span>Límite de kilómetros por lectura</span>
          <input
            aria-describedby="gps-odometer-max-advance-help"
            inputMode="decimal"
            min="0.01"
            onChange={(event) => {
              setMaxAutoAdvanceKm(event.target.value);
              setIdempotencyKey(null);
            }}
            required
            step="0.01"
            type="number"
            value={maxAutoAdvanceKm}
            placeholder="Ejemplo de formato: 250.50"
          />
          <small className="gps-odometer-management__field-help" id="gps-odometer-max-advance-help">
            Máximo aumento permitido en una lectura antes de que requiera revisión. Usa hasta dos
            decimales.
          </small>
        </label>
        <label>
          <span>Límite de velocidad promedio entre lecturas</span>
          <input
            aria-describedby="gps-odometer-max-speed-help"
            inputMode="decimal"
            min="0.01"
            onChange={(event) => {
              setMaxAverageSpeedKmh(event.target.value);
              setIdempotencyKey(null);
            }}
            required
            step="0.01"
            type="number"
            value={maxAverageSpeedKmh}
            placeholder="Ejemplo de formato: 90"
          />
          <small className="gps-odometer-management__field-help" id="gps-odometer-max-speed-help">
            Se calcula con la hora de ambas evidencias. Si se supera, la lectura quedará para
            revisión en lugar de actualizarse automáticamente.
          </small>
        </label>
        <label className="gps-odometer-management__policy-reason">
          <span>¿Por qué estos límites son apropiados?</span>
          <textarea
            aria-describedby="gps-odometer-policy-reason-help"
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value);
              setIdempotencyKey(null);
            }}
            required
            rows={3}
            value={reason}
            placeholder="Ejemplo: Límites revisados para la operación habitual de las unidades."
          />
          <small
            className="gps-odometer-management__field-help"
            id="gps-odometer-policy-reason-help"
          >
            Este motivo quedará registrado junto con los límites. Máximo 500 caracteres.
          </small>
        </label>
        <label className="gps-odometer-management__policy-confirmation">
          <input
            aria-describedby="gps-odometer-policy-confirmation-help"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
            required
            type="checkbox"
          />
          <span id="gps-odometer-policy-confirmation-help">
            Confirmo que estos límites se aplicarán a futuras lecturas de todas las unidades con una
            fuente Goldcar activa de esta empresa.
          </span>
        </label>
        {error === null ? null : <p role="alert">{error}</p>}
        <div>
          <Button aria-busy={busy} type="submit">
            {busy ? "Guardando límites…" : "Guardar límites para futuras lecturas"}
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

function ActivationDialog({
  busy,
  candidate,
  onClose,
  onConfirm,
  serverError,
}: {
  readonly busy: boolean;
  readonly candidate: GpsOdometerCandidate;
  readonly onClose: () => void;
  readonly onConfirm: (mode: GpsOdometerBootstrapMode, reason: string) => void;
  readonly serverError: string | null;
}): React.JSX.Element {
  const mayUseTestPlaceholder = canOfferTestPlaceholderCorrection(candidate);
  const [useTestPlaceholder, setUseTestPlaceholder] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mode: GpsOdometerBootstrapMode = useTestPlaceholder ? "test_placeholder" : "standard";

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      onConfirm(mode, validateGpsOdometerReason(reason));
      setError(null);
    } catch (caught) {
      setError(clientErrorMessage(caught));
    }
  }

  return (
    <ManagementActionDialog
      busy={busy}
      copy="Revisa ambos valores antes de continuar. Nada cambia hasta que el servidor vuelva a validar la evidencia actual."
      eyebrow="Paso 2 · Activar fuente"
      onClose={onClose}
      title={`${bootstrapActionLabel(candidate)} · ${candidate.vehicleLabel}`}
    >
      <form className="gps-odometer-management__dialog-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <dl className="gps-odometer-management__dialog-metrics">
            <Metric
              label="Lectura Goldcar validada"
              value={formatKilometers(candidate.odometerKm)}
              emphasized
            />
            <Metric
              label="Kilometraje oficial actual"
              value={formatKilometers(candidate.currentOdometerKm)}
            />
          </dl>
          <div className="gps-odometer-management__decision-impact" role="note">
            <strong>Qué ocurrirá al confirmar</strong>
            <p>
              {useTestPlaceholder
                ? "El servidor solo reemplazará el marcador de prueba de esta unidad por la lectura Goldcar validada si sigue cumpliendo la excepción autorizada."
                : "El servidor registrará esta lectura como punto de partida y activará la fuente. Si la lectura es mayor que el kilometraje oficial actual, lo actualizará; si es igual, solo lo confirmará."}
            </p>
          </div>
          {mayUseTestPlaceholder ? (
            <label className="gps-odometer-management__exception-check">
              <input
                checked={useTestPlaceholder}
                onChange={(event) => setUseTestPlaceholder(event.target.checked)}
                type="checkbox"
              />
              <span>
                Usar la única corrección autorizada del marcador de prueba. Solo está disponible
                para esta unidad y este kilometraje oficial actual; el servidor la rechaza en
                cualquier otro caso.
              </span>
            </label>
          ) : null}
          <label>
            <span>¿Por qué esta lectura debe convertirse en la fuente oficial?</span>
            <textarea
              aria-describedby="gps-odometer-activation-reason-help"
              data-autofocus
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              required
              rows={4}
              value={reason}
              placeholder="Ejemplo: Lectura Goldcar contrastada y aprobada como lectura inicial."
            />
            <small id="gps-odometer-activation-reason-help">
              Deja la justificación que acompañará la auditoría. {reason.length}/500 caracteres
            </small>
          </label>
          {(error ?? serverError) ? <p role="alert">{error ?? serverError}</p> : null}
          <footer>
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button aria-busy={busy} type="submit">
              {busy ? "Confirmando…" : "Confirmar fuente oficial"}
            </Button>
          </footer>
        </fieldset>
      </form>
    </ManagementActionDialog>
  );
}

function ReasonDialog({
  busy,
  confirmLabel,
  copy,
  eyebrow,
  onClose,
  onConfirm,
  serverError,
  title,
  variant = "primary",
}: {
  readonly busy: boolean;
  readonly confirmLabel: string;
  readonly copy: string;
  readonly eyebrow: string;
  readonly onClose: () => void;
  readonly onConfirm: (reason: string) => void;
  readonly serverError: string | null;
  readonly title: string;
  readonly variant?: "primary" | "danger";
}): React.JSX.Element {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      onConfirm(validateGpsOdometerReason(reason));
      setError(null);
    } catch (caught) {
      setError(clientErrorMessage(caught));
    }
  }

  return (
    <ManagementActionDialog
      busy={busy}
      copy={copy}
      eyebrow={eyebrow}
      onClose={onClose}
      title={title}
    >
      <form className="gps-odometer-management__dialog-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <label>
            <span>¿Por qué se suspende esta fuente?</span>
            <textarea
              aria-describedby="gps-odometer-suspension-reason-help"
              data-autofocus
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              required
              rows={4}
              value={reason}
              placeholder="Ejemplo: La lectura necesita una revisión antes de volver a usar la fuente."
            />
            <small id="gps-odometer-suspension-reason-help">
              Explica la decisión para el historial de la unidad. {reason.length}/500 caracteres
            </small>
          </label>
          {(error ?? serverError) ? <p role="alert">{error ?? serverError}</p> : null}
          <footer>
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button aria-busy={busy} type="submit" variant={variant}>
              {busy ? "Confirmando…" : confirmLabel}
            </Button>
          </footer>
        </fieldset>
      </form>
    </ManagementActionDialog>
  );
}

function ReviewDialog({
  busy,
  item,
  onClose,
  onConfirm,
  serverError,
}: {
  readonly busy: boolean;
  readonly item: PendingGpsOdometerReview;
  readonly onClose: () => void;
  readonly onConfirm: (decision: GpsOdometerReviewDecision, reason: string) => void;
  readonly serverError: string | null;
}): React.JSX.Element {
  const [decision, setDecision] = useState<GpsOdometerReviewDecision>("approved");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      onConfirm(decision, validateGpsOdometerReason(reason));
      setError(null);
    } catch (caught) {
      setError(clientErrorMessage(caught));
    }
  }

  return (
    <ManagementActionDialog
      busy={busy}
      copy="La actualización automática se detuvo para que la revises. Al aprobar, el servidor solo actualizará el kilometraje oficial si esta misma lectura sigue vigente y pasa todos los controles. Al rechazar, conserva la evidencia sin cambiar el kilometraje oficial."
      eyebrow="Decisión de Gerencia"
      onClose={onClose}
      title={`Revisar lectura Goldcar · ${item.vehicleLabel}`}
    >
      <form className="gps-odometer-management__dialog-form" onSubmit={submit}>
        <fieldset disabled={busy}>
          <dl className="gps-odometer-management__dialog-metrics">
            <Metric
              label="Lectura Goldcar pendiente"
              value={formatKilometers(item.reportedOdometerKm)}
              emphasized
            />
            <Metric
              label="Kilometraje oficial al detectar"
              value={formatKilometers(item.previousOdometerKm)}
            />
          </dl>
          <label>
            <span>Decisión para esta lectura</span>
            <select
              aria-describedby="gps-odometer-review-decision-help"
              data-autofocus
              onChange={(event) =>
                setDecision(event.target.value === "rejected" ? "rejected" : "approved")
              }
              value={decision}
            >
              <option value="approved">Aprobar y actualizar solo si sigue vigente</option>
              <option value="rejected">Rechazar y mantener el kilometraje oficial</option>
            </select>
            <small id="gps-odometer-review-decision-help">
              La comprobación final se hace en el servidor con la evidencia actual.
            </small>
          </label>
          <label>
            <span>¿Por qué tomas esta decisión?</span>
            <textarea
              aria-describedby="gps-odometer-review-reason-help"
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              required
              rows={4}
              value={reason}
              placeholder="Ejemplo: Lectura contrastada con la unidad y aprobada por Gerencia."
            />
            <small id="gps-odometer-review-reason-help">
              Este motivo quedará en el historial de la revisión. {reason.length}/500 caracteres
            </small>
          </label>
          {(error ?? serverError) ? <p role="alert">{error ?? serverError}</p> : null}
          <footer>
            <Button onClick={onClose} variant="secondary">
              Cancelar
            </Button>
            <Button
              aria-busy={busy}
              type="submit"
              variant={decision === "rejected" ? "danger" : "primary"}
            >
              {busy
                ? "Confirmando…"
                : decision === "approved"
                  ? "Confirmar aprobación"
                  : "Confirmar rechazo"}
            </Button>
          </footer>
        </fieldset>
      </form>
    </ManagementActionDialog>
  );
}

function ManagementActionDialog({
  busy,
  children,
  copy,
  eyebrow,
  onClose,
  title,
}: {
  readonly busy: boolean;
  readonly children: React.ReactNode;
  readonly copy: string;
  readonly eyebrow: string;
  readonly onClose: () => void;
  readonly title: string;
}): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `gps-odometer-dialog-${title.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
  const copyId = `${titleId}-copy`;

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog === null) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      if (dialog.open && typeof dialog.close === "function") dialog.close();
      previousFocus?.focus();
    };
  }, []);

  return (
    <dialog
      aria-labelledby={titleId}
      aria-describedby={copyId}
      aria-modal="true"
      className="gps-odometer-management__dialog"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      ref={dialogRef}
    >
      <article>
        <header>
          <div>
            <p>{eyebrow}</p>
            <h2 id={titleId}>{title}</h2>
            <p id={copyId}>{copy}</p>
          </div>
          <button aria-label="Cerrar confirmación" disabled={busy} onClick={onClose} type="button">
            <Icon name="close" size={19} />
          </button>
        </header>
        {children}
      </article>
    </dialog>
  );
}

function SectionHeading({
  copy,
  count,
  eyebrow,
  id,
  title,
}: {
  readonly copy: string;
  readonly count?: number;
  readonly eyebrow: string;
  readonly id: string;
  readonly title: string;
}): React.JSX.Element {
  return (
    <header className="gps-odometer-management__section-heading">
      <div>
        <p>{eyebrow}</p>
        <h2 id={id}>{title}</h2>
        <small>{copy}</small>
      </div>
      {count === undefined ? null : <span aria-label={`${count} registros`}>{count}</span>}
    </header>
  );
}

function Metric({
  emphasized = false,
  label,
  value,
}: {
  readonly emphasized?: boolean;
  readonly label: string;
  readonly value: string;
}): React.JSX.Element {
  return (
    <div
      className={
        emphasized
          ? "gps-odometer-management__metric gps-odometer-management__metric--emphasized"
          : "gps-odometer-management__metric"
      }
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EmptyState({
  title,
  copy,
}: {
  readonly title: string;
  readonly copy: string;
}): React.JSX.Element {
  return (
    <div className="gps-odometer-management__empty">
      <Icon name="gauge" size={22} />
      <div>
        <strong>{title}</strong>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function PageNotice({
  action,
  copy,
  icon = "gauge",
  title,
}: {
  readonly action?: React.ReactNode;
  readonly copy: string;
  readonly icon?: "gauge" | "offline";
  readonly title: string;
}): React.JSX.Element {
  return (
    <section className="gps-odometer-management__notice">
      <Icon name={icon} size={25} />
      <h1>{title}</h1>
      <p>{copy}</p>
      {action}
    </section>
  );
}

function bootstrapModeLabel(mode: GpsOdometerBootstrapMode): string {
  return mode === "test_placeholder" ? "corrección excepcional registrada" : "activación inicial";
}

function formatKilometers(value: number): string {
  return `${formatNumber(value)} km`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Hora no disponible";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function clientErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("Explica")) return error.message;
  if (error instanceof Error && error.message.includes("número positivo")) return error.message;
  if (error instanceof Error && error.message.includes("clave segura")) return error.message;
  return "El servidor no confirmó esta acción. Actualiza la evidencia y vuelve a intentarlo.";
}
