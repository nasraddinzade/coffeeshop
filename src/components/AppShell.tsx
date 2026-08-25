// Copyright (c) 2026 Ramin Nasraddinzade
// SPDX-License-Identifier: MIT

import {
  BarChart3,
  Box,
  Database,
  FlaskConical,
  List,
  LogOut,
  Percent,
  ShoppingCart,
  Tags,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { BackupSection } from '../sections/BackupSection';
import { CategoriesSection } from '../sections/CategoriesSection';
import { DiscountsSection } from '../sections/DiscountsSection';
import { FinanceSection } from '../sections/FinanceSection';
import { OrdersSection } from '../sections/OrdersSection';
import { ProductsSection } from '../sections/ProductsSection';
import { ReportsSection } from '../sections/ReportsSection';
import { ResourcesSection } from '../sections/ResourcesSection';
import { SalesSection } from '../sections/SalesSection';
import { UsersSection } from '../sections/UsersSection';
import { useStore } from '../store/useStore';
import type { Section } from '../types';

interface NavItem {
  section: Section;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { section: 'sales', label: 'Sales', icon: ShoppingCart },
  { section: 'orders', label: 'Orders', icon: List },
  { section: 'products', label: 'Products', icon: Box, adminOnly: true },
  { section: 'categories', label: 'Categories', icon: Tags, adminOnly: true },
  { section: 'discounts', label: 'Discounts', icon: Percent, adminOnly: true },
  { section: 'resources', label: 'Resources', icon: FlaskConical },
  { section: 'finance', label: 'Finance', icon: TrendingUp, adminOnly: true },
  { section: 'reports', label: 'Reports', icon: BarChart3, adminOnly: true },
  { section: 'users', label: 'Users', icon: Users, adminOnly: true },
  { section: 'backup', label: 'Backups', icon: Database, adminOnly: true },
];

const SECTIONS: Record<Section, ComponentType> = {
  sales: SalesSection,
  orders: OrdersSection,
  products: ProductsSection,
  categories: CategoriesSection,
  discounts: DiscountsSection,
  resources: ResourcesSection,
  finance: FinanceSection,
  reports: ReportsSection,
  users: UsersSection,
  backup: BackupSection,
};

export function AppShell() {
  const currentUser = useStore((state) => state.currentUser)!;
  const section = useStore((state) => state.section);
  const setSection = useStore((state) => state.setSection);
  const logout = useStore((state) => state.logout);

  const isAdmin = currentUser.role === 'admin';
  const items = NAV.filter((item) => isAdmin || !item.adminOnly);
  const active = items.some((item) => item.section === section) ? section : 'sales';
  const Current = SECTIONS[active];
  const title = NAV.find((item) => item.section === active)?.label ?? '';

  return (
    <div className="screen active" id="main-app">
      <header className="app-header">
        <div className="header-left">
          <div className="user-role-indicator" style={{ backgroundColor: currentUser.color }} />
          <h2>{title}</h2>
        </div>
        <div className="header-right">
          <span>{currentUser.name}</span>
          <button type="button" className="btn-icon" title="Logout" onClick={logout}>
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <nav className="main-nav">
        {items.map((item) => (
          <button
            key={item.section}
            type="button"
            className={`nav-btn${item.section === active ? ' active' : ''}`}
            onClick={() => setSection(item.section)}
          >
            <item.icon size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <main className="app-content">
        <div className="section active">
          <Current />
        </div>
      </main>
    </div>
  );
}
