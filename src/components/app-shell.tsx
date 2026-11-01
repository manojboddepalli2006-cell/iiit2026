import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Bell, Cpu, FolderKanban, Home, LayoutDashboard, Search, Sigma, Workflow } from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import logo from "@/assets/logo.png";

const nav = [
  { title: "Home", url: "/", icon: Home },
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "CudaQ", url: "/cudaq", icon: Cpu },
  { title: "Q-Circuits", url: "/q-circuits", icon: Workflow },
  { title: "LQM", url: "/lqm", icon: Sigma },
] as const;

function AppSidebar() {
  const path = useRouterState({ select: (r) => r.location.pathname });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-4">
        <div className="flex items-center gap-2.5 px-1">
          <img src={logo} alt="Q-CreditX logo" width={36} height={36} className="size-9 shrink-0 rounded-lg" />
          <span className="font-display text-lg font-bold text-primary-deep group-data-[collapsible=icon]:hidden">Q-CreditX</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {nav.map((item) => {
                const active = item.url === "/" ? path === "/" : path.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild isActive={active} tooltip={item.title}
                      className="h-10 rounded-xl transition-colors data-[active=true]:bg-sidebar-primary data-[active=true]:text-sidebar-primary-foreground"
                    >
                      <Link to={item.url}>
                        <item.icon className="size-4" strokeWidth={1.75} />
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
    </Sidebar>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card/80 px-4 backdrop-blur">
          <SidebarTrigger aria-label="Toggle menu" />
          <img src={logo} alt="" width={28} height={28} className="size-7 rounded-md md:hidden" />
          <div className="min-w-0 leading-tight">
            <div className="font-display text-sm font-bold text-primary-deep">Q-CreditX</div>
            <div className="truncate text-xs text-muted-foreground">Quantum Credit Risk Analysis</div>
          </div>
          <div className="relative ml-auto hidden w-72 sm:block">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search assets, projects…" className="rounded-xl pl-9"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const q = (e.target as HTMLInputElement).value.trim();
                  window.location.href = `/dashboard?q=${encodeURIComponent(q)}`;
                }
              }}
            />
          </div>
          <button
            aria-label="Notifications" onClick={() => toast("No new notifications")}
            className="ml-auto grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-primary-deep sm:ml-0"
          >
            <Bell className="size-4" strokeWidth={1.75} />
          </button>
          <div className="grid size-9 place-items-center rounded-full bg-brand-gradient text-xs font-semibold text-primary-foreground">MB</div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-card p-5 shadow-soft ${className}`}>{children}</div>;
}

export function StatusPill({ tone, children }: { tone: "pending" | "ok" | "warn" | "bad"; children: ReactNode }) {
  const cls = {
    pending: "bg-accent text-accent-foreground",
    ok: "bg-success/15 text-success",
    warn: "bg-warning/20 text-foreground",
    bad: "bg-destructive/15 text-destructive",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}
