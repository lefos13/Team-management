/* Keep the login form separate from routing so the email/password auth step can stay reusable and testable. */
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Anchor, Button, Paper, PasswordInput, Stack, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

const loginFormSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export type LoginFormValues = z.infer<typeof loginFormSchema>;

type LoginFormProps = {
  loading: boolean;
  errorMessage: string | null;
  onSubmit: (values: LoginFormValues) => void;
  framed?: boolean;
};

export function LoginForm({ loading, errorMessage, onSubmit, framed = true }: LoginFormProps) {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
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
          placeholder="Enter your password"
          {...form.register("password")}
          error={form.formState.errors.password?.message}
        />
        <Button type="submit" loading={loading} radius="md" size="md">
          Sign in
        </Button>
        {framed ? (
          <Anchor component={Link} to="/forgot-password" size="sm" ta="center">
            Forgot password?
          </Anchor>
        ) : null}
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
