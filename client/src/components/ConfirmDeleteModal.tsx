import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { IconAlertTriangle } from "@tabler/icons-react";

type ConfirmDeleteModalProps = {
  opened: boolean;
  title?: string;
  itemName: string;
  itemType: string;
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function ConfirmDeleteModal({
  opened,
  title,
  itemName,
  itemType,
  loading = false,
  onClose,
  onConfirm,
}: ConfirmDeleteModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={title ?? `Delete ${itemType}?`}
      centered
      radius="lg"
      classNames={{ content: "confirm-delete-modal" }}
    >
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <IconAlertTriangle size={20} color="var(--mantine-color-red-6)" style={{ flexShrink: 0, marginTop: 2 }} />
          <Text size="sm">
            Are you sure you want to delete <Text span fw={700}>{itemName}</Text>? This action cannot be undone.
          </Text>
        </Group>
        <Group justify="end" gap="sm">
          <Button variant="subtle" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button color="red" onClick={onConfirm} loading={loading}>
            Delete
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
