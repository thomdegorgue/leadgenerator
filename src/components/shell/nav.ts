import {
  Gauge,
  Target,
  SquareKanban,
  Radar,
  MessageSquareText,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Solo visible para owner/manager/super admin. */
  admin?: boolean;
  /** Aparece en la bottom nav mobile. */
  mobile?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Inicio", icon: Gauge, mobile: true },
  { href: "/leads", label: "Leads", icon: Target, mobile: true },
  { href: "/pipeline", label: "Pipeline", icon: SquareKanban, mobile: true },
  { href: "/bases", label: "Bases", icon: Radar, admin: true, mobile: true },
  { href: "/plantillas", label: "Plantillas", icon: MessageSquareText, mobile: true },
  { href: "/equipo", label: "Equipo", icon: Users, admin: true },
];

export function navFor(isAdmin: boolean) {
  return NAV.filter((item) => !item.admin || isAdmin);
}
