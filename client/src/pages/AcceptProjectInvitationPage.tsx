/*
Handle token-based invitation acceptance in one screen so email-matched account
checks and error feedback are explicit before users enter shared projects.
*/
import { Alert, Button, Card, Group, Loader, Stack, Text } from "@mantine/core";
import { IconCircleCheck, IconInfoCircle } from "@tabler/icons-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { api, getErrorMessage } from "../lib/api";

export function AcceptProjectInvitationPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const token = useMemo(() => searchParams.get("token") ?? "", [searchParams]);

  const acceptInvitation = useMutation({
    mutationFn: async () => {
      await api.post("/project-invitations/accept", { token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/projects", { replace: true });
    },
  });

  if (!token) {
    return (
      <Card withBorder radius="lg">
        <Alert color="red" title="Invalid invitation" icon={<IconInfoCircle size={16} />}>
          Missing invitation token.
        </Alert>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      <Card withBorder radius="lg">
        <Stack>
          <Text fw={800} fz="xl">Accept project invitation</Text>
          <Text c="dimmed">You must be signed in with the same email that received the invitation.</Text>
          <Group>
            <Button onClick={() => acceptInvitation.mutate()} disabled={acceptInvitation.isPending}>
              Accept invitation
            </Button>
            {acceptInvitation.isPending ? <Loader size="sm" /> : null}
          </Group>
          {acceptInvitation.isError ? (
            <Alert color="red" title="Unable to accept" icon={<IconInfoCircle size={16} />}>
              {getErrorMessage(acceptInvitation.error)}
            </Alert>
          ) : null}
          {acceptInvitation.isSuccess ? (
            <Alert color="teal" title="Invitation accepted" icon={<IconCircleCheck size={16} />}>
              Redirecting to projects...
            </Alert>
          ) : null}
        </Stack>
      </Card>
    </Stack>
  );
}
