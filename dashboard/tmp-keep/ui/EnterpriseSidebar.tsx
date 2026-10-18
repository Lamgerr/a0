import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useKeyboardShortcutsContext } from '@/components/KeyboardShortcuts';
import {
  Home, FileStack, Users, Trash2, Activity, Book,
  Settings2, PanelLeftClose, PanelLeft, Star, Folder,
  Keyboard, ChevronsUpDown, LogOut, User, Key,
  Inbox, Zap, Lock,
  type Icon,
} from '@/lib/icon-map';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import SwitchAccountSheet from '@/components/SwitchAccountSheet';
import SquidLogo from '@/components/ui/SquidLogo';

/* ── Sidebar contract: props, tab ids and handlers unchanged ── */
interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
  user: any;
  profile: any;
  bookmarks: any[];
  onSearchOpen: () => void;
  onSignOut: () => void;
  currentFolder: string;
  onNavigateToFolder: (path: string) => void;
}

type NavDef = { id: string; label: string; icon: Icon; shortcut?: string };

const PRIMARY_NAV: NavDef[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'files', label: 'Files', icon: FileStack, shortcut: '1' },
  { id: 'shared', label: 'Shared', icon: Users, shortcut: '2' },
  { id: 'trash', label: 'Trash', icon: Trash2, shortcut: '3' },
];

const TOOLS_NAV: NavDef[] = [
  { id: 'analytics', label: 'Analytics', icon: Activity },
  { id: 'secrets', label: 'Secrets', icon: Lock },
  { id: 'scripts', label: 'SquidActions', icon: Zap },
  { id: 'file-requests', label: 'File Requests', icon: Inbox },
  { id: 'books', label: 'Books', icon: Book },
];

/* The modifier key people actually have under their finger. */
const IS_APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent || '');
const MOD = IS_APPLE ? '⌘' : 'Ctrl+';

/* ── Small pieces live at module level on purpose: components declared inside
      the render body get a new identity on every parent render, which remounts
      every button and drops keyboard focus mid-use. ── */

const ROW = 'group relative flex w-full items-center rounded-md outline-none transition-colors duration-100';
const ROW_IDLE = 'text-muted-foreground hover:bg-accent/60 hover:text-foreground';
const ROW_ON = 'bg-accent text-foreground';

function NavItem({
  item, active, collapsed, onSelect,
}: { item: NavDef; active: boolean; collapsed: boolean; onSelect: (id: string) => void }) {
  return (
    <button
      type="button"
      data-sb-item=""
      onClick={() => onSelect(item.id)}
      title={collapsed ? item.label : undefined}
      aria-label={collapsed ? item.label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        ROW,
        collapsed ? 'mx-auto h-8 w-8 justify-center' : 'h-8 gap-2.5 px-2.5',
        active ? ROW_ON : ROW_IDLE,
      )}
    >
      {active && (
        <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-foreground" />
      )}
      <item.icon className="h-4 w-4 shrink-0" />
      {!collapsed && (
        <>
          <span className="flex-1 truncate text-left text-[13px]">{item.label}</span>
          {item.shortcut && (
            <kbd className="font-mono text-[10px] tabular-nums text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              {MOD}{item.shortcut}
            </kbd>
          )}
        </>
      )}
    </button>
  );
}

function SectionLabel({ collapsed, children }: { collapsed: boolean; children: React.ReactNode }) {
  if (collapsed) return <div aria-hidden="true" className="mx-2 my-0.5 h-px bg-border" />;
  return (
    <p className="px-2.5 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

export const EnterpriseSidebar: React.FC<SidebarProps> = ({
  activeTab, onTabChange, sidebarCollapsed, onToggleCollapse,
  user, profile, bookmarks, onSearchOpen: _onSearchOpen, onSignOut,
  currentFolder: _currentFolder, onNavigateToFolder,
}) => {
  const navigate = useNavigate();
  const { setOverlayOpen } = useKeyboardShortcutsContext();
  const collapsed = sidebarCollapsed;
  const [switchOpen, setSwitchOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  const planLabel = profile?.is_premium
    ? (profile?.tier === 'supporter-plus' ? 'Supporter+' : 'Supporter')
    : 'Free';
  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'User';

  /* ↑ ↓ Home End move between items; stopPropagation keeps the file grid's own
     arrow-key navigation from also reacting. */
  const onNavKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const items = Array.from(navRef.current?.querySelectorAll<HTMLElement>('[data-sb-item]') ?? []);
    if (!items.length) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    let next = i;
    if (e.key === 'ArrowDown') next = i < 0 ? 0 : Math.min(items.length - 1, i + 1);
    else if (e.key === 'ArrowUp') next = i < 0 ? items.length - 1 : Math.max(0, i - 1);
    else if (e.key === 'Home') next = 0;
    else next = items.length - 1;
    e.preventDefault();
    e.stopPropagation();
    items[next]?.focus();
  };

  return (
    <aside
      aria-label="Workspace sidebar"
      className={cn(
        'flex flex-shrink-0 select-none flex-col border-r border-border bg-card',
        'transition-[width] duration-150 ease-out',
        collapsed ? 'w-[60px]' : 'w-[232px]',
      )}
    >
      {/* Workspace / app identity */}
      <div className={cn(
        'flex h-12 shrink-0 items-center border-b border-border',
        collapsed ? 'justify-center' : 'justify-between pl-3 pr-1.5',
      )}>
        {!collapsed && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Account and workspace menu"
                className="-ml-0.5 flex min-w-0 items-center gap-2 rounded-md py-1 pr-2 outline-none transition-colors hover:bg-accent/60"
              >
                <SquidLogo size={20} mono />
                <span className="truncate text-[13px] font-medium tracking-tight text-foreground">SquidCloud</span>
                <ChevronsUpDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <div className="px-2 py-1.5">
                <p className="truncate text-[13px] font-medium text-foreground">{profile?.full_name || 'User'}</p>
                <p className="truncate text-[12px] text-muted-foreground">{user?.email}</p>
                <p className="mt-1.5 inline-flex rounded border border-border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {planLabel} plan
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/pricing')}>
                <Star className="h-3.5 w-3.5" />
                <span>{profile?.is_premium ? 'Manage plan' : 'Upgrade plan'}</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/settings/account')}>
                <Settings2 className="h-3.5 w-3.5" /><span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => navigate('/developer-api')}>
                <Key className="h-3.5 w-3.5" /><span>API keys</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setOverlayOpen(true)}>
                <Keyboard className="h-3.5 w-3.5" /><span>Shortcuts</span>
                <kbd className="ml-auto font-mono text-[10px] text-muted-foreground">{MOD}/</kbd>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
                <User className="h-3.5 w-3.5" /><span>Switch account</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={onSignOut}
              >
                <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent/60 hover:text-foreground"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav
        ref={navRef}
        aria-label="Primary"
        onKeyDown={onNavKeyDown}
        className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-2 py-3 lg-scrollbar-none"
      >
        <div className="space-y-0.5">
          <SectionLabel collapsed={collapsed}>Workspace</SectionLabel>
          {PRIMARY_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={activeTab === item.id} collapsed={collapsed} onSelect={onTabChange} />
          ))}
        </div>

        <div className="space-y-0.5">
          <SectionLabel collapsed={collapsed}>Tools</SectionLabel>
          {TOOLS_NAV.map((item) => (
            <NavItem key={item.id} item={item} active={activeTab === item.id} collapsed={collapsed} onSelect={onTabChange} />
          ))}
        </div>

        {!collapsed && bookmarks.length > 0 && (
          <div className="space-y-0.5">
            <SectionLabel collapsed={collapsed}>Favorites</SectionLabel>
            {bookmarks.slice(0, 5).map((b) => (
              <button
                key={b.id}
                type="button"
                data-sb-item=""
                title={b.path || b.name}
                onClick={() => {
                  if (b.type === 'folder' && b.path) { onNavigateToFolder(b.path); onTabChange('files'); }
                }}
                className={cn(ROW, ROW_IDLE, 'h-8 gap-2.5 px-2.5')}
              >
                {b.type === 'folder'
                  ? <Folder className="h-4 w-4 shrink-0" />
                  : <FileStack className="h-4 w-4 shrink-0" />}
                <span className="truncate text-[13px]">{b.name}</span>
              </button>
            ))}
          </div>
        )}
      </nav>

      {/* Footer: settings + account */}
      <div className="shrink-0 space-y-0.5 border-t border-border p-2">
        <button
          type="button"
          onClick={() => navigate('/settings/account')}
          title={collapsed ? 'Settings' : undefined}
          aria-label={collapsed ? 'Settings' : undefined}
          aria-current={activeTab === 'settings' ? 'page' : undefined}
          className={cn(
            ROW,
            collapsed ? 'mx-auto h-8 w-8 justify-center' : 'h-8 gap-2.5 px-2.5',
            activeTab === 'settings' ? ROW_ON : ROW_IDLE,
          )}
        >
          {activeTab === 'settings' && (
            <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-foreground" />
          )}
          <Settings2 className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-[13px]">Settings</span>}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={`Account menu, ${displayName}`}
              className={cn(
                'group flex w-full items-center rounded-md outline-none transition-colors hover:bg-accent/60',
                collapsed ? 'mx-auto h-10 w-10 justify-center' : 'h-11 gap-2.5 px-2',
              )}
            >
              <div
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-[11px] font-medium text-foreground"
              >
                {(profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              {!collapsed && (
                <>
                  <div className="min-w-0 text-left">
                    <p className="truncate text-[12.5px] font-medium leading-tight text-foreground">{displayName}</p>
                    <p className="truncate font-mono text-[10px] uppercase leading-tight tracking-[0.12em] text-muted-foreground">{planLabel}</p>
                  </div>
                  <ChevronsUpDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={collapsed ? 'center' : 'start'} side="top" sideOffset={10} className="w-56">
            <div className="px-2 py-1.5">
              <p className="truncate text-[13px] font-medium text-foreground">{profile?.full_name || 'User'}</p>
              <p className="truncate text-[12px] text-muted-foreground">{user?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 text-[13px]" onClick={() => setSwitchOpen(true)}>
              <User className="h-3.5 w-3.5" /><span>Switch account</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-[13px] text-destructive focus:bg-destructive/10 focus:text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="h-3.5 w-3.5" /><span>Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SwitchAccountSheet open={switchOpen} onOpenChange={setSwitchOpen} />
    </aside>
  );
};

export default EnterpriseSidebar;
