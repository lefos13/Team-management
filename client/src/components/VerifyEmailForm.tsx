/* Keep OTP verification explicit so users can resend a code or change the email context without leaving the page. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Group, Paper, Stack, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const verifyEmailFormSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  otp: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit verification code."),
});

export type VerifyEmailFormValues = z.infer<typeof verifyEmailFormSchema>;

type VerifyEmailFormProps = {
  defaultEmail: string;
  loading: boolean;
  resendLoading: boolean;
  errorMessage: string | null;
  onSubmit: (values: VerifyEmailFormValues) => void;
  onResend: (email: string) => void;
};

export function VerifyEmailForm({
  defaultEmail,
  loading,
  resendLoading,
  errorMessage,
  onSubmit,
  onResend,
}: VerifyEmailFormProps) {
  const form = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailFormSchema),
    defaultValues: {
      email: defaultEmail,
      otp: "",
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
            label="Verification code"
            placeholder="123456"
            maxLength={6}
            {...form.register("otp")}
            error={form.formState.errors.otp?.message}
          />
          <Group grow>
            <Button type="submit" loading={loading} radius="xl">
              Verify email
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
