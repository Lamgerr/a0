import React, { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Folder, MoreVertical, Share2, Trash2, Pencil, Download, Move, Plus, ChevronDown, MessageSquare } from '@/lib/icon-map';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogContent,
} from '@/components/ui/alert-dialog';
import { FolderItem } from '@/lib/api';

interface FolderRowProps {
  folder: FolderItem;
  selected?: boolean;
  viewMode?: 'grid' | 'list' | 'compact';
  onOpen: () => void;
  onDelete?: () => void;
  onRename?: (name: string) => void;
  onMove?: () => void;
  onDownload?: () => void;
  onNotes?: () => void;
  onShare?: () => void;
}

const FolderRow: React.FC<FolderRowProps> = ({
  folder, selected, viewMode = 'list', onOpen, onDelete, onRename, onMove, onDownload, onNotes, onShare
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(folder.name);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
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
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameConfirm();
    if (e.key === 'Escape') { setRenameValue(folder.name); setRenaming(false); }
  };

  const handleDeleteClick = () => { setMenuOpen(false); setDeleteConfirmOpen(true); };

  const isGrid = viewMode === 'grid' || viewMode === 'compact';

  return (
    <>
      {isGrid ? (
        <div
          data-kbd-item
          className={cn(
            'group relative flex flex-col items-center p-3 rounded-[10px] cursor-pointer transition-colors duration-150 select-none border border-transparent',
            'bg-card/50 hover:bg-accent/40 hover:border-border',
            selected && 'bg-accent ring-1 ring-foreground/50 border-transparent'
          )}
          onClick={onOpen}
          onDoubleClick={() => setRenaming(true)}
          role="gridcell"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <div className="relative w-16 h-12 mb-2.5">
            <div className="absolute inset-0 bg-muted/30 border border-border/40 rounded-md flex items-center justify-center">
              <Folder className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors duration-150" />
            </div>
          </div>

          <div className="w-full text-center min-w-0 px-1">
            {renaming ? (
              <input
                ref={inputRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={handleRenameConfirm}
                onKeyDown={handleRenameKeyDown}
                className="bg-background border border-ring rounded-md px-1.5 py-0.5 text-xs text-foreground text-center w-full outline-none"
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span className="text-xs font-medium text-foreground block truncate tracking-tight" title={folder.name}>
                {(folder as any).shared && <Share2 className="w-3 h-3 text-muted-foreground inline-flex mr-1 -mt-0.5" />}
                {folder.name}
              </span>
            )}
            <p className="text-[10px] text-muted-foreground mt-0.5 block truncate tabular-nums">
              {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
            </p>
          </div>

          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-center w-6 h-6 rounded-md hover:bg-accent transition-colors">
                  <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
                  <Pencil className="w-3.5 h-3.5" />Rename
                </DropdownMenuItem>
                {onMove && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onMove(); }}>
                    <Move className="w-3.5 h-3.5" />Move
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onDownload(); }}>
                    <Download className="w-3.5 h-3.5" />Download
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onShare(); }}>
                    <Share2 className="w-3.5 h-3.5" />Share
                  </DropdownMenuItem>
                )}
                {onNotes && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onNotes(); }}>
                    <MessageSquare className="w-3.5 h-3.5" />Notes
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10" onClick={handleDeleteClick}>
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ) : (
        <div
          data-kbd-item
          className={cn(
            'group grid grid-cols-[1fr_100px_140px_36px] md:grid-cols-[1fr_110px_150px_100px_36px] items-center px-3 h-10 rounded-md cursor-pointer transition-colors duration-150 select-none border border-transparent',
            'hover:bg-accent/40',
            selected && 'bg-accent ring-1 ring-foreground/40'
          )}
          onClick={onOpen}
          onDoubleClick={() => setRenaming(true)}
          role="row"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onOpen(); }}
        >
          <div className="flex items-center gap-3 min-w-0 pr-3">
            <div className="w-7 h-7 rounded-md bg-muted/50 border border-border/60 flex items-center justify-center shrink-0">
              <Folder className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              {renaming ? (
                <input
                  ref={inputRef}
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={handleRenameConfirm}
                  onKeyDown={handleRenameKeyDown}
                  className="bg-background border border-ring rounded-md px-2 py-0.5 text-[13px] text-foreground w-full outline-none"
                  onClick={e => e.stopPropagation()}
                />
              ) : (
                <span className="text-[13px] font-medium text-foreground block truncate" title={folder.name}>
                  {(folder as any).shared && <Share2 className="w-3 h-3 text-muted-foreground inline-flex mr-1.5 -mt-0.5" />}
                  {folder.name}
                </span>
              )}
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground hidden md:block uppercase tracking-wider font-mono">
            Folder
          </span>

          <span className="text-xs text-muted-foreground truncate tabular-nums">
            {formatDistanceToNow(new Date(folder.created_at), { addSuffix: true })}
          </span>

          <span className="text-xs text-muted-foreground/60 font-mono">—</span>

          <div className="flex justify-end shrink-0" onClick={e => e.stopPropagation()}>
            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-accent opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-colors"
                  aria-label="Folder actions"
                >
                  <MoreVertical className="w-4 h-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 p-1">
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); setRenaming(true); }}>
                  <Pencil className="w-3.5 h-3.5" />Rename
                </DropdownMenuItem>
                {onMove && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onMove(); }}>
                    <Move className="w-3.5 h-3.5" />Move
                  </DropdownMenuItem>
                )}
                {onDownload && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onDownload(); }}>
                    <Download className="w-3.5 h-3.5" />Download
                  </DropdownMenuItem>
                )}
                {onShare && (
                  <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onShare(); }}>
                    <Share2 className="w-3.5 h-3.5" />Share
                  </DropdownMenuItem>
                )}
                {onNotes && (
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="rounded-md gap-2 cursor-pointer text-xs">
                      <span>Additional</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-44 p-1">
                      <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs" onClick={() => { setMenuOpen(false); onNotes(); }}>
                        <MessageSquare className="w-3.5 h-3.5" />Notes
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-md gap-2 cursor-pointer text-xs text-red-400 focus:text-red-300 focus:bg-red-500/10" onClick={handleDeleteClick}>
                  <Trash2 className="w-3.5 h-3.5" />Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="text-foreground">{folder.name}</strong> and all its contents will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setDeleteConfirmOpen(false); onDelete?.(); }} className="bg-red-600 text-white hover:bg-red-500">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

interface FolderListViewProps {
  folders: FolderItem[];
  loading: boolean;
  selectedId?: string;
  viewMode?: 'grid' | 'list' | 'compact';
  onOpen: (folder: FolderItem) => void;
  onDelete?: (folder: FolderItem) => void;
  onRename?: (folder: FolderItem, name: string) => void;
  onMove?: (folder: FolderItem) => void;
  onDownload?: (folder: FolderItem) => void;
  onShare?: (folder: FolderItem) => void;
  onCreateFolder?: () => void;
}

export const FolderListView: React.FC<FolderListViewProps> = ({
  folders, loading, selectedId, viewMode = 'list', onOpen, onDelete, onRename, onMove, onDownload, onShare, onCreateFolder
}) => {
  const [expanded, setExpanded] = useState(true);
  const showEmpty = !loading && folders.length === 0;

  return (
    <section>
      <div className="flex items-center justify-between px-1 pb-2">
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="flex items-center gap-1.5 select-none"
        >
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-neutral-500 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
              !expanded && '-rotate-90'
            )}
          />
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Folders</h2>
          {folders.length > 0 && (
            <span className="text-[11px] text-neutral-400 bg-muted px-1.5 py-px rounded-md">
              {folders.length}
            </span>
          )}
        </button>
        <button
          onClick={onCreateFolder}
          className="flex items-center justify-center w-7 h-7 rounded-md text-neutral-500 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="New Folder"
          title="New Folder"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          expanded ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          maxHeight: expanded ? (loading ? 400 : folders.length > 0 ? folders.length * 76 + 200 : 400) : 0,
        }}
      >
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-[14px_16px] bg-card/40 border border-white/5 rounded-xl animate-pulse">
                <div className="w-8 h-8 rounded-lg bg-white/5 animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-[40%] rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {showEmpty && (
          <div className="flex flex-col items-center justify-center min-h-[200px] px-4 py-8">
            <div className="w-12 h-12 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-center mb-3">
              <Plus className="w-6 h-6 text-neutral-500" />
            </div>
            <h3 className="text-[14px] font-semibold text-white mb-1">No folders yet</h3>
            <p className="text-[12px] text-neutral-400 mb-4 text-center">Create a folder to organize your files</p>
            <Button size="sm" className="rounded-md bg-foreground text-background hover:bg-foreground/90" onClick={onCreateFolder}>New folder</Button>
          </div>
        )}

        {!loading && folders.length > 0 && (
          <div className={cn(viewMode === 'grid' || viewMode === 'compact' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3' : 'space-y-0.5', 'stagger-card')}>
            {folders.map(f => (
              <FolderRow
                key={f.id}
                folder={f}
                viewMode={viewMode}
                selected={f.id === selectedId}
                onOpen={() => onOpen(f)}
                onDelete={onDelete ? () => onDelete(f) : undefined}
                onRename={onRename ? (name) => onRename(f, name) : undefined}
                onMove={onMove ? () => onMove(f) : undefined}
                onDownload={onDownload ? () => onDownload(f) : undefined}
                onShare={onShare ? () => onShare(f) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default FolderRow;
