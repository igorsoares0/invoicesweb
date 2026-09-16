import {
  BoxIcon,
  FileTextIcon,
  LayoutGridIcon,
  MenuIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  countKey?: keyof NavCounts;
}

export interface NavCounts {
  invoices: number;
  estimates: number;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: "/overview", label: "Overview", icon: LayoutGridIcon },
  { href: "/invoices", label: "Invoices", icon: FileTextIcon, countKey: "invoices" },
  { href: "/estimates", label: "Estimates", icon: ReceiptTextIcon, countKey: "estimates" },
  { href: "/clients", label: "Clients", icon: UsersIcon },
  { href: "/products", label: "Products", icon: BoxIcon },
];

export const SECONDARY_NAV: NavItem[] = [{ href: "/settings", label: "Settings", icon: SettingsIcon }];

/** Phone tab bar (design g2): Invoices, Estimates, Clients, then More for everything else. */
export const PHONE_TABS: NavItem[] = [PRIMARY_NAV[1], PRIMARY_NAV[2], PRIMARY_NAV[3]];

/** Destinations behind the phone's More tab. */
export const MORE_NAV: NavItem[] = [PRIMARY_NAV[0], PRIMARY_NAV[4], ...SECONDARY_NAV];

export const MORE_ICON = MenuIcon;

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
