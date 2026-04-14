import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Polyline, Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';
import { useAppStore } from '../../store/useAppStore';
import { useIncome } from '../../hooks/useIncome';
import { useExpenses } from '../../hooks/useExpenses';
import { useDashboard } from '../../hooks/useDashboard';
import { formatCurrency } from '../../lib/formatters';

const MINT = '#34D399';
const RED = '#EF4444';
const EXPENSE_ACCENT = '#F87171';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentMonthLabel(): string {
  const now = new Date();
  return `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
}

function shortCurrency(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
}

function RevenueChart({
  chartData,
  width,
}: {
  chartData: { month: string; total: number }[];
  width: number;
}) {
  const SVG_H = 180;
  const PAD_L = 40;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 28;
  const plotW = width - PAD_L - PAD_R;
  const plotH = SVG_H - PAD_T - PAD_B;
  const n = chartData.length;
  const maxVal = Math.max(...chartData.map((d) => d.total), 1);

  const xOf = (i: number) =>
    n === 1 ? PAD_L + plotW / 2 : PAD_L + (i / (n - 1)) * plotW;
  const yOf = (v: number) => PAD_T + plotH - (v / maxVal) * plotH;

  const polyPoints = chartData.map((d, i) => `${xOf(i)},${yOf(d.total)}`).join(' ');
  const gridTicks = [0, 0.33, 0.66, 1];

  return (
    <Svg width={width} height={SVG_H}>
      {gridTicks.map((t, i) => {
        const gy = PAD_T + (1 - t) * plotH;
        return (
          <React.Fragment key={i}>
            <SvgLine
              x1={PAD_L}
              y1={gy}
              x2={width - PAD_R}
              y2={gy}
              stroke="#262626"
              strokeWidth={1}
            />
            <SvgText
              x={PAD_L - 4}
              y={gy + 4}
              textAnchor="end"
              fontSize={9}
              fill="#A3A3A3"
            >
              {shortCurrency(maxVal * t)}
            </SvgText>
          </React.Fragment>
        );
      })}
      {n > 1 && (
        <Polyline
          points={polyPoints}
          fill="none"
          stroke={MINT}
          strokeWidth={2}
        />
      )}
      {chartData.map((d, i) => (
        <Circle
          key={i}
          cx={xOf(i)}
          cy={yOf(d.total)}
          r={4}
          fill="#0A0A0A"
          stroke={MINT}
          strokeWidth={2}
        />
      ))}
      {chartData.map((d, i) => (
        <SvgText
          key={i}
          x={xOf(i)}
          y={SVG_H - 4}
          textAnchor="middle"
          fontSize={9}
          fill="#A3A3A3"
        >
          {d.month}
        </SvgText>
      ))}
    </Svg>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#262626',
        padding: 14,
      }}
    >
      <Text
        style={{
          color: '#A3A3A3',
          fontSize: 10,
          fontFamily: 'Inter_500Medium',
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: color ?? '#FFFFFF',
          fontSize: 15,
          fontFamily: 'Inter_700Bold',
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

function PlatformPill({ platform, total }: { platform: string; total: number }) {
  return (
    <View
      style={{
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#262626',
        paddingVertical: 10,
        paddingHorizontal: 14,
        marginRight: 10,
        alignItems: 'center',
      }}
    >
      <Text
        style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 3 }}
      >
        {platform}
      </Text>
      <Text style={{ color: MINT, fontSize: 14, fontFamily: 'Inter_700Bold' }}>
        {formatCurrency(total)}
      </Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { income, expenses } = useAppStore();
  const router = useRouter();
  const { fetchIncome } = useIncome();
  const { fetchExpenses } = useExpenses();
  const {
    loading,
    isEmpty,
    currentMonthTotal,
    lastMonthTotal,
    allTimeTotal,
    percentChange,
    chartData,
    platformBreakdown,
    currentMonthExpenses,
    netProfit,
  } = useDashboard();

  useEffect(() => {
    if (income.length === 0) fetchIncome();
    if (expenses.length === 0) fetchExpenses();
  }, []);

  const screenWidth = Dimensions.get('window').width;
  const chartWidth = Math.min(screenWidth - 48, 600);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={MINT} size="large" />
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
        <Text style={{ color: MINT, fontSize: 40, marginBottom: 20, textAlign: 'center' }}>
          📊
        </Text>
        <Text
          style={{
            color: '#FFFFFF',
            fontSize: 18,
            fontFamily: 'Inter_700Bold',
            textAlign: 'center',
            marginBottom: 12,
          }}
        >
          Dashboard
        </Text>
        <Text
          style={{
            color: '#A3A3A3',
            fontSize: 15,
            fontFamily: 'Inter_400Regular',
            textAlign: 'center',
            lineHeight: 24,
          }}
        >
          No income tracked yet. Add your first entry on the Income tab to see your dashboard come to life.
        </Text>
      </View>
    );
  }

  const changePositive = percentChange !== null && percentChange >= 0;
  const changeText =
    percentChange !== null
      ? `${changePositive ? '▲' : '▼'} ${Math.abs(Math.round(percentChange))}% vs last month`
      : null;

  const netProfitColor = netProfit >= 0 ? MINT : RED;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#0A0A0A' }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <Text
        style={{ color: '#FFFFFF', fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 4 }}
      >
        Dashboard
      </Text>
      <Text
        style={{ color: '#A3A3A3', fontSize: 14, fontFamily: 'Inter_400Regular', marginBottom: 28 }}
      >
        {currentMonthLabel()}
      </Text>

      {/* ── Hero Revenue + Expenses Row ── */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
        {/* Revenue Card */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#1A1A1A',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#262626',
            padding: 20,
          }}
        >
          <Text
            style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}
          >
            Revenue
          </Text>
          <Text
            style={{ color: MINT, fontSize: 26, fontFamily: 'Inter_700Bold', marginBottom: 4 }}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatCurrency(currentMonthTotal)}
          </Text>
          {changeText && (
            <Text
              style={{
                color: changePositive ? MINT : RED,
                fontSize: 12,
                fontFamily: 'Inter_600SemiBold',
              }}
            >
              {changeText}
            </Text>
          )}
        </View>

        {/* Expenses Card */}
        <View
          style={{
            flex: 1,
            backgroundColor: '#1A1A1A',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#262626',
            padding: 20,
          }}
        >
          <Text
            style={{ color: '#A3A3A3', fontSize: 11, fontFamily: 'Inter_500Medium', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}
          >
            Expenses
          </Text>
          <Text
            style={{ color: EXPENSE_ACCENT, fontSize: 26, fontFamily: 'Inter_700Bold' }}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatCurrency(currentMonthExpenses)}
          </Text>
        </View>
      </View>

      {/* ── Net Profit Hero ── */}
      <View
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#262626',
          padding: 24,
          marginBottom: 16,
          alignItems: 'center',
        }}
      >
        <Text
          style={{ color: '#A3A3A3', fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}
        >
          Net Profit This Month
        </Text>
        <Text
          style={{ color: netProfitColor, fontSize: 42, fontFamily: 'Inter_700Bold' }}
          adjustsFontSizeToFit
          numberOfLines={1}
        >
          {formatCurrency(netProfit)}
        </Text>
        <Text
          style={{ color: '#A3A3A3', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 6 }}
        >
          {formatCurrency(currentMonthTotal)} revenue − {formatCurrency(currentMonthExpenses)} expenses
        </Text>
      </View>

      {/* ── Quick Stats Row ── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <StatCard label="This Month" value={formatCurrency(currentMonthTotal)} color={MINT} />
        <StatCard label="Expenses" value={formatCurrency(currentMonthExpenses)} color={EXPENSE_ACCENT} />
        <StatCard label="Last Month" value={formatCurrency(lastMonthTotal)} />
        <StatCard label="All Time" value={formatCurrency(allTimeTotal)} />
      </View>

      {/* ── Revenue Chart ── */}
      <View
        style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 16,
          borderWidth: 1,
          borderColor: '#262626',
          paddingTop: 20,
          paddingBottom: 8,
          marginBottom: 16,
          overflow: 'hidden',
        }}
      >
        <Text
          style={{
            color: '#A3A3A3',
            fontSize: 12,
            fontFamily: 'Inter_500Medium',
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginLeft: 20,
            marginBottom: 12,
          }}
        >
          Revenue Over Time
        </Text>
        <RevenueChart chartData={chartData} width={chartWidth} />
      </View>

      {/* ── Platform Breakdown ── */}
      {platformBreakdown.length > 0 && (
        <View
          style={{
            backgroundColor: '#1A1A1A',
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#262626',
            padding: 20,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: '#A3A3A3',
              fontSize: 12,
              fontFamily: 'Inter_500Medium',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              marginBottom: 14,
            }}
          >
            Platform Breakdown
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 8 }}
          >
            {platformBreakdown.map((p) => (
              <PlatformPill key={p.platform} platform={p.platform} total={p.total} />
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Export Report ── */}
      <TouchableOpacity
        onPress={() => router.push('/reports')}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          backgroundColor: '#1A1A1A',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#262626',
          paddingVertical: 14,
          marginTop: 4,
        }}
      >
        <Text style={{ fontSize: 16 }}>📄</Text>
        <Text
          style={{
            color: '#34D399',
            fontSize: 14,
            fontFamily: 'Inter_600SemiBold',
          }}
        >
          Export Report
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
