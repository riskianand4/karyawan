import { useState } from "react";
import {
  LayoutDashboard, CheckSquare, Users, Settings, LogOut,
  BarChart3, Clock, Receipt, FileText, User, Link2,
  StickyNote, UserPlus,
  MessageCircleCodeIcon
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTasks } from "@/contexts/TaskContext";
import { useAdminBadges } from "@/hooks/useAdminBadges";
import { useMenuSettings } from "@/contexts/MenuSettingsContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ConfirmDialog from "@/components/ConfirmDialog";
import { cn } from "@/lib/utils";
import logo from "../assets/Logo/Logo2.png";

const MAIN_NAV = [
  { title: "Dasbor", url: "/", icon: LayoutDashboard, badgeKey: "", menuKey: "" },
  { title: "Tugas", url: "/tasks", icon: CheckSquare, badgeKey: "tasks", menuKey: "" },
  { title: "Catatan", url: "/notes", icon: StickyNote, badgeKey: "", menuKey: "notes" },
  { title: "Kehadiran", url: "/attendance", icon: Clock, badgeKey: "attendance", menuKey: "attendance" },
  { title: "Keuangan", url: "/finance", icon: Receipt, badgeKey: "finance", menuKey: "finance" },
  { title: "Slip Gaji", url: "/payslip", icon: FileText, badgeKey: "", menuKey: "payslip" },
  { title: "Tautan", url: "/vault", icon: Link2, badgeKey: "", menuKey: "vault" },
  { title: "Pesan", url: "/messages", icon: MessageCircleCodeIcon, badgeKey: "messages", menuKey: "messages" },
  { title: "Tim", url: "/team", icon: Users, badgeKey: "", menuKey: "team" },
];

const ADMIN_NAV = [
  { title: "Laporan", url: "/reports", icon: BarChart3, badgeKey: "", menuKey: "reports" },
  { title: "Kelola Akun", url: "/accounts", icon: UserPlus, badgeKey: "", menuKey: "accounts" },
];

const TOOLS_NAV = [
  { title: "Profil", url: "/profile", icon: User, badgeKey: "", menuKey: "" },
  { title: "Pengaturan", url: "/settings", icon: Settings, badgeKey: "", menuKey: "" },
];

export function AppSidebar() {
  const { user, logout, isAdmin } = useAuth();
  const { tasks } = useTasks();
  const adminBadges = useAdminBadges();
  const { menuSettings, hasAccess } = useMenuSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const employeePendingCount = !isAdmin
    ? tasks.filter((t) => t.assigneeId === user?.id && t.status === "todo").length
    : 0;

  const getBadgeCount = (badgeKey: string): number => {
    if (!badgeKey) return 0;
    if (isAdmin) return (adminBadges as any)[badgeKey] ?? 0;
    if (badgeKey === "tasks") return employeePendingCount;
    return 0;
  };

  const doLogout = () => {
    logout();
    navigate("/login");
    setConfirmLogout(false);
  };

  // Menu visibility: global toggle only. No position-based hiding.
  // All globally-enabled menus are visible for all users.
  const filteredMain = MAIN_NAV.filter((item) => {
    if (!item.menuKey) return true;
    return (menuSettings as any)[item.menuKey] ?? false;
  });

  // Admin nav: show for admin always, or for employees with accounts access
  const filteredAdmin = ADMIN_NAV.filter((item) => {
    if (!item.menuKey) return isAdmin;
    // "accounts" is not in global menuSettings, it's controlled by positionAccess
    if (item.menuKey === "accounts") {
      return isAdmin || hasAccess("accounts");
    }
    if (!(menuSettings as any)[item.menuKey]) return false;
    return isAdmin || hasAccess(item.menuKey);
  });

  const allItems = [...filteredMain, ...filteredAdmin];

  const isActive = (url: string) =>
    url === "/" ? location.pathname === "/" : location.pathname.startsWith(url);

  const renderIcon = (item: typeof MAIN_NAV[0]) => {
    const active = isActive(item.url);
    const count = getBadgeCount(item.badgeKey);

    return (
      <Tooltip key={item.url} delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => navigate(item.url)}
            className={cn(
              "relative w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground rounded-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground rounded-sm"
            )}
          >
            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                {count > 9 ? "9+" : count}
              </span>
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <>
      <aside className="fixed left-0 top-0 bottom-0 z-40 w-16 flex flex-col items-center bg-sidebar-background border-r border-sidebar-border py-4">
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-6">
          <img src={logo} alt="" />
        </div>

        {/* Main nav */}
        <nav className="flex-1 flex flex-col items-center gap-2 overflow-y-auto">
          {allItems.map(renderIcon)}
        </nav>

        {/* Separator */}
        <div className="w-6 h-px bg-sidebar-border my-3" />

        {/* Tools nav */}
        <div className="flex flex-col items-center gap-2">
          {TOOLS_NAV.map(renderIcon)}
        </div>

        {/* Logout */}
        <div className="mt-3">
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setConfirmLogout(true)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
              >
                <LogOut className="w-[18px] h-[18px]" strokeWidth={1.8} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={12} className="text-xs font-medium">
              Keluar
            </TooltipContent>
          </Tooltip>
        </div>
      </aside>

      <ConfirmDialog
        open={confirmLogout}
        onOpenChange={setConfirmLogout}
        title="Yakin ingin keluar?"
        description="Anda akan keluar dari portal MyTelnet."
        confirmText="Ya, Keluar"
        variant="destructive"
        onConfirm={doLogout}
      />
    </>
  );
}
