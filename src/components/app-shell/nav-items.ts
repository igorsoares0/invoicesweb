import { BoxIcon, LayoutGridIcon, SettingsIcon, UsersIcon, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

// Invoices and Estimates join this list in phases 2 and 3.
export const PRIMARY_NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutGridIcon },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/products", label: "Products", icon: BoxIcon },
];

export const SECONDARY_NAV: NavItem[] = [{ href: "/settings", label: "Settings", icon: SettingsIcon }];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
