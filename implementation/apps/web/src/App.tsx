import { RouterProvider } from "react-router-dom";
import { createAppRouter } from "./app/routing/router";

const router = createAppRouter();

export function App(): React.JSX.Element {
  return <RouterProvider router={router} />;
}
