import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Mail,
  CalendarDays,
  Wrench,
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
  { title: "طلبات الخدمات", url: "/service-requests", icon: Wrench },
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
    if (item.url === "/service-requests" && !user?.canAccessServiceRequests) return false;
    return true;
  });

  const allItems = [
    ...filteredMenuItems,
    ...(isAdmin ? adminItems : []),
  ];

  return (
    <Sidebar side="right">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          {settingsLoading ? (
            <div className="w-9 h-9 rounded-md shrink-0" />
          ) : publicSettings?.logoUrl ? (
            <div className="w-9 h-9 rounded-md overflow-hidden shrink-0">
              <img src={publicSettings.logoUrl} alt="شعار" className="w-full h-full object-contain" data-testid="img-sidebar-logo" />
            </div>
          ) : (
            <div className="w-9 h-9 rounded-md bg-primary flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm truncate" data-testid="text-app-name">{publicSettings?.systemName || "نظام إدارة المعاملات الإلكتروني"}</span>
            <span className="text-xs text-muted-foreground truncate">{publicSettings?.orgName || "شركة نفط الوسط"}</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-2">
            القائمة الرئيسية
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {allItems.map((item) => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium"
                    >
                      <Link href={item.url} data-testid={`link-nav-${item.url.replace("/", "") || "dashboard"}`}>
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        {publicSettings?.copyrightOwner && (
          <p className="text-[9px] text-muted-foreground/50 text-center" data-testid="text-sidebar-copyright">
            جميع الحقوق محفوظة &copy; {new Date().getFullYear()} {publicSettings.copyrightOwner}
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
