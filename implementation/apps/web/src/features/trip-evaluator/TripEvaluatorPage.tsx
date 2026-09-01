import { calculateTripEvaluation, type TripEvaluationResult } from "@rt-sitram/domain";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../../components/primitives/Button";
import { FieldGuidance } from "../../components/primitives/FieldGuidance";
import { GuidanceNote } from "../../components/primitives/GuidanceNote";
import { Icon } from "../../components/primitives/Icon";
import { SectionIntro } from "../../components/primitives/SectionIntro";
import { StatusChip } from "../../components/primitives/StatusChip";
import { useIdentity } from "../identity/IdentityProvider";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { getSupabaseClient } from "../../lib/supabase";
import {
  createSupabaseEvaluationDataGateway,
  type EvaluationDataGateway,
  type PersistedEvaluationPolicy,
  type TripEvaluatorBootstrap,
} from "./evaluation-data";
import {
  createCostLine,
  createEconomicPolicyDraft,
  createTripEvaluatorDraft,
  hydrateTripEvaluatorDraft,
  toEvaluationPolicy,
  toEvaluationRpcInput,
  toPolicyCommandInput,
  toTripEvaluationInput,
  type EditableCostLine,
  type EconomicPolicyDraft,
  type TripEvaluatorDraftSnapshot,
  type TripEvaluatorDraft,
} from "./evaluation-model";
import "./trip-evaluator.css";

type LoadState =
  | { readonly kind: "LOADING" }
  | { readonly kind: "READY"; readonly data: TripEvaluatorBootstrap }
  | { readonly kind: "ERROR"; readonly message: string };

interface CalculationState {
  readonly result: TripEvaluationResult | null;
  readonly error: string | null;
}

interface EditingEvaluation {
  readonly id: string;
  readonly expectedVersion: number;
  readonly reference: string | null;
}

const EVALUATION_STEPS = [
  {
    id: "service",
    label: "Servicio y costos",
    question: "¿Qué carga estás evaluando y qué costará realizar la ida?",
  },
  {
    id: "return",
    label: "Retorno",
    question: "¿Cómo regresará la unidad?",
  },
  {
    id: "review",
    label: "Revisión",
    question: "Revisa los supuestos y entiende el resultado.",
  },
] as const;

type EvaluationStepId = (typeof EVALUATION_STEPS)[number]["id"];

export function TripEvaluatorPage(): React.JSX.Element {
  const { state: identityState } = useIdentity();
  const networkStatus = useNetworkStatus();
  const client = getSupabaseClient();
  const gateway = useMemo<EvaluationDataGateway | null>(
    () => (client === null ? null : createSupabaseEvaluationDataGateway(client)),
    [client],
  );
  const [loadState, setLoadState] = useState<LoadState>({ kind: "LOADING" });
  const [policyDraft, setPolicyDraft] = useState<EconomicPolicyDraft>(createEconomicPolicyDraft);
  const [evaluationDraft, setEvaluationDraft] =
    useState<TripEvaluatorDraft>(createTripEvaluatorDraft);
  const [evaluationIdempotencyKey, setEvaluationIdempotencyKey] = useState(createIdempotencyKey);
  const [editingEvaluation, setEditingEvaluation] = useState<EditingEvaluation | null>(null);
  const [policyBusy, setPolicyBusy] = useState(false);
  const [evaluationBusy, setEvaluationBusy] = useState(false);
  const [evaluationActionId, setEvaluationActionId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = async (): Promise<void> => {
    if (gateway === null) {
      setLoadState({
        kind: "ERROR",
        message: "El Evaluador requiere una conexión configurada con el servidor.",
      });
      return;
    }
    setLoadState({ kind: "LOADING" });
    try {
      setLoadState({ kind: "READY", data: await gateway.loadBootstrap() });
    } catch (error) {
      setLoadState({ kind: "ERROR", message: errorMessage(error) });
    }
  };

  useEffect(() => {
    void reload();
    // `gateway` changes only when the controlled Supabase client changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gateway]);

  const activePolicy = loadState.kind === "READY" ? loadState.data.activePolicy : null;
  const calculation = useCalculation(evaluationDraft, activePolicy);
  const canManagePolicy =
    identityState.status === "READY" && identityState.identity.profile.role === "management";
  const canFixEvaluations =
    identityState.status === "READY" &&
    (identityState.identity.profile.role === "management" ||
      identityState.identity.profile.role === "administration");

  async function submitPolicy(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (gateway === null) return;
    setActionError(null);
    setNotice(null);
    setPolicyBusy(true);
    try {
      const created = await gateway.createPolicy(toPolicyCommandInput(policyDraft));
      setNotice(`La política ${created.name} v${created.version} fue publicada en el servidor.`);
      setPolicyDraft(createEconomicPolicyDraft());
      await reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setPolicyBusy(false);
    }
  }

  async function submitEvaluation(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (gateway === null || activePolicy === null) return;
    setActionError(null);
    setNotice(null);
    setEvaluationBusy(true);
    try {
      const input = toTripEvaluationInput(evaluationDraft, activePolicy.costCoverage);
      const saved = await gateway.saveEvaluation({
        policyId: activePolicy.id,
        input: toEvaluationRpcInput(input),
        clientId: optionalId(evaluationDraft.clientId),
        vehicleId: optionalId(evaluationDraft.vehicleId),
        reference: optionalText(evaluationDraft.reference),
        ...(editingEvaluation === null
          ? {}
          : {
              evaluationId: editingEvaluation.id,
              expectedVersion: editingEvaluation.expectedVersion,
            }),
        idempotencyKey: evaluationIdempotencyKey,
      });
      setNotice(
        `La evaluación ${saved.reference ?? shortId(saved.id)} ${editingEvaluation === null ? "se guardó" : "se actualizó"} en el servidor con la política v${saved.policyVersion}.`,
      );
      setEvaluationDraft(createTripEvaluatorDraft());
      setEvaluationIdempotencyKey(createIdempotencyKey());
      setEditingEvaluation(null);
      await reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setEvaluationBusy(false);
    }
  }

  async function fixEvaluation(evaluationId: string): Promise<void> {
    if (gateway === null) return;
    setActionError(null);
    setNotice(null);
    setEvaluationActionId(evaluationId);
    try {
      const fixed = await gateway.fixEvaluation(evaluationId);
      setNotice(
        fixed.status === "EXCEPTION_REQUIRED"
          ? "La evaluación requiere una excepción de Gerencia antes de quedar fijada."
          : "La evaluación quedó fijada con la política y los supuestos auditados.",
      );
      await reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setEvaluationActionId(null);
    }
  }

  async function approveException(exceptionId: string, reason: string): Promise<void> {
    if (gateway === null) return;
    setActionError(null);
    setNotice(null);
    setEvaluationActionId(exceptionId);
    try {
      await gateway.approveException(exceptionId, reason);
      setNotice("La excepción fue aprobada y la evaluación quedó fijada.");
      await reload();
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setEvaluationActionId(null);
    }
  }

  function editDraft(snapshot: TripEvaluatorDraftSnapshot & EditingEvaluation): void {
    try {
      setEvaluationDraft(hydrateTripEvaluatorDraft(snapshot));
      setEditingEvaluation({
        id: snapshot.id,
        expectedVersion: snapshot.expectedVersion,
        reference: snapshot.reference,
      });
      setEvaluationIdempotencyKey(createIdempotencyKey());
      setActionError(null);
      setNotice(`Editando el borrador ${snapshot.reference ?? shortId(snapshot.id)}.`);
    } catch (error) {
      setActionError(errorMessage(error));
    }
  }

  function cancelEditingDraft(): void {
    setEvaluationDraft(createTripEvaluatorDraft());
    setEditingEvaluation(null);
    setEvaluationIdempotencyKey(createIdempotencyKey());
    setActionError(null);
    setNotice("Se descartó la edición del borrador. No se modificó el registro guardado.");
  }

  if (identityState.status !== "READY") {
    return <EvaluatorNotice title="Preparando Evaluador" copy="Cargando permisos de la sesión…" />;
  }

  return (
    <div className="trip-evaluator">
      <header className="trip-evaluator__header">
        <div>
          <p className="trip-evaluator__eyebrow">Decisión comercial</p>
          <h1>Evaluador de Viajes</h1>
          <p>
            Compara una oferta antes de negociar. Las cifras son estimaciones de margen directo, no
            utilidad neta ni registros financieros.
          </p>
        </div>
        <div className="trip-evaluator__header-status">
          <StatusChip
            label={networkStatus === "OFFLINE" ? "Sin conexión" : "Conexión disponible"}
            tone={networkStatus === "OFFLINE" ? "warning" : "info"}
          />
          <small>Los borradores se guardan solo cuando el servidor confirma la respuesta.</small>
        </div>
      </header>

      {notice === null ? null : (
        <p className="trip-evaluator__feedback trip-evaluator__feedback--success" role="status">
          {notice}
        </p>
      )}
      {actionError === null ? null : (
        <p className="trip-evaluator__feedback trip-evaluator__feedback--error" role="alert">
          {actionError}
        </p>
      )}

      {loadState.kind === "LOADING" ? (
        <EvaluatorNotice
          title="Consultando configuración"
          copy="Verificando políticas y maestros autorizados…"
        />
      ) : null}
      {loadState.kind === "ERROR" ? (
        <EvaluatorNotice
          title="No se pudo abrir el Evaluador"
          copy={loadState.message}
          action={
            <Button icon="wifi" onClick={() => void reload()} variant="secondary">
              Reintentar
            </Button>
          }
        />
      ) : null}
      {loadState.kind !== "READY" ? null : (
        <>
          <PolicySummary policy={activePolicy} />
          {activePolicy === null ? (
            canManagePolicy ? (
              <PolicyForm
                busy={policyBusy}
                draft={policyDraft}
                onChange={setPolicyDraft}
                onSubmit={(event) => void submitPolicy(event)}
              />
            ) : (
              <EvaluatorNotice
                title="Falta una política económica activa"
                copy="Gerencia debe publicar la política de márgenes, cobertura y tratamiento tributario antes de calcular o guardar una evaluación."
              />
            )
          ) : (
            <EvaluationWorkspace
              busy={evaluationBusy}
              calculation={calculation}
              draft={evaluationDraft}
              editingReference={editingEvaluation?.reference ?? null}
              key={editingEvaluation?.id ?? "new-evaluation"}
              onChange={(next) => {
                setEvaluationDraft(next);
                setEvaluationIdempotencyKey(createIdempotencyKey());
              }}
              onCancelEditing={cancelEditingDraft}
              onSubmit={(event) => void submitEvaluation(event)}
              options={loadState.data}
              policy={activePolicy}
              serverAvailable={networkStatus === "ONLINE"}
            />
          )}
          {canManagePolicy && activePolicy !== null ? (
            <details className="trip-evaluator__policy-disclosure">
              <summary>
                <span>
                  <strong>Publicar una nueva versión de política</strong>
                  <small>Los cambios no alteran las evaluaciones ya guardadas.</small>
                </span>
                <Icon name="chevron" />
              </summary>
              <PolicyForm
                busy={policyBusy}
                draft={policyDraft}
                onChange={setPolicyDraft}
                onSubmit={(event) => void submitPolicy(event)}
              />
            </details>
          ) : null}
          <EvaluationHistory
            canApproveExceptions={canManagePolicy}
            canFixEvaluations={canFixEvaluations}
            evaluations={loadState.data.evaluations}
            exceptions={loadState.data.exceptions}
            onApproveException={(exceptionId, reason) => void approveException(exceptionId, reason)}
            onEdit={(evaluation) =>
              editDraft({
                id: evaluation.id,
                expectedVersion: evaluation.version,
                reference: evaluation.reference,
                clientId: evaluation.clientId,
                vehicleId: evaluation.vehicleId,
                input: evaluation.input,
              })
            }
            onFix={(evaluationId) => void fixEvaluation(evaluationId)}
            pendingActionId={evaluationActionId}
          />
        </>
      )}
    </div>
  );
}

function useCalculation(
  draft: TripEvaluatorDraft,
  policy: PersistedEvaluationPolicy | null,
): CalculationState {
  return useMemo(() => {
    if (policy === null) return { result: null, error: null };
    try {
      return {
        result: calculateTripEvaluation(
          toTripEvaluationInput(draft, policy.costCoverage),
          toEvaluationPolicy(policy),
        ),
        error: null,
      };
    } catch (error) {
      return { result: null, error: errorMessage(error) };
    }
  }, [draft, policy]);
}

function PolicySummary({
  policy,
}: {
  readonly policy: PersistedEvaluationPolicy | null;
}): React.JSX.Element {
  if (policy === null) {
    return (
      <section className="trip-evaluator__policy trip-evaluator__policy--missing">
        <Icon name="settings" size={22} />
        <div>
          <h2>Configura la primera política económica</h2>
          <p>
            No hay porcentajes ni cobertura fijados en el código. Publica los valores autorizados
            para habilitar el cálculo.
          </p>
        </div>
      </section>
    );
  }
  const marginCopy =
    policy.marginBasis === "REVENUE" ? "margen sobre ingreso" : "margen sobre costo";
  return (
    <section className="trip-evaluator__policy" aria-label="Política económica activa">
      <div className="trip-evaluator__policy-mark" aria-hidden="true">
        <Icon name="settings" size={20} />
      </div>
      <div>
        <p>Política activa · versión {policy.version}</p>
        <h2>{policy.name}</h2>
        <small>
          {formatPercent(policy.minimumMarginRate)} mínimo ·{" "}
          {formatPercent(policy.targetMarginRate)} objetivo · {marginCopy} · montos{" "}
          {policy.taxBasis === "INCLUDED" ? "con impuestos incluidos" : "sin impuestos"} · tasa
          declarada {formatPercent(policy.taxRate)}
        </small>
      </div>
      <StatusChip label="Versionada" tone="success" />
    </section>
  );
}

function PolicyForm({
  busy,
  draft,
  onChange,
  onSubmit,
}: {
  readonly busy: boolean;
  readonly draft: EconomicPolicyDraft;
  readonly onChange: (next: EconomicPolicyDraft) => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}): React.JSX.Element {
  return (
    <form className="trip-evaluator__form trip-evaluator__form--policy" onSubmit={onSubmit}>
      <SectionIntro
        aside="Los valores se guardan con cada evaluación; no hay umbrales predeterminados."
        description="Define cómo se interpreta el margen y qué costos cubre. Esta configuración es responsabilidad de Gerencia."
        eyebrow="Configuración de Gerencia"
        title="Publica una política económica"
      />
      <div className="trip-evaluator__fields trip-evaluator__fields--four">
        <TextField
          example="NEGOCIACION-2026"
          help="Identificador interno para reconocer esta política."
          label="Código de política"
          name="policy-key"
          placeholder="Ejemplo: NEGOCIACION-2026"
          required
          value={draft.policyKey}
          onChange={(policyKey) => onChange({ ...draft, policyKey })}
        />
        <TextField
          example="Negociación nacional"
          help="Nombre visible para quienes evalúan una carga."
          label="Nombre"
          name="policy-name"
          placeholder="Ejemplo: Negociación nacional"
          required
          value={draft.name}
          onChange={(name) => onChange({ ...draft, name })}
        />
        <TextField
          example="PEN"
          help="Código de moneda de tres letras que usarán los montos de esta política."
          label="Moneda"
          name="policy-currency"
          placeholder="Ejemplo: PEN"
          required
          value={draft.currency}
          onChange={(currency) => onChange({ ...draft, currency })}
        />
        <SelectField
          help="Indica si los montos que se registrarán ya incluyen impuestos."
          label="Base tributaria"
          name="tax-basis"
          value={draft.taxBasis}
          onChange={(taxBasis) =>
            onChange({
              ...draft,
              taxBasis: taxBasis === "EXCLUDED" || taxBasis === "INCLUDED" ? taxBasis : "",
            })
          }
          options={[
            { value: "", label: "Selecciona una base" },
            { value: "INCLUDED", label: "Montos con impuestos incluidos" },
            { value: "EXCLUDED", label: "Montos sin impuestos" },
          ]}
          required
        />
        <NumberField
          example="18"
          help="Porcentaje tributario que se conserva como referencia de la política."
          label="Tasa tributaria (%)"
          name="tax-rate"
          placeholder="Ejemplo: 18"
          required
          value={draft.taxRatePercent}
          onChange={(taxRatePercent) => onChange({ ...draft, taxRatePercent })}
        />
        <SelectField
          help="Define si el porcentaje de margen se compara contra el ingreso o contra el costo."
          label="Base del margen"
          name="margin-basis"
          value={draft.marginBasis}
          onChange={(marginBasis) =>
            onChange({
              ...draft,
              marginBasis: marginBasis === "COST" || marginBasis === "REVENUE" ? marginBasis : "",
            })
          }
          options={[
            { value: "", label: "Selecciona una base" },
            { value: "REVENUE", label: "Margen sobre ingreso" },
            { value: "COST", label: "Margen sobre costo" },
          ]}
          required
        />
        <NumberField
          example="12"
          help="Por debajo de este porcentaje, la evaluación requerirá la excepción autorizada."
          label="Margen mínimo (%)"
          name="minimum-margin"
          placeholder="Ejemplo: 12"
          required
          value={draft.minimumMarginPercent}
          onChange={(minimumMarginPercent) => onChange({ ...draft, minimumMarginPercent })}
        />
        <NumberField
          example="20"
          help="Meta de margen usada para orientar la negociación."
          label="Margen objetivo (%)"
          name="target-margin"
          placeholder="Ejemplo: 20"
          required
          value={draft.targetMarginPercent}
          onChange={(targetMarginPercent) => onChange({ ...draft, targetMarginPercent })}
        />
      </div>
      <div className="trip-evaluator__fields trip-evaluator__fields--two">
        <TextField
          example="Combustible, Peajes, Viáticos"
          help="Una categoría por concepto, separada por comas. Solo estas podrán registrarse como costo directo."
          label="Categorías incluidas en costo directo (separadas por coma)"
          name="direct-categories"
          placeholder="Ejemplo: Combustible, Peajes, Viáticos"
          value={draft.directCostCategories}
          onChange={(directCostCategories) => onChange({ ...draft, directCostCategories })}
        />
        <TextField
          example="Mantenimiento, Administración"
          help="Costos que deben seguir visibles, pero que esta política no incluye en el margen directo."
          label="Capas excluidas visibles (separadas por coma)"
          name="excluded-categories"
          placeholder="Ejemplo: Mantenimiento, Administración"
          value={draft.excludedCostLabels}
          onChange={(excludedCostLabels) => onChange({ ...draft, excludedCostLabels })}
        />
      </div>
      <p className="trip-evaluator__form-note">
        La política define cómo se interpreta el porcentaje y qué cobertura declara. La tasa
        tributaria se conserva como referencia: esta capa no convierte montos ni transforma el
        margen directo en utilidad neta.
      </p>
      <div className="trip-evaluator__actions">
        <Button disabled={busy} icon="settings" type="submit">
          {busy ? "Publicando…" : "Publicar política"}
        </Button>
      </div>
    </form>
  );
}

function EvaluationWorkspace({
  busy,
  calculation,
  draft,
  editingReference,
  onChange,
  onCancelEditing,
  onSubmit,
  options,
  policy,
  serverAvailable,
}: {
  readonly busy: boolean;
  readonly calculation: CalculationState;
  readonly draft: TripEvaluatorDraft;
  readonly editingReference: string | null;
  readonly onChange: (next: TripEvaluatorDraft) => void;
  readonly onCancelEditing: () => void;
  readonly onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  readonly options: TripEvaluatorBootstrap;
  readonly policy: PersistedEvaluationPolicy;
  readonly serverAvailable: boolean;
}): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<EvaluationStepId>("service");
  const stepIndex = EVALUATION_STEPS.findIndex((step) => step.id === currentStep);
  const isReviewStep = currentStep === "review";

  function moveStep(offset: -1 | 1): void {
    const nextIndex = Math.min(Math.max(stepIndex + offset, 0), EVALUATION_STEPS.length - 1);
    setCurrentStep(EVALUATION_STEPS[nextIndex]?.id ?? "service");
  }

  return (
    <div className="trip-evaluator__workspace">
      <form className="trip-evaluator__form" onSubmit={onSubmit}>
        <SectionIntro
          aside={`Paso ${stepIndex + 1} de ${EVALUATION_STEPS.length}`}
          description="Ingresa solo información que conozcas. Si falta un dato, la revisión te dirá qué cálculo no puede confirmar."
          eyebrow="Supuestos de negociación"
          title={
            editingReference === null
              ? "Evalúa una carga paso a paso"
              : "Edita el borrador paso a paso"
          }
        />
        <EvaluationStepper currentStep={currentStep} onChange={setCurrentStep} />
        {currentStep === "service" ? (
          <fieldset className="trip-evaluator__fieldset">
            <legend>1. Servicio y oferta</legend>
            <p className="trip-evaluator__step-question">
              Empieza por la oferta de ida. Cliente, unidad y ruta son opcionales, pero ayudan a
              reconocer este borrador después.
            </p>
            <div className="trip-evaluator__fields trip-evaluator__fields--three">
              <TextField
                example="CARGA-LIMA-0826"
                help="Una referencia que tu equipo pueda reconocer después."
                label="Referencia interna"
                name="reference"
                placeholder="Ejemplo: CARGA-LIMA-0826"
                value={draft.reference}
                onChange={(reference) => onChange({ ...draft, reference })}
              />
              <OptionField
                help="Opcional. Selecciona el cliente si ya está registrado."
                label="Cliente"
                name="client"
                value={draft.clientId}
                onChange={(clientId) => onChange({ ...draft, clientId })}
                options={options.clients}
                placeholder="Aún no asociado"
              />
              <OptionField
                help="Opcional. No programa ni reserva la unidad."
                label="Unidad prevista"
                name="vehicle"
                value={draft.vehicleId}
                onChange={(vehicleId) => onChange({ ...draft, vehicleId })}
                options={options.vehicles}
                placeholder="Aún no asociada"
              />
              <TextField
                example="Lima"
                help="Ciudad o punto desde donde inicia el servicio."
                label="Origen"
                name="origin"
                placeholder="Ejemplo: Lima"
                value={draft.origin}
                onChange={(origin) => onChange({ ...draft, origin })}
              />
              <TextField
                example="Cusco"
                help="Ciudad o punto final de la carga de ida."
                label="Destino"
                name="destination"
                placeholder="Ejemplo: Cusco"
                value={draft.destination}
                onChange={(destination) => onChange({ ...draft, destination })}
              />
              <NumberField
                example="12 500"
                help="Monto completo que el cliente pagaría por la ida. No ingreses el margen ni el anticipo."
                label={`Oferta total (${policy.currency})`}
                name="offer"
                placeholder="Ejemplo: 12500"
                required
                value={draft.offerAmount}
                onChange={(offerAmount) => onChange({ ...draft, offerAmount })}
              />
            </div>
            <CostEditor
              title="Costos directos de ida"
              description="Ejemplos: combustible, peajes o viáticos, solo si la política activa los considera costos directos."
              lines={draft.outboundCosts}
              onChange={(outboundCosts) => onChange({ ...draft, outboundCosts })}
              prefix="outbound"
            />
          </fieldset>
        ) : null}
        {currentStep === "return" ? (
          <fieldset className="trip-evaluator__fieldset">
            <legend>2. Retorno y ciclo</legend>
            <p className="trip-evaluator__step-question">
              Describe el retorno con prudencia: una carga probable no se presenta como ingreso
              garantizado.
            </p>
            <div className="trip-evaluator__fields trip-evaluator__fields--three">
              <SelectField
                help="Elige confirmado solo si el retorno ya está asegurado."
                label="Situación de retorno"
                name="return-status"
                value={draft.returnStatus}
                onChange={(returnStatus) =>
                  onChange({ ...draft, returnStatus: toReturnStatus(returnStatus) })
                }
                options={[
                  { value: "NONE", label: "Sin retorno identificado" },
                  { value: "PROBABLE", label: "Retorno probable" },
                  { value: "CONFIRMED", label: "Retorno confirmado" },
                ]}
              />
              <NumberField
                disabled={draft.returnStatus === "NONE"}
                example="9 000"
                help="Monto estimado por una carga de retorno. Se activa si el retorno es probable o confirmado."
                label={`Ingreso de retorno (${policy.currency})`}
                name="return-income"
                placeholder="Ejemplo: 9000"
                required={draft.returnStatus !== "NONE"}
                value={draft.returnIncome}
                onChange={(returnIncome) => onChange({ ...draft, returnIncome })}
              />
              <NumberField
                disabled={draft.returnStatus !== "PROBABLE"}
                example="60"
                help="Tu estimación de que el retorno probable se concrete, entre 0 y menos de 100."
                label="Probabilidad de retorno (%)"
                name="return-probability"
                placeholder="Ejemplo: 60"
                required={draft.returnStatus === "PROBABLE"}
                value={draft.returnProbabilityPercent}
                onChange={(returnProbabilityPercent) =>
                  onChange({ ...draft, returnProbabilityPercent })
                }
              />
              <NumberField
                example="2 200"
                help="Opcional. Habilita métricas por kilómetro; incluye ida, espera y retorno de esta evaluación."
                label="Kilómetros estimados del ciclo"
                name="distance"
                placeholder="Ejemplo: 2200"
                value={draft.estimatedDistanceKm}
                onChange={(estimatedDistanceKm) => onChange({ ...draft, estimatedDistanceKm })}
              />
              <NumberField
                example="8"
                help="Opcional. Habilita métricas por día; considera ida, espera y retorno."
                label="Días estimados del ciclo"
                name="days"
                placeholder="Ejemplo: 8"
                value={draft.estimatedDays}
                onChange={(estimatedDays) => onChange({ ...draft, estimatedDays })}
              />
            </div>
            <CostEditor
              title="Costos de retorno vacío"
              description="Se usan en el escenario conservador y en la parte no cubierta del retorno probable."
              lines={draft.emptyReturnCosts}
              onChange={(emptyReturnCosts) => onChange({ ...draft, emptyReturnCosts })}
              prefix="empty"
            />
            {draft.returnStatus === "NONE" ? null : (
              <CostEditor
                title="Costos del retorno cargado"
                description="Se usan cuando el retorno se materializa con carga."
                lines={draft.returnCosts}
                onChange={(returnCosts) => onChange({ ...draft, returnCosts })}
                prefix="return"
              />
            )}
          </fieldset>
        ) : null}
        {currentStep === "review" ? (
          <EvaluationReview currency={policy.currency} draft={draft} options={options} />
        ) : null}
        <GuidanceNote tone="info" title="Cobertura de la política activa">
          {policy.costCoverage.directCostCategories.length === 0
            ? "Esta política no habilita categorías de costo directo; no agregues costos hasta que Gerencia publique una cobertura válida."
            : `Puedes registrar estas categorías como costo directo: ${policy.costCoverage.directCostCategories.join(", ")}.`}{" "}
          {policy.costCoverage.excludedCostLabels.length === 0
            ? "La política no declara costos excluidos."
            : `No forman parte de este margen directo: ${policy.costCoverage.excludedCostLabels.join(", ")}.`}
        </GuidanceNote>
        <div className="trip-evaluator__actions trip-evaluator__actions--steps">
          {stepIndex > 0 ? (
            <Button disabled={busy} onClick={() => moveStep(-1)} type="button" variant="secondary">
              Volver
            </Button>
          ) : null}
          {isReviewStep ? null : (
            <Button disabled={busy} icon="chevron" onClick={() => moveStep(1)} type="button">
              Continuar: {EVALUATION_STEPS[stepIndex + 1]?.label}
            </Button>
          )}
          {editingReference === null ? null : (
            <Button disabled={busy} onClick={onCancelEditing} type="button" variant="quiet">
              Cancelar edición
            </Button>
          )}
          {isReviewStep ? (
            <>
              <Button
                disabled={busy || !serverAvailable || calculation.result === null}
                icon="file"
                type="submit"
              >
                {busy
                  ? "Guardando…"
                  : editingReference === null
                    ? "Guardar borrador de evaluación"
                    : "Actualizar borrador"}
              </Button>
              {serverAvailable ? null : (
                <small>
                  Necesitas conexión para guardar. El cálculo mostrado todavía no se confirmó en el
                  servidor.
                </small>
              )}
            </>
          ) : null}
        </div>
      </form>
      <EvaluationResult
        calculation={calculation}
        currency={policy.currency}
        showResult={isReviewStep}
      />
    </div>
  );
}

function EvaluationStepper({
  currentStep,
  onChange,
}: {
  readonly currentStep: EvaluationStepId;
  readonly onChange: (step: EvaluationStepId) => void;
}): React.JSX.Element {
  return (
    <ol aria-label="Pasos de la evaluación" className="trip-evaluator__stepper">
      {EVALUATION_STEPS.map((step, index) => {
        const isCurrent = step.id === currentStep;
        return (
          <li
            className={
              isCurrent
                ? "trip-evaluator__step trip-evaluator__step--current"
                : "trip-evaluator__step"
            }
            key={step.id}
          >
            <button
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Ir al paso ${index + 1}: ${step.label}. ${step.question}`}
              onClick={() => onChange(step.id)}
              type="button"
            >
              <span aria-hidden="true" className="trip-evaluator__step-number">
                {index + 1}
              </span>
              <span>
                <strong>{step.label}</strong>
                <small>{step.question}</small>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

function EvaluationReview({
  currency,
  draft,
  options,
}: {
  readonly currency: string;
  readonly draft: TripEvaluatorDraft;
  readonly options: TripEvaluatorBootstrap;
}): React.JSX.Element {
  const route = [draft.origin.trim(), draft.destination.trim()].filter(Boolean).join(" → ");
  const outboundCostCount = draft.outboundCosts.filter(
    (line) => line.category.trim() !== "" || line.amount.trim() !== "",
  ).length;
  const returnCostCount = draft.returnCosts.filter(
    (line) => line.category.trim() !== "" || line.amount.trim() !== "",
  ).length;

  return (
    <section className="trip-evaluator__review">
      <SectionIntro
        description="Comprueba los datos antes de guardar. Si algo no refleja la negociación, vuelve al paso correspondiente."
        headingLevel={3}
        title="Resumen de los supuestos"
      />
      <dl>
        <Metric label="Referencia" value={draft.reference.trim() || "Aún sin referencia"} />
        <Metric
          label="Cliente"
          value={optionLabel(options.clients, draft.clientId) ?? "Aún no asociado"}
        />
        <Metric
          label="Unidad prevista"
          value={optionLabel(options.vehicles, draft.vehicleId) ?? "Aún no asociada"}
        />
        <Metric label="Ruta" value={route || "Aún sin ruta"} />
        <Metric
          label="Oferta de ida"
          value={formatDraftMoney(draft.offerAmount, currency)}
          emphasized
        />
        <Metric label="Costos de ida registrados" value={costLineCopy(outboundCostCount)} />
        <Metric label="Retorno" value={returnStatusCopy(draft.returnStatus)} />
        <Metric label="Costos de retorno con carga" value={costLineCopy(returnCostCount)} />
      </dl>
    </section>
  );
}

function CostEditor({
  title,
  description,
  lines,
  onChange,
  prefix,
}: {
  readonly title: string;
  readonly description: string;
  readonly lines: readonly EditableCostLine[];
  readonly onChange: (lines: readonly EditableCostLine[]) => void;
  readonly prefix: string;
}): React.JSX.Element {
  function updateLine(id: string, patch: Partial<EditableCostLine>): void {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  }
  function removeLine(id: string): void {
    onChange(
      lines.length === 1
        ? [createCostLine(`${prefix}-${crypto.randomUUID()}`)]
        : lines.filter((line) => line.id !== id),
    );
  }
  return (
    <section className="trip-evaluator__cost-editor">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="trip-evaluator__cost-lines">
        {lines.map((line, index) => (
          <div className="trip-evaluator__cost-line" key={line.id}>
            <TextField
              help="Escribe exactamente una categoría permitida por la política activa."
              label={`Categoría ${index + 1}`}
              name={`${prefix}-category-${line.id}`}
              value={line.category}
              onChange={(category) => updateLine(line.id, { category })}
            />
            <NumberField
              example="1500"
              help="Monto total estimado para esta categoría."
              label="Monto"
              name={`${prefix}-amount-${line.id}`}
              placeholder="Ejemplo: 1500"
              value={line.amount}
              onChange={(amount) => updateLine(line.id, { amount })}
            />
            <button
              aria-label={`Quitar costo ${index + 1}`}
              className="trip-evaluator__line-remove"
              onClick={() => removeLine(line.id)}
              type="button"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        ))}
      </div>
      <button
        className="trip-evaluator__add-line"
        onClick={() => onChange([...lines, createCostLine(`${prefix}-${crypto.randomUUID()}`)])}
        type="button"
      >
        <Icon name="plus" size={16} /> Agregar costo
      </button>
    </section>
  );
}

function EvaluationResult({
  calculation,
  currency,
  showResult,
}: {
  readonly calculation: CalculationState;
  readonly currency: string;
  readonly showResult: boolean;
}): React.JSX.Element {
  if (!showResult)
    return (
      <aside className="trip-evaluator__result trip-evaluator__result--pending">
        <Icon name="chart" />
        <div>
          <h2>Resultado al finalizar la revisión</h2>
          <p>
            Completa los pasos con los datos disponibles. En la revisión verás qué margen se puede
            estimar y qué información todavía falta.
          </p>
        </div>
      </aside>
    );
  if (calculation.error !== null)
    return (
      <aside className="trip-evaluator__result trip-evaluator__result--pending">
        <Icon name="alert" />
        <div>
          <h2>Completa los supuestos para calcular</h2>
          <p>
            {calculation.error} Vuelve al paso que corresponda, corrige el dato y revisa de nuevo.
          </p>
        </div>
      </aside>
    );
  if (calculation.result === null)
    return (
      <aside className="trip-evaluator__result trip-evaluator__result--pending">
        <Icon name="chart" />
        <div>
          <h2>Resultado pendiente</h2>
          <p>Ingresa una oferta y los costos disponibles. No se usarán valores inventados.</p>
        </div>
      </aside>
    );
  const result = calculation.result;
  return (
    <aside className="trip-evaluator__result">
      <div className="trip-evaluator__result-heading">
        <div>
          <p>Comparación de escenarios</p>
          <h2>Margen directo estimado</h2>
        </div>
        <StatusChip label="Cobertura directa" tone="info" />
      </div>
      <div className="trip-evaluator__scenario-grid">
        {(["CONSERVATIVE", "PROBABLE", "FAVORABLE"] as const).map((type) => (
          <ScenarioCard
            currency={currency}
            key={type}
            requiresException={type === "CONSERVATIVE" && result.assessment.requiresException}
            scenario={result.scenarios[type]}
          />
        ))}
      </div>
      {result.assessment.requiresException ? (
        <p className="trip-evaluator__assessment" role="status">
          <Icon name="alert" size={17} /> La oferta está por debajo del mínimo configurado (
          {formatMoney(result.assessment.minimumPrice, currency)}). Al fijarla, requerirá una
          excepción de Gerencia.
        </p>
      ) : null}
      <p className="trip-evaluator__coverage">
        <Icon name="alert" size={17} /> {result.excludedCostCopy}
      </p>
    </aside>
  );
}

function ScenarioCard({
  currency,
  requiresException,
  scenario,
}: {
  readonly currency: string;
  readonly requiresException: boolean;
  readonly scenario: TripEvaluationResult["scenarios"]["CONSERVATIVE"];
}): React.JSX.Element {
  const labels = {
    CONSERVATIVE: "Conservador",
    PROBABLE: "Probable",
    FAVORABLE: "Favorable",
  } as const;
  const tone = requiresException
    ? "warning"
    : scenario.directMargin < 0
      ? "risk"
      : scenario.marginRate === null
        ? "neutral"
        : "success";
  return (
    <article className="trip-evaluator__scenario">
      <div className="trip-evaluator__scenario-heading">
        <h3>{labels[scenario.type]}</h3>
        <StatusChip
          label={
            requiresException
              ? "Requiere excepción"
              : scenario.directMargin < 0
                ? "Por debajo de costo"
                : "Estimado"
          }
          tone={tone}
        />
      </div>
      <dl>
        <Metric label="Ingreso" value={formatMoney(scenario.directRevenue, currency)} />
        <Metric label="Costo directo" value={formatMoney(scenario.directCost, currency)} />
        <Metric
          label="Margen directo"
          value={formatMoney(scenario.directMargin, currency)}
          emphasized
        />
        <Metric
          label="Margen"
          value={
            scenario.marginRate === null ? "No calculable" : formatPercent(scenario.marginRate)
          }
        />
        <Metric label="Equilibrio" value={formatMoney(scenario.prices.equilibrium, currency)} />
        <Metric label="Mínimo recomendado" value={formatMoney(scenario.prices.minimum, currency)} />
        <Metric label="Objetivo" value={formatMoney(scenario.prices.target, currency)} />
        <Metric
          label="Margen/día"
          value={
            scenario.metrics.directMarginPerDay === null
              ? "Sin días estimados"
              : formatMoney(scenario.metrics.directMarginPerDay, currency)
          }
        />
      </dl>
      <details className="trip-evaluator__scenario-metrics">
        <summary>Métricas de ciclo</summary>
        <dl>
          <Metric
            label="Costo/km"
            value={
              scenario.metrics.directCostPerKm === null
                ? "Sin km estimados"
                : formatMoney(scenario.metrics.directCostPerKm, currency)
            }
          />
          <Metric
            label="Ingreso/km"
            value={
              scenario.metrics.directRevenuePerKm === null
                ? "Sin km estimados"
                : formatMoney(scenario.metrics.directRevenuePerKm, currency)
            }
          />
          <Metric
            label="Margen/km"
            value={
              scenario.metrics.directMarginPerKm === null
                ? "Sin km estimados"
                : formatMoney(scenario.metrics.directMarginPerKm, currency)
            }
          />
          <Metric
            label="Costo/día"
            value={
              scenario.metrics.directCostPerDay === null
                ? "Sin días estimados"
                : formatMoney(scenario.metrics.directCostPerDay, currency)
            }
          />
          <Metric
            label="Ingreso/día"
            value={
              scenario.metrics.directRevenuePerDay === null
                ? "Sin días estimados"
                : formatMoney(scenario.metrics.directRevenuePerDay, currency)
            }
          />
          <Metric
            label="Margen/día"
            value={
              scenario.metrics.directMarginPerDay === null
                ? "Sin días estimados"
                : formatMoney(scenario.metrics.directMarginPerDay, currency)
            }
          />
        </dl>
      </details>
    </article>
  );
}

function Metric({
  label,
  value,
  emphasized = false,
}: {
  readonly label: string;
  readonly value: string;
  readonly emphasized?: boolean;
}): React.JSX.Element {
  return (
    <div
      className={
        emphasized
          ? "trip-evaluator__metric trip-evaluator__metric--emphasized"
          : "trip-evaluator__metric"
      }
    >
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function EvaluationHistory({
  canApproveExceptions,
  canFixEvaluations,
  evaluations,
  exceptions,
  onApproveException,
  onEdit,
  onFix,
  pendingActionId,
}: {
  readonly canApproveExceptions: boolean;
  readonly canFixEvaluations: boolean;
  readonly evaluations: readonly TripEvaluatorBootstrap["evaluations"][number][];
  readonly exceptions: readonly TripEvaluatorBootstrap["exceptions"][number][];
  readonly onApproveException: (exceptionId: string, reason: string) => void;
  readonly onEdit: (evaluation: TripEvaluatorBootstrap["evaluations"][number]) => void;
  readonly onFix: (evaluationId: string) => void;
  readonly pendingActionId: string | null;
}): React.JSX.Element {
  const [reasons, setReasons] = useState<Readonly<Record<string, string>>>({});

  return (
    <section className="trip-evaluator__history">
      <SectionIntro
        description="Cada evaluación conserva la política y los supuestos usados. Un borrador todavía puede corregirse; una evaluación fijada queda como fundamento de la decisión."
        eyebrow="Auditoría comercial"
        title="Evaluaciones recientes"
      />
      {evaluations.length === 0 ? (
        <p>
          Aún no hay evaluaciones guardadas. Los cálculos del formulario no se conservan hasta
          confirmar el guardado con el servidor.
        </p>
      ) : (
        <div className="trip-evaluator__history-table">
          <table>
            <thead>
              <tr>
                <th>Referencia</th>
                <th>Política</th>
                <th>Estado</th>
                <th>Actualizada</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation) => {
                const exception = exceptions.find(
                  (candidate) =>
                    candidate.evaluationId === evaluation.id && candidate.status === "PENDING",
                );
                const busy = pendingActionId === evaluation.id || pendingActionId === exception?.id;
                return (
                  <tr key={evaluation.id}>
                    <td>{evaluation.reference ?? shortId(evaluation.id)}</td>
                    <td>v{evaluation.policyVersion}</td>
                    <td>{labelEvaluationStatus(evaluation.status)}</td>
                    <td>{formatDate(evaluation.updatedAt)}</td>
                    <td className="trip-evaluator__history-actions">
                      {evaluation.status === "DRAFT" && canFixEvaluations ? (
                        <div className="trip-evaluator__history-draft-actions">
                          <Button
                            disabled={busy}
                            onClick={() => onEdit(evaluation)}
                            variant="secondary"
                          >
                            Editar
                          </Button>
                          <Button
                            disabled={busy}
                            onClick={() => onFix(evaluation.id)}
                            variant="secondary"
                          >
                            {busy ? "Fijando…" : "Fijar evaluación"}
                          </Button>
                        </div>
                      ) : null}
                      {evaluation.status === "EXCEPTION_REQUIRED" ? (
                        exception === undefined ? (
                          <small>La excepción se está preparando en el servidor.</small>
                        ) : canApproveExceptions ? (
                          <form
                            className="trip-evaluator__exception-form"
                            onSubmit={(event) => {
                              event.preventDefault();
                              onApproveException(exception.id, reasons[exception.id] ?? "");
                            }}
                          >
                            <label className="trip-evaluator__exception-reason">
                              <span>Motivo de aprobación</span>
                              <input
                                onChange={(event) =>
                                  setReasons((current) => ({
                                    ...current,
                                    [exception.id]: event.target.value,
                                  }))
                                }
                                placeholder="Explica por qué se autoriza esta excepción"
                                required
                                value={reasons[exception.id] ?? ""}
                              />
                              <small>
                                Explica la razón verificable de la aprobación. Ejemplo: cliente
                                confirmó una condición comercial excepcional por escrito.
                              </small>
                            </label>
                            <Button disabled={busy} type="submit">
                              {busy ? "Aprobando…" : "Aprobar excepción"}
                            </Button>
                          </form>
                        ) : (
                          <small>Requiere aprobación de Gerencia.</small>
                        )
                      ) : null}
                      {evaluation.status === "FIXED" ? <small>Fundamento fijado</small> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function EvaluatorNotice({
  title,
  copy,
  action,
}: {
  readonly title: string;
  readonly copy: string;
  readonly action?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="trip-evaluator__notice">
      <Icon name="chart" size={25} />
      <h2>{title}</h2>
      <p>{copy}</p>
      {action}
    </section>
  );
}

function TextField({
  label,
  name,
  value,
  onChange,
  required = false,
  help,
  example,
  placeholder,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly help?: string;
  readonly example?: string;
  readonly placeholder?: string;
}): React.JSX.Element {
  const guidanceId = `${name}-guidance`;
  const hasGuidance = help !== undefined || example !== undefined;

  return (
    <label className="trip-evaluator__field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        aria-describedby={hasGuidance ? guidanceId : undefined}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        type="text"
        value={value}
      />
      <FieldGuidance example={example} help={help} id={guidanceId} />
    </label>
  );
}

function NumberField({
  label,
  name,
  value,
  onChange,
  required = false,
  disabled = false,
  help,
  example,
  placeholder,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly help?: string;
  readonly example?: string;
  readonly placeholder?: string;
}): React.JSX.Element {
  const guidanceId = `${name}-guidance`;
  const hasGuidance = help !== undefined || example !== undefined;

  return (
    <label className="trip-evaluator__field">
      <span>
        {label}
        {required ? " *" : ""}
      </span>
      <input
        aria-describedby={hasGuidance ? guidanceId : undefined}
        disabled={disabled}
        inputMode="decimal"
        min="0"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        step="0.01"
        type="number"
        value={value}
      />
      <FieldGuidance example={example} help={help} id={guidanceId} />
    </label>
  );
}

function SelectField({
  label,
  name,
  value,
  onChange,
  options,
  required = false,
  help,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly required?: boolean;
  readonly help?: string;
}): React.JSX.Element {
  const guidanceId = `${name}-guidance`;

  return (
    <label className="trip-evaluator__field">
      <span>{label}</span>
      <select
        aria-describedby={help === undefined ? undefined : guidanceId}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldGuidance help={help} id={guidanceId} />
    </label>
  );
}

function OptionField({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  help,
}: {
  readonly label: string;
  readonly name: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly id: string; readonly label: string }[];
  readonly placeholder: string;
  readonly help?: string;
}): React.JSX.Element {
  const guidanceId = `${name}-guidance`;

  return (
    <label className="trip-evaluator__field">
      <span>{label}</span>
      <select
        aria-describedby={help === undefined ? undefined : guidanceId}
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldGuidance help={help} id={guidanceId} />
    </label>
  );
}

function toReturnStatus(value: string): TripEvaluatorDraft["returnStatus"] {
  return value === "CONFIRMED" || value === "PROBABLE" ? value : "NONE";
}

function optionLabel(
  options: readonly { readonly id: string; readonly label: string }[],
  value: string,
): string | null {
  return options.find((option) => option.id === value)?.label ?? null;
}

function formatDraftMoney(value: string, currency: string): string {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) && parsed >= 0
    ? formatMoney(parsed, currency)
    : "Aún no ingresada";
}

function costLineCopy(count: number): string {
  if (count === 0) return "Ninguno registrado";
  return `${count} ${count === 1 ? "costo registrado" : "costos registrados"}`;
}

function returnStatusCopy(status: TripEvaluatorDraft["returnStatus"]): string {
  const labels: Readonly<Record<TripEvaluatorDraft["returnStatus"], string>> = {
    NONE: "Sin retorno identificado",
    PROBABLE: "Retorno probable",
    CONFIRMED: "Retorno confirmado",
  };
  return labels[status];
}

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function optionalId(value: string): string | null {
  return optionalText(value);
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Ocurrió un error inesperado.";
}
function formatPercent(rate: number): string {
  return new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2, style: "percent" }).format(
    rate,
  );
}
function formatMoney(value: number, currency: string): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(value);
}
function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date)
    : value;
}
function shortId(value: string): string {
  return value.length > 8 ? value.slice(0, 8).toUpperCase() : value.toUpperCase();
}
function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
function labelEvaluationStatus(value: string): string {
  const labels: Readonly<Record<string, string>> = {
    DRAFT: "Borrador",
    EXCEPTION_REQUIRED: "Excepción requerida",
    FIXED: "Fijada",
  };
  return labels[value] ?? value;
}
