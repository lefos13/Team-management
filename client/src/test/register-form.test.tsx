/* Verify the public registration form blocks account creation until legal terms are accepted. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { legalDocumentVersion } from "@team-management/shared";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { RegisterForm } from "../components/RegisterForm";

describe("RegisterForm", () => {
  it("requires legal acceptance and submits the consent payload", async () => {
    const handleSubmit = vi.fn();

    render(
      <MantineProvider>
        <MemoryRouter>
          <RegisterForm loading={false} errorMessage={null} onSubmit={handleSubmit} />
        </MemoryRouter>
      </MantineProvider>,
    );

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "leader@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "change-me" },
    });

    expect(screen.getByRole("button", { name: /create account/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/i agree/i));
    fireEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(handleSubmit).toHaveBeenCalledWith(
        {
          email: "leader@example.com",
          password: "change-me",
          acceptedTerms: true,
          legalVersion: legalDocumentVersion,
        },
        expect.anything(),
      );
    });

    expect(screen.getByRole("link", { name: /terms of service/i })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: /privacy policy/i })).toHaveAttribute("href", "/privacy");
  });
});
