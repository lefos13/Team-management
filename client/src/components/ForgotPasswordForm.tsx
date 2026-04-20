/* Keep password reset requests limited to the email step so account recovery starts without exposing whether an account exists. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Paper, Stack, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const forgotPasswordFormSchema = z.object({
  email: z.string().email("Enter a valid email address."),
});

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordFormSchema>;

type ForgotPasswordFormProps = {
  defaultEmail: string;
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (values: ForgotPasswordFormValues) => void;
};

export function ForgotPasswordForm({ defaultEmail, loading, errorMessage, onSubmit }: ForgotPasswordFormProps) {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordFormSchema),
    defaultValues: {
      email: defaultEmail,
    },
  });

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
          <Button type="submit" loading={loading} radius="xl">
            Send reset code
          </Button>
        </Stack>
      </form>
    </Paper>
  );
}
