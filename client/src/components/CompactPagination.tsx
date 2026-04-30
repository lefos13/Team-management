/*
Centralize the pagination display window so long result sets keep the arrow
controls but only show page numbers near the active page.
*/
import { Pagination, type PaginationProps } from "@mantine/core";

export function CompactPagination(props: PaginationProps) {
  return <Pagination siblings={1} boundaries={1} {...props} />;
}
