import { createBrowserRouter, type RouteObject } from "react-router-dom";
import { APP_ROLES } from "../../features/identity/identity-model";
import { DiagnosticPage } from "../pages/DiagnosticPage";
import { LoginPage } from "../pages/LoginPage";
import { PasswordSetupPage } from "../pages/PasswordSetupPage";
import { CurrentRoutePage } from "../pages/ProductPages";
import { NoAccessPage, NotFoundPage } from "../pages/SystemPages";
import { ProductShell } from "../shells/ProductShell";
import { AuthenticatedRoute, PublicOnlyRoute, RoleHomeRedirect, RoleRoute } from "./route-guards";
import { productRouteAccess, routePaths } from "./route-model";

const protectedProductRoutes: RouteObject[] = productRouteAccess.map(({ id, roles }) => ({
  path: routePaths[id],
  element: <RoleRoute allowedRoles={roles} />,
  children: [{ index: true, element: <CurrentRoutePage /> }],
}));

export const appRouteObjects: RouteObject[] = [
  { path: routePaths.passwordSetup, element: <PasswordSetupPage /> },
  {
    element: <PublicOnlyRoute />,
    children: [{ path: routePaths.login, element: <LoginPage /> }],
  },
  { path: routePaths.noAccess, element: <NoAccessPage /> },
  {
    element: <AuthenticatedRoute />,
    children: [
      {
        element: <ProductShell />,
        children: [
          { index: true, element: <RoleHomeRedirect /> },
          ...protectedProductRoutes,
          {
            path: "/diagnostico",
            element: <RoleRoute allowedRoles={APP_ROLES} />,
            children: [{ index: true, element: <DiagnosticPage /> }],
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export function createAppRouter(): ReturnType<typeof createBrowserRouter> {
  return createBrowserRouter(appRouteObjects);
}
