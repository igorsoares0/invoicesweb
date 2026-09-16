import { BoxIcon, FileTextIcon, LayoutGridIcon, SettingsIcon, UsersIcon, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: keyof NavCounts;
}

export interface NavCounts {
  invoices: number;
}

// Estimates join this list in phase 3.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutGridIcon },
  { href: "/invoices", label: "Invoices", icon: FileTextIcon, countKey: "invoices" },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/products", label: "Products", icon: BoxIcon },
];

export const SECONDARY_NAV: NavItem[] = [{ href: "/settings", label: "Settings", icon: SettingsIcon }];

/** Phone tab bar: four destinations, invoices first (design g2). */
export const PHONE_TABS: NavItem[] = [
  PRIMARY_NAV[1],
  PRIMARY_NAV[2],
  PRIMARY_NAV[3],
  { href: "/settings", label: "More", icon: SettingsIcon },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
