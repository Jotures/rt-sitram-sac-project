import type { AdminDataGateway } from "../admin-ui/admin-data";
import { buildLegacySettlementReport, buildTripReport } from "./entity-report";
import { EntityReportPanel } from "./CycleReportPanel";
export function TripReportPanel({
  gateway,
  tripId,
}: {
  readonly gateway: AdminDataGateway;
  readonly tripId: string;
}): React.JSX.Element {
  return (
    <EntityReportPanel
      target={{ type: "trip", id: tripId }}
      key={tripId}
      loadReport={async () => buildTripReport(await gateway.loadTripDetail(tripId))}
    />
  );
}
export function LegacySettlementReportPanel({
  gateway,
  settlementId,
}: {
  readonly gateway: AdminDataGateway;
  readonly settlementId: string;
}): React.JSX.Element {
  return (
    <EntityReportPanel
      target={{ type: "settlement", id: settlementId }}
      key={settlementId}
      loadReport={async () =>
        buildLegacySettlementReport(await gateway.loadSettlementDetail(settlementId))
      }
    />
  );
}
