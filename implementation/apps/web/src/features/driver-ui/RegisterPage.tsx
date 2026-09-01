import { DriverActionCard, DriverPageHeader } from "./DriverUiParts";
import { useDriverTrips } from "./driver-data";

export function DriverRegisterPage(): React.JSX.Element {
  const { activeTrip } = useDriverTrips();

  return (
    <div className="driver-page">
      <DriverPageHeader
        description="Elige qué ocurrió en la ruta. Cada registro queda primero en tu bitácora local."
        eyebrow="Bitácora de viaje"
        title="Registrar"
      />
      {activeTrip === null ? (
        <div className="driver-state">
          No hay un viaje en ejecución. Las opciones se habilitarán al iniciar tu salida.
        </div>
      ) : null}
      <div
        className={`driver-action-list ${activeTrip === null ? "driver-action-list--disabled" : ""}`}
      >
        <DriverActionCard
          copy="Abastecimiento, kilometraje y monto"
          icon="fuel"
          label="Combustible"
          to={activeTrip === null ? "/mi-viaje" : "/registrar/combustible"}
        />
        <DriverActionCard
          copy="Peaje, comida, garaje u otro"
          icon="money"
          label="Gasto"
          to={activeTrip === null ? "/mi-viaje" : "/registrar/gasto"}
        />
        <DriverActionCard
          copy="Avería, retraso o problema de carga"
          icon="alert"
          label="Incidencia"
          to={activeTrip === null ? "/mi-viaje" : "/registrar/incidencia"}
        />
        <DriverActionCard
          copy="Lectura actual o llegada"
          icon="gauge"
          label="Kilometraje"
          to={activeTrip === null ? "/mi-viaje" : "/registrar/kilometraje"}
        />
      </div>
    </div>
  );
}
