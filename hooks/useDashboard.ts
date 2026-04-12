import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

export interface MonthlyChartPoint {
  month: string; // e.g. "Apr"
  total: number;
}

export interface PlatformBreakdown {
  platform: string;
  total: number;
}

export interface DashboardData {
  currentMonthTotal: number;
  lastMonthTotal: number;
  allTimeTotal: number;
  percentChange: number | null; // null if no last-month data
  chartData: MonthlyChartPoint[];
  platformBreakdown: PlatformBreakdown[];
  isEmpty: boolean;
  currentMonthExpenses: number;
  netProfit: number;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function yearMonth(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

export function useDashboard(): DashboardData & { loading: boolean } {
  const income = useAppStore((s) => s.income);
  const expenses = useAppStore((s) => s.expenses);
  const loading = useAppStore((s) => s.incomeLoading || s.expensesLoading);

  const data = useMemo<DashboardData>(() => {
    const now = new Date();
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth(); // 0-indexed

    const currentKey = `${thisYear}-${String(thisMonth + 1).padStart(2, '0')}`;
    const prevDate = new Date(thisYear, thisMonth - 1, 1);
    const lastKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // Build income totals per YYYY-MM
    const monthlyTotals = new Map<string, number>();
    for (const r of income) {
      const key = yearMonth(r.date);
      monthlyTotals.set(key, (monthlyTotals.get(key) ?? 0) + Number(r.amount));
    }

    const currentMonthTotal = monthlyTotals.get(currentKey) ?? 0;
    const lastMonthTotal = monthlyTotals.get(lastKey) ?? 0;
    const allTimeTotal = income.reduce((sum, r) => sum + Number(r.amount), 0);

    // Percentage change
    let percentChange: number | null = null;
    if (lastMonthTotal > 0) {
      percentChange = ((currentMonthTotal - lastMonthTotal) / lastMonthTotal) * 100;
    }

    // Build 6-month chart: last 6 months including current
    const chartData: MonthlyChartPoint[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      chartData.push({
        month: MONTH_ABBR[d.getMonth()],
        total: monthlyTotals.get(key) ?? 0,
      });
    }

    // Platform breakdown for current month
    const platformMap = new Map<string, number>();
    for (const r of income) {
      if (yearMonth(r.date) === currentKey) {
        platformMap.set(r.platform, (platformMap.get(r.platform) ?? 0) + Number(r.amount));
      }
    }
    const platformBreakdown: PlatformBreakdown[] = Array.from(platformMap.entries())
      .map(([platform, total]) => ({ platform, total }))
      .sort((a, b) => b.total - a.total);

    // Expenses this month
    const currentMonthExpenses = expenses
      .filter((e) => yearMonth(e.date) === currentKey)
      .reduce((sum, e) => sum + Number(e.amount), 0);

    const netProfit = currentMonthTotal - currentMonthExpenses;

    return {
      currentMonthTotal,
      lastMonthTotal,
      allTimeTotal,
      percentChange,
      chartData,
      platformBreakdown,
      isEmpty: income.length === 0,
      currentMonthExpenses,
      netProfit,
    };
  }, [income, expenses]);

  return { ...data, loading };
}
