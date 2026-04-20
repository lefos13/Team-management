/* Verify the login form surfaces validation and forwards the submitted credentials to the auth layer. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "../components/LoginForm";

describe("LoginForm", () => {
  it("submits valid credentials", async () => {
    const handleSubmit = vi.fn();

    render(
      <MantineProvider>
        <LoginForm loading={false} errorMessage={null} onSubmit={handleSubmit} />
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
  });
});
