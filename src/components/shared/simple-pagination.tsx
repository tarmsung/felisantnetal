import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface SimplePaginationProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}

/** Prev/next + "Page X of Y" — plain server-rendered links, no client JS needed. */
export function SimplePagination({ page, totalPages, buildHref }: SimplePaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href={page > 1 ? buildHref(page - 1) : undefined}
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={page <= 1 ? "pointer-events-none opacity-40" : undefined}
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href={page < totalPages ? buildHref(page + 1) : undefined}
              aria-disabled={page >= totalPages}
              tabIndex={page >= totalPages ? -1 : undefined}
              className={page >= totalPages ? "pointer-events-none opacity-40" : undefined}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
