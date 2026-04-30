export interface NavItem {
  label: string;
  route: string;
  faIcon: string;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',  route: '/dashboard',    faIcon: 'fa-solid fa-gauge-high' },
  { label: 'Devices',    route: '/devices',       faIcon: 'fa-solid fa-mobile-screen' },
  { label: 'Accounts',   route: '/accounts',      faIcon: 'fa-solid fa-users' },
  { label: 'Users',      route: '/admin/users',   faIcon: 'fa-solid fa-user-shield', adminOnly: true },
];
