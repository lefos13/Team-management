/*
Provide public legal reference pages directly in the SPA so registration,
cookie notices, and unauthenticated visitors can resolve policy links.
*/
import { Anchor, Button, Container, Divider, Group, List, Paper, Stack, Text, Title } from "@mantine/core";
import { Link } from "react-router-dom";

type LegalPageKind = "terms" | "privacy" | "cookies";

const updatedAt = "May 3, 2026";

export function LegalPage({ kind }: { kind: LegalPageKind }) {
  const title = kind === "terms" ? "Terms of Service" : kind === "privacy" ? "Privacy Policy" : "Cookie Policy";

  return (
    <main className="legal-page">
      <Container size="md" py={{ base: "xl", md: 56 }}>
        <Stack gap="lg">
          <Group justify="space-between" align="center">
            <Anchor component={Link} to="/" fw={800} c="dark" className="site-brand-link">
              <img className="site-brand-logo site-brand-logo-small" src="/logo.png" alt="MGteam logo" />
              MGteam
            </Anchor>
            <Button component={Link} to="/register" radius="md" variant="light">
              Create account
            </Button>
          </Group>

          <Paper className="legal-content" radius="md" p={{ base: "lg", md: "xl" }} withBorder>
            <Stack gap="lg">
              <Stack gap={4}>
                <Title order={1}>{title}</Title>
                <Text c="dimmed">Last updated: {updatedAt}</Text>
              </Stack>

              {kind === "terms" ? <TermsContent /> : kind === "privacy" ? <PrivacyContent /> : <CookieContent />}

              <Divider />
              <Text size="sm" c="dimmed">
                These pages are a practical starter template for public launch readiness and should be reviewed by
                qualified legal counsel before production use.
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    </main>
  );
}

function TermsContent() {
  return (
    <Stack gap="md">
      <Text>
        These Terms govern use of MGteam, a web app for organizing projects, team members, tasks, deadlines,
        attachments, and related workspace activity. By creating an account, you agree to use the service lawfully and
        only with data you are authorized to manage.
      </Text>
      <List spacing="sm">
        <List.Item>You are responsible for keeping your login details secure and for activity under your account.</List.Item>
        <List.Item>You may not upload unlawful, harmful, infringing, or unauthorized content.</List.Item>
        <List.Item>Workspace data remains your responsibility, including accuracy of project, task, and member records.</List.Item>
        <List.Item>MGteam may suspend access to protect the service, users, or legal compliance.</List.Item>
      </List>
      <Text>
        Contact placeholder: MGteam, service operator/controller contact to be finalized before public launch.
      </Text>
    </Stack>
  );
}

function PrivacyContent() {
  return (
    <Stack gap="md">
      <Text>
        MGteam collects account and workspace data needed to provide the service, including email address,
        password hash, email verification and password reset records, project data, task data, member data, attachments,
        session records, and legal acceptance metadata.
      </Text>
      <List spacing="sm">
        <List.Item>Account email is used for login, verification codes, password reset codes, and service messages.</List.Item>
        <List.Item>Session cookies keep you signed in and protect authenticated routes.</List.Item>
        <List.Item>Legal acceptance records store version, timestamp, IP address, and user agent for compliance evidence.</List.Item>
        <List.Item>Under GDPR, users may request access, correction, deletion, restriction, portability, or objection where applicable.</List.Item>
      </List>
      <Text>
        Contact placeholder: MGteam, privacy contact and legal address to be finalized before public launch.
      </Text>
    </Stack>
  );
}

function CookieContent() {
  return (
    <Stack gap="md">
      <Text>
        MGteam currently uses essential-only cookies and browser storage. These are needed for authentication,
        security, and remembering that the cookie notice was acknowledged. The app does not load analytics, marketing, or
        third-party tracking cookies in v1.
      </Text>
      <List spacing="sm">
        <List.Item>
          <strong>team_management_session:</strong> signed HTTP-only session cookie used to keep authenticated users
          signed in.
        </List.Item>
        <List.Item>
          <strong>team-management-essential-cookies-accepted:</strong> local storage preference used to avoid showing the
          essential-cookie notice after acknowledgement.
        </List.Item>
      </List>
      <Text>
        You can clear cookies and local storage in your browser settings. Clearing the session cookie signs you out, and
        clearing the preference storage may show the cookie notice again.
      </Text>
    </Stack>
  );
}
