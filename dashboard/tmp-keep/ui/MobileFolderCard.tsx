import React, { useState, useRef, useEffect, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Folder, MoreVertical, Share2, Trash2, Pencil, Download, Move, FolderOpen, ChevronDown, Plus, Globe } from '@/lib/icon-map';
import MobileSheet from '@/components/ui/MobileSheet';
import { FolderItem } from '@/lib/api';
import MobileMoveToFolderSheet from '@/components/MobileMoveToFolderSheet';
import { usePublishState } from '@/hooks/usePublish';
import { PublishWebsiteModal } from '@/components/publish/PublishWebsiteModal';
import MobileEnhancedShareDialog from '@/components/MobileEnhancedShareDialog';

interface MobileFolderCardProps {
  folder: FolderItem;
  viewMode?: 'grid' | 'list' | 'compact';
  onOpen: () => void;
  onDelete?: () => void;
  onRename?: (name: string) => void;
  onMove?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
}

const MobileFolderCard: React.FC<MobileFolderCardProps> = ({
  folder, viewMode = 'list', onOpen, onDelete, onRename, onMove, onDownload, onShare
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const { publication: pubStatus } = usePublishState(!publishModalOpen ? folder.id : null);
  const longPressRef = useRef<ReturnType<typeof setTimeout>>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [renaming]);

  const handleRenameConfirm = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== folder.name) onRename?.(trimmed);
    setRenaming(false);
    setSheetOpen(false);
  };

  const handleTouchStart = useCallback(() => {
    longPressRef.current = setTimeout(() => setSheetOpen(true), 500);
  }, []);

  const handleTouchEnd = useCallback(() => {
    clearTimeout(longPressRef.current);
  }, []);

  const isGrid = viewMode === 'grid';

  return (
    <>
      {isGrid ? (
        <div
          className="bg-card/50 border border-border/60 rounded-[10px] p-3 cursor-pointer active:bg-accent/50 transition-colors duration-150"
          onClick={onOpen}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
          onContextMenu={(e) => { e.preventDefault(); setSheetOpen(true); }}
        >
          <div className="flex items-start justify-between mb-2.5">
            <div className="w-10 h-10 rounded-md bg-muted/40 border border-border/50 flex items-center justify-center shrink-0">
              <Folder className="w-5 h-5 text-muted-foreground" />
            </div>
            <button
              onClick={e => { e.stopPropagation(); setSheetOpen(true); }}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted/60 transition-colors -mt-0.5 -mr-0.5"
            >
              <MoreVertical className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground block truncate" title={folder.name}>
              {(folder as any).shared && <Share2 className="w-3 h-3 text-primary inline-flex mr-1 -mt-0.5" />}
              {folder.name}
            </span>
            <p className="text-[11px] text-muted-foreground mt-1">
              Modified {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      ) : (
        <div
          className="bg-card border border-border/40 rounded-xl px-4 py-3.5 flex items-center gap-3 cursor-pointer active:scale-[0.99] transition-all duration-150"
          onClick={onOpen}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchEnd}
          onContextMenu={(e) => { e.preventDefault(); setSheetOpen(true); }}
        >
          <div className="w-10 h-10 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center shrink-0">
            <Folder className="w-5 h-5 text-muted-foreground" />
          </div>

          <div className="min-w-0 flex-1">
            {renaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameConfirm();
                  if (e.key === 'Escape') { setRenameValue(folder.name); setRenaming(false); }
                }}
                className="bg-transparent border-b border-muted-foreground text-sm font-medium outline-none w-full"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-medium text-foreground block truncate" title={folder.name}>
                {(folder as any).shared && <Share2 className="w-3.5 h-3.5 text-primary inline-flex mr-1.5 -mt-0.5" />}
                {folder.name}
              </span>
            )}
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              Modified {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
            </p>
          </div>

          <button
            onClick={e => { e.stopPropagation(); setSheetOpen(true); }}
            className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted/60 transition-colors"
          >
            <MoreVertical className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      )}

      <MobileSheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <button
          onClick={() => { setSheetOpen(false); onOpen(); }}
          className="flex items-center gap-4 w-full h-14 px-5 border-b border-border/50 text-base text-foreground font-normal transition-colors active:bg-muted/60"
        >
          <FolderOpen className="w-5 h-5 text-muted-foreground" /> Open
        </button>
        <button
          onClick={() => { setSheetOpen(false); setTimeout(() => setPublishModalOpen(true), 50); }}
          className="flex items-center gap-4 w-full h-14 px-5 border-b border-border/50 text-base text-foreground font-normal transition-colors active:bg-muted/60"
        >
          <Globe className="w-5 h-5 text-muted-foreground" />
          {pubStatus?.status === 'live' ? 'Manage Published Site' : 'Publish as Website'}
        </button>
        <button
          onClick={() => { setSheetOpen(false); setRenaming(true); }}
          className="flex items-center gap-4 w-full h-14 px-5 border-b border-border/50 text-base text-foreground font-normal transition-colors active:bg-muted/60"
        >
          <Pencil className="w-5 h-5 text-muted-foreground" /> Rename
        </button>
        <button
          onClick={() => { setSheetOpen(false); setTimeout(() => setShowMoveSheet(true), 50); }}
          className="flex items-center gap-4 w-full h-14 px-5 border-b border-border/50 text-base text-foreground font-normal transition-colors active:bg-muted/60"
        >
          <Move className="w-5 h-5 text-muted-foreground" /> Move
        </button>
        {onDownload && (
          <button
            onClick={() => { setSheetOpen(false); onDownload(); }}
            className="flex items-center gap-4 w-full h-14 px-5 border-b border-border/50 text-base text-foreground font-normal transition-colors active:bg-muted/60"
          >
            <Download className="w-5 h-5 text-muted-foreground" /> Download
          </button>
        )}
        {onShare && (
          <button
            onClick={() => { setSheetOpen(false); setTimeout(() => setShowShareDialog(true), 150); }}
            className="flex items-center gap-4 w-full h-14 px-5 border-b border-border/50 text-base text-foreground font-normal transition-colors active:bg-muted/60"
          >
            <Share2 className="w-5 h-5 text-muted-foreground" /> Share
          </button>
        )}
        <button
          onClick={() => { setSheetOpen(false); setDeleteConfirmOpen(true); }}
          className="flex items-center gap-4 w-full h-14 px-5 text-base text-destructive font-normal transition-colors active:bg-muted/60"
        >
          <Trash2 className="w-5 h-5 text-destructive" /> Delete
        </button>
      </MobileSheet>

      <MobileSheet open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <div className="px-5 pt-4 pb-2">
          <h3 className="text-lg font-semibold text-foreground">Delete folder?</h3>
          <p className="text-sm text-muted-foreground leading-relaxed mt-1">
            <strong className="text-foreground font-medium">{folder.name}</strong> and all its contents will be permanently deleted.
          </p>
        </div>
        <div className="h-px bg-border/50" />
        <div className="flex flex-col">
          <button
            onClick={() => { setDeleteConfirmOpen(false); onDelete?.(); }}
            className="flex items-center gap-4 w-full h-14 px-5 text-base text-destructive font-normal transition-colors active:bg-muted/60 border-b border-border/50"
          >
            <Trash2 className="w-5 h-5 text-destructive" /> Delete
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(false)}
            className="flex items-center gap-4 w-full h-14 px-5 text-base text-muted-foreground font-normal transition-colors active:bg-muted/60"
          >
            Cancel
          </button>
        </div>
      </MobileSheet>

      <MobileMoveToFolderSheet
        open={showMoveSheet}
        onClose={() => setShowMoveSheet(false)}
        fileIds={[folder.id]}
        onMoved={() => setShowMoveSheet(false)}
        type="folder"
      />

      <PublishWebsiteModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        resourceId={folder.id}
        resourceType="folder"
        resourceName={folder.name}
      />

      <MobileEnhancedShareDialog
        open={showShareDialog}
        onClose={() => setShowShareDialog(false)}
        file={{ ...folder, type: 'folder' } as any}
        onShareChange={() => setShowShareDialog(false)}
      />
    </>
  );
};

interface MobileFolderListProps {
  folders: FolderItem[];
  loading: boolean;
  viewMode?: 'grid' | 'list' | 'compact';
  onOpen: (folder: FolderItem) => void;
  onDelete?: (folder: FolderItem) => void;
  onRename?: (folder: FolderItem, name: string) => void;
  onMove?: (folder: FolderItem) => void;
  onDownload?: (folder: FolderItem) => void;
  onShare?: (folder: FolderItem) => void;
  onCreateFolder?: () => void;
}

export const MobileFolderList: React.FC<MobileFolderListProps> = ({
  folders, loading, viewMode = 'list', onOpen, onDelete, onRename, onMove, onDownload, onShare, onCreateFolder
}) => {
  const [expanded, setExpanded] = useState(true);
  const showEmpty = !loading && folders.length === 0;
  const isGrid = viewMode === 'grid';

  return (
    <section>
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1.5"
        >
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-muted-foreground transition-transform duration-300',
              !expanded && '-rotate-90'
            )}
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Folders</h2>
          {folders.length > 0 && (
            <span className="text-[11px] text-muted-foreground bg-muted/60 px-[7px] py-[1px] rounded-full">
              {folders.length}
            </span>
          )}
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Create folder"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          expanded ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          maxHeight: expanded ? (loading ? 400 : folders.length * 72 + 200) : 0,
        }}
      >
      {loading && (
        <div className={isGrid ? 'grid grid-cols-2 gap-2.5' : 'space-y-2'}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={cn('bg-card border border-border/40 rounded-xl', isGrid ? 'p-3' : 'flex items-center gap-3 px-4 py-3.5')}>
              {isGrid ? (
                <>
                  <div className="w-11 h-11 rounded-xl bg-muted/60 animate-pulse mb-2.5" />
                  <div className="space-y-2">
                    <div className="h-3 w-4/5 rounded bg-muted/60 animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-muted/60 animate-pulse" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl bg-muted/60 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/5 rounded bg-muted/60 animate-pulse" />
                    <div className="h-2.5 w-1/3 rounded bg-muted/60 animate-pulse" />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showEmpty && (
        <div className="flex flex-col items-center justify-center min-h-[260px] px-4">
          <div className="w-14 h-14 rounded-xl bg-muted/60 border border-border/40 flex items-center justify-center mb-4">
            <Folder className="w-7 h-7 text-muted-foreground/60" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">No folders</h3>
          <p className="text-sm text-muted-foreground text-center">Tap + to create your first folder</p>
        </div>
      )}

      {!loading && folders.length > 0 && (
        <div className={cn(isGrid ? 'grid grid-cols-2 gap-2.5' : 'space-y-1.5', 'stagger-card')}>
          {folders.map(f => (
            <MobileFolderCard
              key={f.id}
              folder={f}
              viewMode={viewMode}
              onOpen={() => onOpen(f)}
              onDelete={() => onDelete?.(f)}
              onRename={(name) => onRename?.(f, name)}
              onMove={() => onMove?.(f)}
              onDownload={() => onDownload?.(f)}
              onShare={() => onShare?.(f)}
            />
          ))}
        </div>
      )}
      </div>
    </section>
  );
};

export default MobileFolderCard;
