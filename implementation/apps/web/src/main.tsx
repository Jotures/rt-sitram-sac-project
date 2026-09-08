import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wght.css";
import { App } from "./App";
import { AuthProvider } from "./features/auth/AuthProvider";
import { IdentityProvider } from "./features/identity/IdentityProvider";
import "./index.css";
import { registerServiceWorker } from "./lib/pwa/service-worker";
import { PowerSyncProvider } from "./lib/powersync/PowerSyncProvider";
import { OperationModeProvider } from "./features/operation-mode/OperationModeProvider";

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("The application root element is missing.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <PowerSyncProvider>
        <IdentityProvider>
          <OperationModeProvider>
            <App />
          </OperationModeProvider>
        </IdentityProvider>
      </PowerSyncProvider>
    </AuthProvider>
  </StrictMode>,
);

void registerServiceWorker();
