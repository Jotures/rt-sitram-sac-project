import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../features/auth/AuthProvider";
import { useIdentity } from "../../features/identity/IdentityProvider";
import type { AppRole } from "../../features/identity/identity-model";
import {
  decideAuthenticatedRoute,
  decidePublicOnlyRoute,
  decideRoleHome,
  decideRoleRoute,
  type RouteGuardDecision,
} from "./guard-decisions";

function renderDecision(decision: RouteGuardDecision): React.JSX.Element | null {
  if (decision.kind === "WAIT") {
    return null;
  }

  return decision.kind === "ALLOW" ? <Outlet /> : <Navigate replace to={decision.to} />;
}

export function AuthenticatedRoute(): React.JSX.Element | null {
  const { state } = useAuth();

  return renderDecision(decideAuthenticatedRoute(state));
}

export function PublicOnlyRoute(): React.JSX.Element | null {
  const { state: authState } = useAuth();
  const { state: identityState } = useIdentity();

  return renderDecision(decidePublicOnlyRoute(authState, identityState));
}

interface RoleRouteProps {
  readonly allowedRoles: readonly AppRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps): React.JSX.Element | null {
  const { state } = useIdentity();

  return renderDecision(decideRoleRoute(state, allowedRoles));
}

export function RoleHomeRedirect(): React.JSX.Element | null {
  const { state } = useIdentity();

  return renderDecision(decideRoleHome(state));
}
