/* Keep registration separate from login so the verify-email step can be introduced without overloading one form. */
import { zodResolver } from "@hookform/resolvers/zod";
import { legalDocumentVersion } from "@team-management/shared";
import { Alert, Anchor, Button, Checkbox, Paper, PasswordInput, Stack, Text, TextInput } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

const registerFormSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  acceptedTerms: z.boolean().refine((value) => value, "You must accept the Terms and Privacy Policy."),
  legalVersion: z.literal(legalDocumentVersion),
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
      acceptedTerms: false,
      legalVersion: legalDocumentVersion,
    },
  });
  const acceptedTerms = form.watch("acceptedTerms");

  const content = (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <input type="hidden" {...form.register("legalVersion")} />
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
        <Checkbox
          label={
            <Text size="sm">
              I agree to the{" "}
              <Anchor component={Link} to="/terms" target="_blank" rel="noopener noreferrer">
                Terms of Service
              </Anchor>{" "}
              and{" "}
              <Anchor component={Link} to="/privacy" target="_blank" rel="noopener noreferrer">
                Privacy Policy
              </Anchor>
              .
            </Text>
          }
          {...form.register("acceptedTerms")}
          error={form.formState.errors.acceptedTerms?.message}
        />
        <Button type="submit" loading={loading} radius="md" size="md" disabled={!acceptedTerms}>
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
