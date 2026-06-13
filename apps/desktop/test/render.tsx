import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { Session } from "@inference-hackathon/core";
import { SessionProvider } from "../src/state/SessionContext";

/**
 * Render a component inside the providers every screen depends on: a router
 * (so `useNavigate`/`useParams` work) seeded at `route`, and the session store.
 * Pass `initialSession` to seed state; without it the store starts empty, as
 * the app does.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = "/",
    initialSession,
  }: { route?: string; initialSession?: Session } = {},
) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SessionProvider initialSession={initialSession}>{ui}</SessionProvider>
    </MemoryRouter>,
  );
}
