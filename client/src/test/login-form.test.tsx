/* Verify the login form surfaces validation and forwards the submitted credentials to the auth layer. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "../components/LoginForm";

describe("LoginForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits valid credentials", async () => {
    const handleSubmit = vi.fn();

    render(
      <MantineProvider>
        <MemoryRouter>
          <LoginForm loading={false} errorMessage={null} onSubmit={handleSubmit} />
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "leader@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "change-me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalled();
      expect(handleSubmit.mock.calls[0]?.[0]).toEqual({
        email: "leader@example.com",
        password: "change-me",
      });
    });

    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/forgot-password");
  });

  it("pre-fills demo credentials when clicking demo button", () => {
    render(
      <MantineProvider>
        <MemoryRouter>
          <LoginForm loading={false} errorMessage={null} onSubmit={vi.fn()} />
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /demo/i }));
    expect(screen.getByLabelText(/email/i)).toHaveValue("demo@team-management.local");
    expect(screen.getByLabelText(/password/i)).toHaveValue("demo-password");
  });
});
