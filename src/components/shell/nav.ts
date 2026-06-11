import {
  Gauge,
  Zap,
  Target,
  SquareKanban,
  Radar,
  Megaphone,
  Package,
  BarChart3,
  MessageSquareText,
  Users,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo visible para owner/manager/super admin. */
  admin?: boolean;
  /** Aparece en la bottom nav mobile (se muestran las primeras 5). */
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Gauge, mobile: true },
  { href: "/focus", label: "Focus", icon: Zap, mobile: true },
  { href: "/leads", label: "Leads", icon: Target, mobile: true },
  { href: "/pipeline", label: "Pipeline", icon: SquareKanban, mobile: true },
  { href: "/bases", label: "Bases", icon: Radar, admin: true, mobile: true },
  { href: "/plantillas", label: "Plantillas", icon: MessageSquareText, mobile: true },
  { href: "/campanas", label: "Campañas", icon: Megaphone, admin: true },
  { href: "/productos", label: "Productos", icon: Package, admin: true },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3, admin: true },
  { href: "/equipo", label: "Equipo", icon: Users, admin: true },
  { href: "/ajustes", label: "Ajustes", icon: Settings, admin: true },
];

export function navFor(isAdmin: boolean) {
  return NAV.filter((item) => !item.admin || isAdmin);
}
