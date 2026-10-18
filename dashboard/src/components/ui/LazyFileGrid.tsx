import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { FileItem as FileItemType } from '@/lib/api';

interface LazyFileGridProps {
  files: FileItemType[];
  viewMode: 'grid' | 'list' | 'compact';
  renderFile: (file: FileItemType, index: number) => React.ReactNode;
  loading?: boolean;
  emptyState?: React.ReactNode;
  batchSize?: number;
  /**
   * Optional. When given, the window of rendered rows only resets when this
   * value changes (folder or search changed) — not whenever the file count does.
   * Without it, uploading or deleting a file while scrolled deep in a long
   * folder snaps the list back to the first batch.
   */
  resetKey?: string;
}

const INCREMENT = 48;

const GridSkeleton = () => (
  <div className="overflow-hidden rounded-md border border-border bg-card p-4">
    <div className="flex flex-col items-center gap-3">
      <div className="sq-skeleton h-16 w-14 flex-shrink-0 rounded-md" />
      <div className="w-full space-y-2 pt-1 text-center">
        <div className="sq-skeleton mx-auto h-3 w-3/4 rounded" />
        <div className="sq-skeleton mx-auto h-2 w-1/2 rounded" />
      </div>
    </div>
  </div>
);

/* Same column templates as the list header below — rows must line up. */
const ListSkeleton = () => (
  <div className="flex h-10 items-center gap-3 rounded-md border border-transparent px-3">
    <div className="sq-skeleton h-6 w-6 flex-shrink-0 rounded" />
    <div className="sq-skeleton h-3 max-w-[220px] flex-1 rounded" />
    <div className="sq-skeleton hidden h-2.5 w-20 rounded md:block" />
    <div className="sq-skeleton hidden h-2.5 w-24 rounded lg:block" />
  </div>
);

const LazyFileGrid: React.FC<LazyFileGridProps> = ({
  files,
  viewMode,
  renderFile,
  loading = false,
  emptyState,
  batchSize = INCREMENT,
  resetKey,
}) => {
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(visibleCount);
  const filesLenRef = useRef(files.length);

  const isCompact = viewMode === 'compact';
  const isList = viewMode === 'list';
  const isGrid = viewMode === 'grid' || isCompact;

  useEffect(() => { visibleRef.current = visibleCount; }, [visibleCount]);
  useEffect(() => { filesLenRef.current = files.length; }, [files.length]);

  // Original behaviour (no resetKey): reset whenever the count changes.
  // With resetKey: reset only when the folder/search changes.
  useEffect(() => {
    if (resetKey === undefined) setVisibleCount(batchSize);
  }, [files.length, batchSize, resetKey]);
  useEffect(() => {
    if (resetKey !== undefined) setVisibleCount(batchSize);
  }, [resetKey, batchSize]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + batchSize, filesLenRef.current));
  }, [batchSize]);

  // A fresh observer after every batch fires immediately if the sentinel is still
  // in range, so tall screens keep filling instead of stalling after one batch.
  // `loading` is a dependency because the sentinel only exists once loading ends.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleRef.current < filesLenRef.current) {
          loadMore();
        }
      },
      { threshold: 0, rootMargin: '600px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore, loading, visibleCount, files.length]);

  const getGridClass = () => {
    if (isCompact) return 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2';
    if (isGrid) return 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2.5';
    return 'space-y-0.5';
  };

  if (loading) {
    const n = Math.min(batchSize, 14);
    return (
      <div className={getGridClass()} role="status" aria-busy="true" aria-live="polite">
        <span className="sr-only">Loading files…</span>
        {Array.from({ length: n }).map((_, i) => (
          isList ? <ListSkeleton key={i} /> : <GridSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (!loading && files.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  const visibleFiles = files.slice(0, visibleCount);
  const remaining = files.length - visibleFiles.length;

  return (
    <div className="w-full select-none">
      {/* Column header (list mode only). Templates match the list rows exactly. */}
      {isList && (
        <div
          aria-hidden="true"
          className="mb-1 grid grid-cols-[1fr_100px_140px_36px] items-center border-b border-border px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground md:grid-cols-[1fr_110px_150px_100px_36px]"
        >
          <span>Name</span>
          <span className="hidden md:block">Kind</span>
          <span>Date Modified</span>
          <span>Size</span>
          <span />
        </div>
      )}

      <div className={cn(getGridClass())}>
        {visibleFiles.map((file, index) => (
          <React.Fragment key={file.id}>
            {renderFile(file, index)}
          </React.Fragment>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden="true" className="h-1 w-full" />

      {remaining > 0 && (
        <div className="flex items-center justify-center gap-3 py-4 font-mono text-[11px] tabular-nums text-muted-foreground" role="status">
          <span>
            Showing {visibleFiles.length.toLocaleString()} of {files.length.toLocaleString()}
          </span>
          <button
            type="button"
            onClick={loadMore}
            className="rounded border border-border px-2 py-0.5 text-foreground transition-colors hover:bg-accent"
          >
            Show more
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(LazyFileGrid);
export { LazyFileGrid };
