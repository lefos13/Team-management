/* Keep registration separate from login so the verify-email step can be introduced without overloading one form. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Paper, PasswordInput, Stack, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const registerFormSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type RegisterFormValues = z.infer<typeof registerFormSchema>;

type RegisterFormProps = {
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (values: RegisterFormValues) => void;
  framed?: boolean;
};

export function RegisterForm({ loading, errorMessage, onSubmit, framed = true }: RegisterFormProps) {
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const content = (
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
        <PasswordInput
          label="Password"
          placeholder="Create a password"
          {...form.register("password")}
          error={form.formState.errors.password?.message}
        />
        <Button type="submit" loading={loading} radius="md" size="md">
          Create account
        </Button>
      </Stack>
    </form>
  );

  return framed ? (
    <Paper radius="md" p="xl" shadow="md" withBorder>
      {content}
    </Paper>
  ) : (
    content
  );
}
