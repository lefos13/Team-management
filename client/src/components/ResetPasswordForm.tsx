/* Keep OTP verification and password replacement on one form so recovery can complete without sending the user through multiple auth screens. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Paper, PasswordInput, Stack, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const resetPasswordFormSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit reset code."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

type ResetPasswordFormProps = {
  defaultEmail: string;
  loading: boolean;
  resendLoading: boolean;
  errorMessage: string | null;
  onSubmit: (values: ResetPasswordFormValues) => void;
  onResend: (email: string) => void;
};

export function ResetPasswordForm({
  defaultEmail,
  loading,
  resendLoading,
  errorMessage,
  onSubmit,
  onResend,
}: ResetPasswordFormProps) {
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    defaultValues: {
      email: defaultEmail,
      otp: "",
      password: "",
    },
  });

  useEffect(() => {
    form.setValue("email", defaultEmail);
  }, [defaultEmail, form]);

  return (
    <Paper radius="xl" p="xl" shadow="md" withBorder>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Stack>
          {errorMessage ? (
            <Alert color="red" icon={<IconAlertCircle size={16} />} variant="light">
              {errorMessage}
            </Alert>
          ) : null}
          <TextInput
            label="Email"
            placeholder="you@example.com"
            {...form.register("email")}
            error={form.formState.errors.email?.message}
          />
          <TextInput
            label="Reset code"
            placeholder="123456"
            maxLength={6}
            {...form.register("otp")}
            error={form.formState.errors.otp?.message}
          />
          <PasswordInput
            label="New password"
            placeholder="Create a new password"
            {...form.register("password")}
            error={form.formState.errors.password?.message}
          />
          <Group grow>
            <Button type="submit" loading={loading} radius="xl">
              Reset password
            </Button>
            <Button
              type="button"
              variant="light"
              loading={resendLoading}
              radius="xl"
              onClick={() => {
                void form.trigger("email").then((valid) => {
                  if (valid) {
                    onResend(form.getValues("email"));
                  }
                });
              }}
            >
              Resend code
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
