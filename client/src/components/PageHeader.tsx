import { Group, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <Group justify="space-between" align="end">
      <Stack gap={4}>
        <Title order={2}>{title}</Title>
        <Text c="dimmed">{description}</Text>
      </Stack>
      {action}
    </Group>
  );
}
