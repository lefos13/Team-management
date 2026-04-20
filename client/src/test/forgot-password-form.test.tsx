/* Verify the password reset request form validates email input and forwards the request payload to the recovery flow. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

describe("ForgotPasswordForm", () => {
  it("submits a valid email", async () => {
    const handleSubmit = vi.fn();

    render(
      <MantineProvider>
        <ForgotPasswordForm defaultEmail="" loading={false} errorMessage={null} onSubmit={handleSubmit} />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "leader@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset code/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalled();
      expect(handleSubmit.mock.calls[0]?.[0]).toEqual({
        email: "leader@example.com",
      });
    });
  });
});
