import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SessionProvider } from "../src/state/SessionContext";

/**
 * Render a component inside the providers every screen depends on: a router
 * (so `useNavigate`/`useParams` work) seeded at `route`, and the session
 * store over the mock session.
 */
export function renderWithProviders(
  ui: ReactElement,
  { route = "/" }: { route?: string } = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SessionProvider>{ui}</SessionProvider>
    </MemoryRouter>,
  );
}
