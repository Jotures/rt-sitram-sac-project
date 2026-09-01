import { useStatus } from "@powersync/react";
import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandLockup, BrandMark, BrandRouteMotif } from "../../components/brand/BrandLockup";
import { Icon, type IconName } from "../../components/primitives/Icon";
import { useAuth } from "../../features/auth/AuthProvider";
import { DriverAttachmentWorker } from "../../features/driver-ui";
import { useIdentity } from "../../features/identity/IdentityProvider";
import type { AppRole } from "../../features/identity/identity-model";
import type { NetworkStatus } from "../../lib/network/connectivity";
import { useNetworkStatus } from "../../lib/network/use-network-status";
import { usePowerSyncRuntime } from "../../lib/powersync/PowerSyncProvider";
import { useUploadQueue } from "../../lib/powersync/use-upload-queue";
import { getDesktopNavigation, getMobileNavigation } from "../navigation/navigation-model";
import type { ProductRouteId } from "../routing/route-model";
import {
  getProductRouteIdForPath,
  getRouteExperience,
  getRouteParentPath,
} from "../routing/route-experience";
import "./product-shell.css";

const roleLabels: Readonly<Record<AppRole, string>> = {
  management: "Gerencia",
  administration: "Administración",
  driver: "Conductor",
  accounting: "Contabilidad",
};

const navigationIcons: Partial<Readonly<Record<ProductRouteId, IconName>>> = {
  home: "home",
  search: "search",
  trips: "route",
  scheduling: "calendar",
  operationalCycles: "route",
  tripEvaluator: "chart",
  fleet: "truck",
  drivers: "users",
  clients: "building",
  suppliers: "building",
  expenses: "money",
  advances: "money",
  settlements: "money",
  collections: "money",
  maintenance: "tool",
  documents: "file",
  alerts: "alert",
  reports: "chart",
  companySettings: "settings",
  profileSettings: "users",
  gpsOdometerSettings: "gauge",
  profile: "users",
  myTrip: "route",
  register: "plus",
  myTripHistory: "calendar",
  synchronization: "wifi",
};

function NavigationIcon({ routeId }: { readonly routeId: ProductRouteId }): React.JSX.Element {
  return <Icon name={navigationIcons[routeId] ?? "chevron"} size={19} />;
}

type ShellSyncTone = "ready" | "updating" | "pending" | "offline" | "error";

interface ShellSyncInput {
  readonly networkStatus: NetworkStatus;
  readonly configured: boolean;
  readonly sqliteReady: boolean;
  readonly connecting: boolean;
  readonly connected: boolean;
  readonly pending: number;
  readonly error: Error | null;
}

interface ShellSyncPresentation {
  readonly tone: ShellSyncTone;
  readonly label: string;
  readonly detail: string;
  readonly icon: "wifi" | "offline" | "alert";
}

interface OfflineBannerPresentation {
  readonly detail: string;
}

function pendingLabel(pending: number): string {
  return `${pending} ${pending === 1 ? "pendiente" : "pendientes"}`;
}

export function getShellSyncPresentation(input: ShellSyncInput): ShellSyncPresentation {
  if (input.networkStatus === "OFFLINE") {
    return {
      tone: "offline",
      label: input.pending > 0 ? pendingLabel(input.pending) : "Sin conexión",
      detail: !input.sqliteReady
        ? "La base local se está preparando"
        : input.pending > 0
          ? "Guardado en este dispositivo"
          : "Puedes seguir trabajando localmente",
      icon: "offline",
    };
  }

  if (input.error !== null) {
    return {
      tone: "error",
      label: "Revisar envío",
      detail:
        input.pending > 0
          ? `${pendingLabel(input.pending)} guardados en este dispositivo`
          : "No se pudo confirmar la comunicación con el servidor",
      icon: "alert",
    };
  }

  if (!input.configured) {
    return {
      tone: "pending",
      label: "Modo local",
      detail: "El envío al servidor no está configurado",
      icon: "offline",
    };
  }

  if (!input.sqliteReady) {
    return {
      tone: "pending",
      label: "Preparando datos",
      detail: "Algunos datos todavía no están disponibles",
      icon: "offline",
    };
  }

  if (input.pending > 0) {
    return {
      tone: input.connected ? "updating" : "pending",
      label: pendingLabel(input.pending),
      detail: input.connected
        ? "El envío se está procesando"
        : "Esperando conexión con el servidor",
      icon: "wifi",
    };
  }

  if (input.connected) {
    return {
      tone: "ready",
      label: "Conectado",
      detail: "Sin registros pendientes de envío",
      icon: "wifi",
    };
  }

  return {
    tone: "pending",
    label: input.connecting ? "Conectando" : "Solo local",
    detail: input.connecting
      ? "Puedes seguir trabajando en este dispositivo"
      : "Esperando conexión con el servidor",
    icon: "wifi",
  };
}

export function getOfflineBannerPresentation({
  pending,
  sqliteReady,
}: Pick<ShellSyncInput, "pending" | "sqliteReady">): OfflineBannerPresentation {
  if (!sqliteReady) {
    return {
      detail: "La base local todavía se está preparando; algunos datos aún no están disponibles.",
    };
  }

  if (pending > 0) {
    return {
      detail: `${pending} ${pending === 1 ? "registro quedó" : "registros quedaron"} guardado${pending === 1 ? "" : "s"} en este dispositivo y se enviará${pending === 1 ? "" : "n"} al reconectar.`,
    };
  }

  return {
    detail:
      "Puedes seguir trabajando; los registros nuevos quedarán guardados en este dispositivo hasta reconectar.",
  };
}

export function ProductShell(): React.JSX.Element {
  const { state: identityState } = useIdentity();
  const { signOut } = useAuth();
  const networkStatus = useNetworkStatus();
  const powerSyncStatus = useStatus();
  const powerSyncRuntime = usePowerSyncRuntime();
  const uploadQueue = useUploadQueue(powerSyncRuntime.sqliteReady);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [shellError, setShellError] = useState<string | null>(null);
  const mobileMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const mobileMenuCloseRef = useRef<HTMLButtonElement>(null);

  const handleSignOut = async (): Promise<void> => {
    setShellError(null);
    const result = await signOut();
    if (!result.ok) {
      setShellError(result.message);
    }
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    mobileMenuCloseRef.current?.focus();

    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }

      setMobileMenuOpen(false);
      mobileMenuTriggerRef.current?.focus();
    };

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = (): void => {
    setMobileMenuOpen(false);
    mobileMenuTriggerRef.current?.focus();
  };

  if (identityState.status !== "READY") {
    return (
      <main className="app-loading" aria-live="polite">
        <BrandMark className="app-loading__mark" />
        <p>Preparando el centro de control…</p>
      </main>
    );
  }

  const { company, profile } = identityState.identity;
  const desktopNavigation = getDesktopNavigation(profile.role);
  const mobileNavigation = getMobileNavigation(profile.role);
  const companyName = company.tradeName ?? company.legalName;
  const currentNavigationItem = desktopNavigation
    .flatMap((group) => group.items)
    .filter(
      (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`),
    )
    .sort((left, right) => right.path.length - left.path.length)[0];
  const currentRouteId = getProductRouteIdForPath(location.pathname);
  const currentRouteExperience =
    currentRouteId === null ? null : getRouteExperience(currentRouteId);
  const parentRouteId = currentRouteExperience?.parentId;
  const parentRoutePath = currentRouteId === null ? null : getRouteParentPath(currentRouteId);
  const parentRouteLabel =
    parentRouteId === undefined ? null : getRouteExperience(parentRouteId).label;
  const currentPageLabel =
    currentRouteExperience?.label ?? currentNavigationItem?.label ?? roleLabels[profile.role];
  const userInitials = profile.displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  const syncError =
    powerSyncRuntime.error ??
    powerSyncStatus.downloadError ??
    powerSyncStatus.uploadError ??
    uploadQueue.error;
  const syncPresentation = getShellSyncPresentation({
    networkStatus,
    configured: powerSyncRuntime.configured,
    sqliteReady: powerSyncRuntime.sqliteReady,
    connecting: powerSyncStatus.connecting,
    connected: powerSyncStatus.connected,
    pending: uploadQueue.pending,
    error: syncError,
  });
  const offlineBannerPresentation = getOfflineBannerPresentation({
    pending: uploadQueue.pending,
    sqliteReady: powerSyncRuntime.sqliteReady,
  });

  return (
    <>
      {profile.role === "driver" ? <DriverAttachmentWorker /> : null}
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Saltar al contenido
        </a>

        <aside
          className={`sidebar ${mobileMenuOpen ? "sidebar--open" : ""}`}
          id="primary-navigation"
        >
          <div className="sidebar__brand">
            <BrandLockup compact descriptor="Centro de control" inverse />
            <button
              aria-label="Cerrar menú de navegación"
              className="sidebar__close"
              onClick={closeMobileMenu}
              ref={mobileMenuCloseRef}
              type="button"
            >
              <Icon name="close" />
            </button>
          </div>

          <div className="sidebar__company">
            <span>Empresa activa</span>
            <strong>{companyName}</strong>
          </div>

          <BrandRouteMotif className="sidebar__route-motif" />

          <nav className="sidebar__navigation" aria-label="Navegación principal">
            {desktopNavigation.map((group, groupIndex) => (
              <div className="sidebar__group" key={`${group.label}-${groupIndex}`}>
                {group.label.length === 0 ? null : <p>{group.label}</p>}
                {group.items.map((item) => (
                  <NavLink
                    aria-describedby={`sidebar-navigation-${item.id}-description`}
                    aria-label={item.label}
                    className={({ isActive }) =>
                      `sidebar__link ${isActive ? "sidebar__link--active" : ""}`
                    }
                    end={item.path === "/inicio" || item.path === "/mi-viaje"}
                    key={item.id}
                    title={item.label}
                    to={item.path}
                  >
                    <NavigationIcon routeId={item.id} />
                    <span>{item.label}</span>
                    <span className="sr-only" id={`sidebar-navigation-${item.id}-description`}>
                      {item.description}
                    </span>
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="sidebar__account">
            <span className="sidebar__avatar" aria-hidden="true">
              {userInitials || "RT"}
            </span>
            <span className="sidebar__account-copy">
              <strong>{profile.displayName}</strong>
              <small>{roleLabels[profile.role]}</small>
            </span>
            <button
              aria-label={`Cerrar sesión de ${profile.displayName}`}
              className="sidebar__logout"
              onClick={() => void handleSignOut()}
              title="Cerrar sesión"
              type="button"
            >
              <Icon name="logout" size={19} />
            </button>
          </div>
        </aside>

        {mobileMenuOpen ? (
          <button
            aria-label="Cerrar menú de navegación"
            className="sidebar-backdrop"
            onClick={closeMobileMenu}
            type="button"
          />
        ) : null}

        <div className="app-shell__workspace">
          <header className="topbar">
            <button
              aria-controls="primary-navigation"
              aria-expanded={mobileMenuOpen}
              aria-label="Abrir menú de navegación"
              className="topbar__menu"
              onClick={() => setMobileMenuOpen(true)}
              ref={mobileMenuTriggerRef}
              type="button"
            >
              <Icon name="menu" />
            </button>
            <div className="topbar__context">
              <span>{companyName}</span>
              <strong>
                {parentRouteLabel === null ? null : <span>{parentRouteLabel} · </span>}
                {currentPageLabel}
              </strong>
            </div>
            <div
              aria-atomic="true"
              aria-label={`Estado de datos: ${syncPresentation.label}. ${syncPresentation.detail}.`}
              className={`network-state network-state--${syncPresentation.tone}`}
              role="status"
            >
              <span className="network-state__icon" aria-hidden="true">
                <Icon name={syncPresentation.icon} size={18} />
              </span>
              <span className="network-state__copy">
                <strong>{syncPresentation.label}</strong>
                <small>{syncPresentation.detail}</small>
              </span>
            </div>
          </header>

          {networkStatus === "OFFLINE" ? (
            <div aria-atomic="true" className="offline-banner" role="status">
              <strong>Sin conexión a internet.</strong> {offlineBannerPresentation.detail}
            </div>
          ) : null}

          {shellError === null ? null : (
            <div className="action-error-banner" role="alert">
              <span>{shellError}</span>
              <button aria-label="Cerrar aviso" onClick={() => setShellError(null)} type="button">
                <Icon name="close" size={17} />
              </button>
            </div>
          )}

          {parentRoutePath === null || parentRouteLabel === null ? null : (
            <nav className="route-context" aria-label="Ubicación actual">
              <Link to={parentRoutePath}>
                <Icon name="chevron" size={15} />
                Volver a {parentRouteLabel}
              </Link>
              <span aria-hidden="true">/</span>
              <strong>{currentPageLabel}</strong>
            </nav>
          )}

          <main className="app-content" id="main-content" tabIndex={-1}>
            <Outlet />
          </main>
        </div>

        <nav className="mobile-navigation" aria-label="Navegación móvil">
          {mobileNavigation.map((item) => (
            <NavLink
              aria-describedby={`mobile-navigation-${item.id}-description`}
              aria-label={item.label}
              className={({ isActive }) =>
                `mobile-navigation__link ${isActive ? "mobile-navigation__link--active" : ""}`
              }
              end={item.path === "/inicio" || item.path === "/mi-viaje"}
              key={item.id}
              to={item.path}
            >
              <NavigationIcon routeId={item.id} />
              <span>{item.label}</span>
              <span className="sr-only" id={`mobile-navigation-${item.id}-description`}>
                {item.description}
              </span>
            </NavLink>
          ))}
          {profile.role === "driver" ? null : (
            <button
              aria-label="Abrir más secciones"
              className="mobile-navigation__link"
              onClick={() => setMobileMenuOpen(true)}
              type="button"
            >
              <Icon name="menu" size={19} />
              <span>Más</span>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
