import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supa = vi.hoisted(() => ({
  configured: true,
  session: null as null | { user: { id: string; email: string } },
  oauthError: null as null | { message: string },
  client: null as unknown,
  listener: null as null | ((event: string, session: unknown) => void),
  calls: { signInWithOAuth: [] as unknown[][], signOut: 0, unsubscribe: 0 },
}));

vi.mock("@/lib/supabase", () => ({
  get supabaseConfigured() {
    return supa.configured;
  },
  get supabase() {
    return supa.client;
  },
}));

vi.mock("@/lib/store", () => ({
  activateUser: vi.fn(async () => {}),
  clearActiveUser: vi.fn(),
}));

import { activateUser, clearActiveUser } from "@/lib/store";
import { AuthGate } from "./auth-gate";

const makeClient = () => {
  supa.calls = { signInWithOAuth: [], signOut: 0, unsubscribe: 0 };
  return {
    auth: {
      getSession: async () => ({ data: { session: supa.session } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        supa.listener = cb;
        return { data: { subscription: { unsubscribe: () => supa.calls.unsubscribe++ } } };
      },
      signInWithOAuth: async (opts: unknown) => {
        supa.calls.signInWithOAuth.push([opts]);
        return { error: supa.oauthError };
      },
      signOut: async () => {
        supa.calls.signOut++;
        return {};
      },
    },
  };
};

beforeEach(() => {
  supa.configured = true;
  supa.session = null;
  supa.oauthError = null;
  supa.listener = null;
  supa.client = makeClient();
});
afterEach(cleanup);

describe("AuthGate", () => {
  it("explains the missing Supabase setup when auth is not configured", async () => {
    supa.configured = false;
    supa.client = null;
    render(<AuthGate>app</AuthGate>);
    expect(await screen.findByText("Finish setting up MUeRA login")).toBeInTheDocument();
    expect(screen.queryByText("app")).not.toBeInTheDocument();
  });

  it("offers Google sign-in when there is no session", async () => {
    render(<AuthGate>app</AuthGate>);
    const button = await screen.findByRole("button", { name: /Continue with Google/ });
    fireEvent.click(button);
    expect(supa.calls.signInWithOAuth).toHaveLength(1);
    expect(supa.calls.signInWithOAuth[0][0]).toMatchObject({ provider: "google" });
  });

  it("surfaces an OAuth failure as an alert", async () => {
    supa.oauthError = { message: "popup blocked" };
    render(<AuthGate>app</AuthGate>);
    fireEvent.click(await screen.findByRole("button", { name: /Continue with Google/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("popup blocked");
  });

  it("renders children with the signed-in email and a working sign-out", async () => {
    supa.session = { user: { id: "u1", email: "a@b.c" } };
    render(<AuthGate>app content</AuthGate>);
    expect(await screen.findByText("app content")).toBeInTheDocument();
    expect(screen.getByText("a@b.c")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(supa.calls.signOut).toBe(1);
  });

  it("activates the store user on sign-in events and clears on sign-out", async () => {
    render(<AuthGate>app content</AuthGate>);
    await screen.findByRole("button", { name: /Continue with Google/ });
    supa.listener!("SIGNED_IN", { user: { id: "u2", email: "x@y.z" } });
    expect(await screen.findByText("app content")).toBeInTheDocument();
    expect(activateUser).toHaveBeenCalledWith("u2");
    supa.listener!("SIGNED_OUT", null);
    expect(await screen.findByRole("button", { name: /Continue with Google/ })).toBeInTheDocument();
    expect(clearActiveUser).toHaveBeenCalled();
  });
});
