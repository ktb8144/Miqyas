import {
  BarChart3,
  Building2,
  ClipboardList,
  LayoutDashboard,
  PackageCheck,
  UsersRound,
} from "lucide-react";
import type { OverviewData, Tab } from "./types";

export const emptyOverview: OverviewData = {
  schools: { total: 0 },
  users: {
    total: 0,
    byRole: {
      admin: 0,
      principal: 0,
      teacher: 0,
    },
  },
  students: { total: 0 },
  questions: { total: 0 },
};

export const navItems = [
  { id: "overview", label: "لوحة عامة", icon: LayoutDashboard },
  { id: "schools", label: "المدارس", icon: Building2 },
  { id: "users", label: "المستخدمون", icon: UsersRound },
  { id: "packages", label: "حزم الاختبارات", icon: PackageCheck },
  { id: "trialRequests", label: "طلبات التجربة", icon: ClipboardList },
  { id: "reports", label: "التقارير", icon: BarChart3 },
] satisfies { id: Tab; label: string; icon: typeof LayoutDashboard }[];
