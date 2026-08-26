import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Mail,
  CalendarDays,
  Building2,
  Users,
  FileText,
  Settings,
  Bell,
  GitBranch,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";

const menuItems = [
  { title: "لوحة التحكم", url: "/", icon: LayoutDashboard },
  { title: "المراسلات", url: "/correspondence", icon: Mail },
  { title: "الإجازات والطلبات", url: "/leave-requests", icon: CalendarDays },
  { title: "إشعارات النظام", url: "/notifications", icon: Bell },
];

const adminItems = [
  { title: "الهيكل التنظيمي", url: "/departments", icon: Building2 },
  { title: "إدارة المستخدمين", url: "/employees", icon: Users },
  { title: "مسارات التدفق", url: "/flow-templates", icon: GitBranch },
  { title: "الإعدادات", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { data: publicSettings, isLoading: settingsLoading } = useQuery<{ orgName: string; systemName: string; theme: string; copyrightOwner: string; logoUrl: string | null }>({
    queryKey: ["/api/settings/public"],
    staleTime: 1000 * 60 * 5,
  });

  const { data: userPermissions } = useQuery<any[]>({
    queryKey: ["/api/permissions/mine"],
    staleTime: 1000 * 60 * 5,
  });

  const hasPermission = (key: string) => {
    if (user?.role === "admin") return true;
    return userPermissions?.some((p: any) => p.permission?.key === key || p.key === key) || false;
  };

  const isAdmin = user?.role === "admin";
  const isCentralMail = user?.role === "central_mail";

  const filteredMenuItems = menuItems.filter(item => {
    if (isCentralMail) {
      return item.url === "/" || item.url === "/correspondence" || item.url === "/notifications";
    }
    if (isAdmin) return true;
    if (item.url === "/correspondence" && !user?.canAccessCorrespondence) return false;
    if (item.url === "/leave-requests" && !user?.canAccessLeaveRequests) return false;
    return true;
  });

  const allItems = [
    ...filteredMenuItems,
    ...(isAdmin ? adminItems : []),
  ];

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="p-3.5 border-b border-sidebar-border group-data-[collapsible=icon]:p-2.5 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:justify-center w-full">
          {settingsLoading ? (
            <div className="w-8 h-8 rounded-md shrink-0 bg-muted/40 animate-pulse" />
          ) : publicSettings?.logoUrl ? (
            <div className="w-9 h-9 rounded-lg overflow-hidden shrink-0 flex items-center justify-center bg-background/50 border border-sidebar-border/60">
              <img src={publicSettings.logoUrl} alt="شعار" className="w-full h-full object-contain p-0.5" data-testid="img-sidebar-logo" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-xs">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden transition-all">
            <span className="font-bold text-sm truncate text-sidebar-foreground" data-testid="text-app-name">{publicSettings?.systemName || "نظام إدارة المعاملات الإلكتروني"}</span>
            <span className="text-xs text-muted-foreground truncate">{publicSettings?.orgName || "شركة نفط الوسط"}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:py-2">
        <SidebarGroup className="group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:w-full">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2 group-data-[collapsible=icon]:hidden">
            القائمة الرئيسية
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:gap-1.5">
              {allItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-10 group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:p-0 rounded-lg"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`} className="flex items-center gap-2.5 w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0">
                        <item.icon className="w-4 h-4 shrink-0" />
                        <span className="truncate group-data-[collapsible=icon]:hidden">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border group-data-[collapsible=icon]:hidden">
        {publicSettings?.copyrightOwner && (
          <p className="text-xs font-medium text-sidebar-foreground text-center leading-relaxed" data-testid="text-sidebar-copyright">
            جميع الحقوق محفوظة &copy; {new Date().getFullYear()} {publicSettings.copyrightOwner}
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
