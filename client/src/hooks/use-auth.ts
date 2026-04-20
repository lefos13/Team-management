/* Keep auth mutations and session cache updates in one hook so registration and login stay in sync with routing. */
import type {
  AuthActionResponseDTO,
  LoginInput,
  RequestPasswordResetInput,
  RegisterInput,
  ResetPasswordInput,
  ResendVerificationInput,
  UserDTO,
  VerifyEmailInput,
} from "@team-management/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../lib/api";

export async function getCurrentUser(): Promise<UserDTO | null> {
  try {
    const response = await api.get<UserDTO>("/auth/me");
    return response.data;
  } catch {
    return null;
  }
}

export function useLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginInput) => {
      const response = await api.post<UserDTO>("/auth/login", payload);
      return response.data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["session"], user);
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: async (payload: RegisterInput) => {
      const response = await api.post<AuthActionResponseDTO>("/auth/register", payload);
      return response.data;
    },
  });
}

export function useVerifyEmail() {
  return useMutation({
    mutationFn: async (payload: VerifyEmailInput) => {
      const response = await api.post<AuthActionResponseDTO>("/auth/verify-email", payload);
      return response.data;
    },
  });
}

export function useResendVerification() {
  return useMutation({
    mutationFn: async (payload: ResendVerificationInput) => {
      const response = await api.post<AuthActionResponseDTO>("/auth/resend-verification", payload);
      return response.data;
    },
  });
}

/*
Keep password-reset mutations beside the rest of auth so public account-recovery
screens use the same API envelope and error handling as login and verification.
*/
export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (payload: RequestPasswordResetInput) => {
      const response = await api.post<AuthActionResponseDTO>("/auth/request-password-reset", payload);
      return response.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: ResetPasswordInput) => {
      const response = await api.post<AuthActionResponseDTO>("/auth/reset-password", payload);
      return response.data;
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post("/auth/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["session"], null);
    },
  });
}
