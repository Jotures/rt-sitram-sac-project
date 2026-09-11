import type { AppRole } from "../../features/identity/identity-model";
import type { OperationMode } from "../../features/operation-mode/operation-mode";
import { canRoleAccessRoute, routePaths, type ProductRouteId } from "../routing/route-model";

export interface NavigationItem {
  readonly id: ProductRouteId;
  readonly label: string;
  readonly description: string;
  readonly path: string;
}

export interface NavigationGroup {
  readonly label: string;
  readonly items: readonly NavigationItem[];
}

interface NavigationItemSeed {
  readonly id: ProductRouteId;
  readonly label: string;
  readonly description: string;
}

interface NavigationGroupSeed {
  readonly label: string;
  readonly items: readonly NavigationItemSeed[];
}

const administrativeNavigation: readonly NavigationGroupSeed[] = [
  {
    label: "",
    items: [
      {
        id: "home",
        label: "Inicio",
        description: "Revisa lo que requiere atención en la operación.",
      },
      {
        id: "search",
        label: "Buscar",
        description: "Encuentra información operativa por nombre, ruta, placa o código.",
      },
    ],
  },
  {
    label: "Operaciones",
    items: [
      {
        id: "trips",
        label: "Servicios y fletes",
        description: "Consulta y gestiona los viajes de la empresa.",
      },
      {
        id: "scheduling",
        label: "Programación",
        description: "Asigna fecha, unidad y conductor a un viaje.",
      },
      {
        id: "operationalCycles",
        label: "Salidas",
        description: "Reúne servicios y la cuenta del conductor en cada salida Cusco–Cusco.",
      },
      {
        id: "tripEvaluator",
        label: "Evaluar viaje",
        description: "Calcula costos y margen antes de aceptar una carga.",
      },
    ],
  },
  {
    label: "Gestión",
    items: [
      {
        id: "fleet",
        label: "Flota",
        description: "Consulta el estado y la disponibilidad de las unidades.",
      },
      {
        id: "drivers",
        label: "Conductores",
        description: "Consulta conductores y su disponibilidad para viajar.",
      },
      {
        id: "clients",
        label: "Clientes",
        description: "Consulta y administra la información de los clientes.",
      },
      {
        id: "suppliers",
        label: "Proveedores",
        description: "Gestiona grifos, talleres, repuestos y otros proveedores.",
      },
    ],
  },
  {
    label: "Dinero",
    items: [
      {
        id: "expenses",
        label: "Gastos",
        description: "Revisa los gastos registrados durante los viajes.",
      },
      {
        id: "fuelEntries",
        label: "Combustible",
        description: "Registra y consulta abastecimientos vinculados a un viaje.",
      },
      {
        id: "advances",
        label: "Dinero entregado",
        description: "Consulta el dinero entregado antes o durante un viaje.",
      },
      {
        id: "settlements",
        label: "Rendiciones",
        description: "Revisa gastos, hojas y saldos de cada salida.",
      },
      {
        id: "collections",
        label: "Cobranza",
        description: "Consulta los pagos pendientes de los clientes.",
      },
    ],
  },
  {
    label: "Control",
    items: [
      {
        id: "maintenance",
        label: "Mantenimiento",
        description: "Controla el mantenimiento y las alertas de las unidades.",
      },
      {
        id: "documents",
        label: "Documentos",
        description: "Consulta los documentos de la empresa y los viajes.",
      },
      {
        id: "alerts",
        label: "Alertas",
        description: "Revisa los asuntos que requieren atención.",
      },
      {
        id: "reports",
        label: "Reportes",
        description: "Consulta los resúmenes de la operación.",
      },
    ],
  },
  {
    label: "",
    items: [
      {
        id: "companySettings",
        label: "Empresa",
        description: "Configura los datos generales de la empresa.",
      },
      {
        id: "profileSettings",
        label: "Perfiles",
        description: "Administra los accesos y roles de las personas.",
      },
      {
        id: "profile",
        label: "Mi perfil",
        description: "Consulta y actualiza los datos de tu cuenta.",
      },
    ],
  },
];

const driverNavigation: readonly NavigationItemSeed[] = [
  {
    id: "myTrip",
    label: "Mi viaje",
    description: "Consulta la etapa actual y las tareas de tu viaje.",
  },
  {
    id: "register",
    label: "Registrar",
    description: "Registra gastos, avances y novedades del viaje.",
  },
  {
    id: "myTripHistory",
    label: "Historial",
    description: "Consulta los viajes que ya realizaste.",
  },
  {
    id: "synchronization",
    label: "Sincronizar",
    description: "Revisa los registros pendientes de envío.",
  },
  {
    id: "profile",
    label: "Perfil",
    description: "Consulta y actualiza los datos de tu cuenta.",
  },
];

const administrativeMobileNavigation: readonly NavigationItemSeed[] = [
  {
    id: "home",
    label: "Inicio",
    description: "Revisa lo que requiere atención en la operación.",
  },
  {
    id: "trips",
    label: "Servicios y fletes",
    description: "Consulta y gestiona los viajes de la empresa.",
  },
  {
    id: "fleet",
    label: "Flota",
    description: "Consulta el estado y la disponibilidad de las unidades.",
  },
  {
    id: "settlements",
    label: "Finanzas",
    description: "Revisa adelantos, gastos y rendiciones de los viajes.",
  },
];

function toNavigationItem(seed: NavigationItemSeed): NavigationItem {
  return { ...seed, path: routePaths[seed.id] };
}

export function getDesktopNavigation(
  role: AppRole,
  mode: OperationMode = "full",
): readonly NavigationGroup[] {
  if (role === "driver") {
    return [{ label: "", items: driverNavigation.map(toNavigationItem) }];
  }

  const navigation = administrativeNavigation.flatMap((group) => {
    const items = group.items
      .filter((item) => canRoleAccessRoute(role, item.id))
      .map(toNavigationItem);

    return items.length === 0 ? [] : [{ label: group.label, items }];
  });
  if (mode === "full") return navigation;
  const items = navigation.flatMap((group) => group.items);
  const daily: readonly ProductRouteId[] = [
    "home",
    "operationalCycles",
    "trips",
    "advances",
    "expenses",
    "fuelEntries",
    "settlements",
    "collections",
    "search",
    "profile",
  ];
  return [
    {
      label: "Día a día",
      items: daily.flatMap((id) => {
        const item = items.find((candidate) => candidate.id === id);
        return item === undefined
          ? []
          : [
              {
                ...item,
                label:
                  id === "trips"
                    ? "Servicios y fletes"
                    : id === "advances"
                      ? "Dinero entregado"
                      : item.label,
              },
            ];
      }),
    },
    {
      label: "Más herramientas",
      items: items.filter((item) => !daily.includes(item.id) && item.id !== "scheduling"),
    },
  ].filter((group) => group.items.length > 0);
}

export function getMobileNavigation(
  role: AppRole,
  mode: OperationMode = "full",
): readonly NavigationItem[] {
  const seeds = role === "driver" ? driverNavigation : administrativeMobileNavigation;

  return seeds
    .map((item) =>
      role !== "driver" && mode === "quick" && item.id === "trips"
        ? {
            id: "operationalCycles" as const,
            label: "Salidas",
            description: "Registra el recorrido y sus movimientos.",
          }
        : item,
    )
    .filter((item) => canRoleAccessRoute(role, item.id))
    .map(toNavigationItem);
}
