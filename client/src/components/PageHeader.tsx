import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="end" className="page-header">
      <Stack gap={4} className="page-header-copy">
        <Title order={2}>{title}</Title>
        <Text c="dimmed">{description}</Text>
      </Stack>
      {action ? <div className="page-header-action">{action}</div> : null}
    </Group>
  );
}
