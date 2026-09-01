import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";
import { useAuth } from "../auth/AuthProvider";
import type { IdentityLoadResult } from "./data/identity-gateway";
import { loadProductIdentity } from "./data/product-identity-loader";
import {
  createAnonymousIdentityState,
  createLoadingIdentityState,
  resolveIdentityLoadResult,
  type IdentityState,
} from "./identity-state";

export type IdentityLoader = (userId: string) => Promise<IdentityLoadResult>;

interface IdentityContextValue {
  readonly state: IdentityState;
  reload(): void;
}

interface IdentityProviderProps extends PropsWithChildren {
  readonly loader?: IdentityLoader;
}

const IdentityContext = createContext<IdentityContextValue | null>(null);

export function IdentityProvider({
  children,
  loader = loadProductIdentity,
}: IdentityProviderProps): React.JSX.Element {
  const { state: authState } = useAuth();
  const [reloadSequence, setReloadSequence] = useState(0);
  const [state, setState] = useState<IdentityState>(() => createAnonymousIdentityState());
  const userId = authState.session?.user.id ?? null;

  useEffect(() => {
    if (userId === null) {
      setState(createAnonymousIdentityState());
      return;
    }

    let isCurrent = true;
    setState(createLoadingIdentityState(userId));

    void loader(userId)
      .then((result) => {
        if (isCurrent) {
          setState(resolveIdentityLoadResult(result));
        }
      })
      .catch(() => {
        if (isCurrent) {
          setState({
            status: "UNAVAILABLE",
            reason: "QUERY_FAILED",
            message: "No fue posible cargar la identidad del producto.",
          });
        }
      });

    return (): void => {
      isCurrent = false;
    };
  }, [loader, reloadSequence, userId]);

  const reload = useCallback((): void => {
    setReloadSequence((current) => current + 1);
  }, []);

  return <IdentityContext.Provider value={{ state, reload }}>{children}</IdentityContext.Provider>;
}

export function useIdentity(): IdentityContextValue {
  const context = useContext(IdentityContext);

  if (context === null) {
    throw new Error("useIdentity must be used within IdentityProvider.");
  }

  return context;
}
