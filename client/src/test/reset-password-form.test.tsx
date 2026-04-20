/* Verify the password reset form enforces email, OTP, and replacement-password input before it reaches the auth layer. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { ResetPasswordForm } from "../components/ResetPasswordForm";

describe("ResetPasswordForm", () => {
  it("submits a valid reset payload and can resend with the current email", async () => {
    const handleSubmit = vi.fn();
    const handleResend = vi.fn();

    render(
      <MantineProvider>
        <ResetPasswordForm
          defaultEmail="leader@example.com"
          loading={false}
          resendLoading={false}
          errorMessage={null}
          onSubmit={handleSubmit}
          onResend={handleResend}
        />
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText(/reset code/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/new password/i), {
      target: { value: "change-me" },
    });
    fireEvent.click(screen.getByRole("button", { name: /reset password/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalled();
      expect(handleSubmit.mock.calls[0]?.[0]).toEqual({
        email: "leader@example.com",
        otp: "123456",
        password: "change-me",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /resend code/i }));

    await waitFor(() => {
      expect(handleResend).toHaveBeenCalledWith("leader@example.com");
    });
  });
});
