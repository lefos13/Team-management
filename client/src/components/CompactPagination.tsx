/*
Centralize the pagination display window so long result sets keep the arrow
controls but only show three page numbers near the active page.
*/
import { ActionIcon, Button, Group, Text } from "@mantine/core";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

type CompactPaginationProps = {
  total: number;
  value: number;
  onChange: (page: number) => void;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
};

function getVisiblePages(total: number, value: number): number[] {
  if (total <= 3) {
    return Array.from({ length: total }, (_, index) => index + 1);
  }

  if (value <= 2) {
    return [1, 2, 3];
  }

  if (value >= total - 1) {
    return [total - 2, total - 1, total];
  }

  return [value - 1, value, value + 1];
}

export function CompactPagination({ total, value, onChange, size = "sm" }: CompactPaginationProps) {
  const currentPage = Math.min(Math.max(value, 1), total);
  const visiblePages = getVisiblePages(total, currentPage);
  const showLeftEllipsis = visiblePages[0] > 1;
  const showRightEllipsis = visiblePages[visiblePages.length - 1] < total;

  return (
    <Group gap={6} wrap="nowrap" className="compact-pagination">
      <ActionIcon
        size={size}
        variant="default"
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => onChange(currentPage - 1)}
      >
        <IconChevronLeft size={16} />
      </ActionIcon>
      {showLeftEllipsis ? (
        <Text size={size} c="dimmed" className="compact-pagination-ellipsis">
          ...
        </Text>
      ) : null}
      {visiblePages.map((page) => (
        <Button
          key={page}
          size={size}
          variant={page === currentPage ? "filled" : "default"}
          aria-current={page === currentPage ? "page" : undefined}
          onClick={() => onChange(page)}
          className="compact-pagination-page"
        >
          {page}
        </Button>
      ))}
      {showRightEllipsis ? (
        <Text size={size} c="dimmed" className="compact-pagination-ellipsis">
          ...
        </Text>
      ) : null}
      <ActionIcon
        size={size}
        variant="default"
        aria-label="Next page"
        disabled={currentPage === total}
        onClick={() => onChange(currentPage + 1)}
      >
        <IconChevronRight size={16} />
      </ActionIcon>
    </Group>
  );
}
