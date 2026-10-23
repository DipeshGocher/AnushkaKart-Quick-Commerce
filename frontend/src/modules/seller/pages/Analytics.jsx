import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import {
  HiOutlineChartBar,
  HiOutlineArrowTrendingUp,
  HiOutlineUsers,
  HiOutlineShoppingBag,
  HiOutlineArrowUpRight,
  HiOutlineArrowDownRight,
  HiOutlineCalendarDays,
  HiOutlineArrowDownTray,
  HiOutlineMapPin,
  HiOutlineClock,
  HiOutlineDevicePhoneMobile,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineCreditCard,
  HiOutlineExclamationTriangle,
} from "react-icons/hi2";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import ShimmerButton from "@/components/ui/shimmer-button";
import Modal from "@shared/components/ui/Modal";
import { sellerApi } from "../services/sellerApi";
import { toast } from "sonner";

const TIME_RANGE_OPTIONS = [
  { label: "All Time (Lifetime)", value: "all" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 7 Days", value: "7d" },
  { label: "This Month", value: "this_month" },
  { label: "Today", value: "today" },
];

const Analytics = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [timeRange, setTimeRange] = useState("all");
  const [activeTab, setActiveTab] = useState("Overview");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [chartRange, setChartRange] = useState("Daily");
  const hasFetchedOnce = useRef(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      const isInitialLoad = !hasFetchedOnce.current;
      if (isInitialLoad) {
        setLoading(true);
      }
      try {
        const response = await sellerApi.getStats({
          range: chartRange.toLowerCase(),
          timeRange,
        });
        const raw = response?.data?.result ?? response?.data?.data ?? null;
        if (response?.data?.success && raw && typeof raw === "object") {
          setStatsData({
            overview: raw.overview ?? {},
            salesTrend: Array.isArray(raw.salesTrend) ? raw.salesTrend : [],
            categoryMix: Array.isArray(raw.categoryMix) ? raw.categoryMix : [],
            topProducts: Array.isArray(raw.topProducts) ? raw.topProducts : [],
            trafficSources: Array.isArray(raw.trafficSources) ? raw.trafficSources : [],
            financials: raw.financials ?? {},
            customerInsights: raw.customerInsights ?? {},
            insights: raw.insights ?? {},
          });
        } else if (response?.data?.success && raw) {
          setStatsData(raw);
        }
      } catch (error) {
        console.error("Analytics Fetch Error:", error);
        toast.error("Failed to load analytics data");
        setStatsData((prev) => prev ?? {
          overview: {},
          salesTrend: [],
          categoryMix: [],
          topProducts: [],
          trafficSources: [],
          financials: {},
          customerInsights: {},
          insights: {},
        });
      } finally {
        if (isInitialLoad) {
          hasFetchedOnce.current = true;
        }
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [chartRange, timeRange]);

  const overview = statsData?.overview ?? {};
  const deliveredCount = overview.deliveredOrders ?? 0;
  const activeCount = overview.activeOrders ?? 0;
  const cancelledCount = overview.cancelledOrders ?? 0;
  const totalCount = overview.totalOrdersRaw ?? overview.totalOrders ?? 0;

  const stats = [
    {
      label: "Net Revenue",
      value: overview.totalSales || "₹0",
      subtext: `From ${deliveredCount} Delivered Orders`,
      trend: overview.salesTrend || "0%",
      icon: HiOutlineArrowTrendingUp,
      color: "text-brand-600",
      bg: "bg-brand-50",
    },
    {
      label: "Total Orders",
      value: overview.totalOrders || "0",
      subtext: `${deliveredCount} Delivered • ${activeCount} Active • ${cancelledCount} Cancelled`,
      trend: overview.ordersTrend || "0%",
      icon: HiOutlineShoppingBag,
      color: "text-brand-600",
      bg: "bg-brand-50",
    },
    {
      label: "Avg Order Value",
      value: overview.avgOrderValue || "₹0",
      subtext: "Avg. per delivered order",
      trend: null,
      icon: HiOutlineUsers,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Fulfillment Rate",
      value: overview.fulfillmentRate || "0%",
      subtext: `${deliveredCount} of ${totalCount} completed`,
      trend: `Cancel: ${overview.cancellationRate || "0%"}`,
      icon: HiOutlineCheckCircle,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
  ];

  const salesTrendArr = statsData?.salesTrend ?? [];
  const hasNoData = !Number(overview.totalOrders) && (!salesTrendArr.length || salesTrendArr.every((d) => !d.sales));

  const handleDownloadReport = () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const escapeCsv = (v) => {
        const s = String(v ?? "").replace(/"/g, '""');
        return /[",\n\r]/.test(s) ? `"${s}"` : s;
      };
      const lines = [];
      lines.push("AnushkaKart - Seller Analytics & Sales Report");
      lines.push(`Generated On,${new Date().toLocaleString()}`);
      lines.push(`Time Range Selected,${timeRange.toUpperCase()}`);
      lines.push("");

      lines.push("1. Overview & Key Performance Indicators");
      lines.push("Metric,Value,Details");
      lines.push(`Net Revenue,${escapeCsv(overview.totalSales || "₹0")},${escapeCsv(`From ${deliveredCount} Delivered Orders`)}`);
      lines.push(`Total Orders,${escapeCsv(overview.totalOrders || "0")},${escapeCsv(`${deliveredCount} Delivered / ${cancelledCount} Cancelled`)}`);
      lines.push(`Avg Order Value (AOV),${escapeCsv(overview.avgOrderValue || "₹0")},Per Delivered Order`);
      lines.push(`Fulfillment Rate,${escapeCsv(overview.fulfillmentRate || "0%")},Completed Orders Ratio`);
      lines.push(`Cancellation Rate,${escapeCsv(overview.cancellationRate || "0%")},Cancelled Orders Ratio`);
      lines.push("");

      const fin = statsData?.financials ?? {};
      lines.push("2. Financial & Payment Mode Breakdown");
      lines.push("Category,Amount,Orders");
      lines.push(`Gross Order Value,₹${(fin.grossSales || 0).toLocaleString()},—`);
      lines.push(`Net Seller Payout,₹${(fin.netPayout || 0).toLocaleString()},${deliveredCount}`);
      lines.push(`Cash on Delivery (COD),₹${(fin.codAmount || 0).toLocaleString()},${fin.codOrders || 0}`);
      lines.push(`Prepaid / Online UPI,₹${(fin.onlineAmount || 0).toLocaleString()},${fin.onlineOrders || 0}`);
      lines.push("");

      const trend = statsData?.salesTrend ?? [];
      if (trend.length) {
        lines.push("3. Sales & Revenue Trend");
        lines.push("Time Period,Sales (₹),Orders Count");
        trend.forEach((d) => {
          lines.push(`${escapeCsv(d.name)},${escapeCsv(d.sales)},${escapeCsv(d.orders || 0)}`);
        });
        lines.push("");
      }

      const top = statsData?.topProducts ?? [];
      if (top.length) {
        lines.push("4. Top Selling Products");
        lines.push("Rank,Product Name,Units Sold,Revenue Generated,Current Stock");
        top.forEach((p, idx) => {
          lines.push(`${idx + 1},${escapeCsv(p.name)},${escapeCsv(p.sales)},${escapeCsv(p.revenue)},${escapeCsv(p.stock ?? "N/A")}`);
        });
        lines.push("");
      }

      const cat = statsData?.categoryMix ?? [];
      if (cat.length) {
        lines.push("5. Category Performance Mix");
        lines.push("Category Name,Revenue / Volume,Share %");
        cat.forEach((c) => {
          lines.push(`${escapeCsv(c.subject || c.name)},${escapeCsv(c.revenue || c.A)},${escapeCsv(c.percentage ? `${c.percentage}%` : "—")}`);
        });
        lines.push("");
      }

      const cust = statsData?.customerInsights ?? {};
      lines.push("6. Customer Insights");
      lines.push("Metric,Value");
      lines.push(`Unique Buyers,${cust.uniqueCustomers || 0}`);
      lines.push(`Repeat Buyers,${cust.repeatCustomers || 0}`);
      lines.push(`Repeat Customer Rate,${cust.repeatRate || "0%"}`);
      lines.push(`Top Delivery City,${cust.topCity || "N/A"}`);
      lines.push(`Peak Order Hours,${cust.peakTime || "N/A"}`);

      const csvContent = lines.join("\n");
      const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sales-report-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Sales report downloaded successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to download report");
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-black text-slate-600 text-sm tracking-wider uppercase">Loading Analytics Data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 pb-20 sm:pb-16">
      <BlurFade delay={0.05}>
        {/* Header with Title and Global Time Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 flex flex-wrap items-center gap-2">
              Advanced Analytics & Reports
              <Badge
                variant="success"
                className="text-[10px] px-2 py-0.5 font-bold tracking-wider uppercase bg-emerald-100 text-emerald-800 border-none">
                Live Data
              </Badge>
            </h1>
            <p className="text-slate-600 text-sm sm:text-base mt-0.5 font-medium">
              Transparent breakdown of your orders, payouts, revenue trends, and customer insights.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Dynamic Time Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
              <HiOutlineCalendarDays className="h-4 w-4 text-primary shrink-0" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent text-xs sm:text-sm font-bold text-slate-800 outline-none cursor-pointer pr-1">
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Download Report Button */}
            <ShimmerButton
              onClick={handleDownloadReport}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white shadow-md disabled:opacity-50 shrink-0"
              disabled={isExporting}>
              <HiOutlineArrowDownTray className="h-4 w-4 shrink-0" />
              <span>{isExporting ? "EXPORTING..." : "DOWNLOAD REPORT"}</span>
            </ShimmerButton>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full sm:w-fit mt-4">
          {["Overview", "Sales", "Customers"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-5 py-2 rounded-lg text-xs sm:text-sm font-black transition-all shrink-0",
                activeTab === tab
                  ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                  : "text-slate-600 hover:text-slate-800",
              )}>
              {tab === "Sales" ? "Sales & Payouts" : tab === "Customers" ? "Customers & Localities" : tab}
            </button>
          ))}
        </div>
      </BlurFade>

      {/* 4 Core KPI Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, i) => (
          <BlurFade key={stat.label} delay={0.1 + i * 0.05}>
            <MagicCard
              className="border-none shadow-md overflow-hidden group bg-white p-0 rounded-2xl"
              gradientColor="#f8fafc">
              <div className="p-5 relative z-10 flex items-start justify-between">
                <div className="space-y-1.5 flex-1 pr-2">
                  <p className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <h4 className="text-2xl font-black text-slate-900 tracking-tight">
                    {stat.value}
                  </h4>
                  <p className="text-[11px] font-bold text-slate-500">
                    {stat.subtext}
                  </p>
                  {stat.trend && (
                    <div
                      className={cn(
                        "flex items-center mt-2 text-[10px] font-black px-2 py-0.5 rounded-full w-fit",
                        stat.trend.startsWith("+")
                          ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
                          : stat.trend.startsWith("-")
                            ? "text-rose-700 bg-rose-50 border border-rose-100"
                            : "text-slate-600 bg-slate-100",
                      )}>
                      {stat.trend.startsWith("+") && <HiOutlineArrowUpRight className="mr-0.5 h-3 w-3" />}
                      {stat.trend.startsWith("-") && <HiOutlineArrowDownRight className="mr-0.5 h-3 w-3" />}
                      {stat.trend}
                      <span className="text-slate-500 ml-1 font-semibold">vs prev period</span>
                    </div>
                  )}
                </div>
                <div
                  className={cn(
                    "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner",
                    stat.bg,
                    stat.color,
                  )}>
                  <stat.icon className="h-6 w-6 transition-transform group-hover:scale-110 duration-300" />
                </div>
              </div>
            </MagicCard>
          </BlurFade>
        ))}
      </div>

      {/* SALES TAB SPECIFIC: Financial Settlement Split Cards */}
      {activeTab === "Sales" && (
        <BlurFade delay={0.25}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="border border-slate-200 shadow-sm rounded-2xl p-5 bg-white flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <HiOutlineBanknotes className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Gross Order Value</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  ₹{(statsData?.financials?.grossSales || 0).toLocaleString()}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">Total customer checkout value</p>
              </div>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl p-5 bg-white flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <HiOutlineCreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Prepaid / Online UPI</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  ₹{(statsData?.financials?.onlineAmount || 0).toLocaleString()}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {statsData?.financials?.onlineOrders || 0} online paid orders
                </p>
              </div>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl p-5 bg-white flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <HiOutlineBanknotes className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Cash on Delivery (COD)</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  ₹{(statsData?.financials?.codAmount || 0).toLocaleString()}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {statsData?.financials?.codOrders || 0} cash orders collected
                </p>
              </div>
            </Card>
          </div>
        </BlurFade>
      )}

      {/* CUSTOMERS TAB SPECIFIC: Customer Intelligence Cards */}
      {activeTab === "Customers" && (
        <BlurFade delay={0.25}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <Card className="border border-slate-200 shadow-sm rounded-2xl p-5 bg-white flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                <HiOutlineUsers className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Unique Buyers</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  {statsData?.customerInsights?.uniqueCustomers || 0} Customers
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">Distinct buyers placed orders</p>
              </div>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl p-5 bg-white flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <HiOutlineArrowTrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Repeat Customer Rate</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  {statsData?.customerInsights?.repeatRate || "0%"}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  {statsData?.customerInsights?.repeatCustomers || 0} customers with multiple orders
                </p>
              </div>
            </Card>

            <Card className="border border-slate-200 shadow-sm rounded-2xl p-5 bg-white flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <HiOutlineMapPin className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase">Top Delivery Location</p>
                <h4 className="text-xl font-black text-slate-900 mt-0.5">
                  {statsData?.customerInsights?.topCity || "N/A"}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">Primary order destination</p>
              </div>
            </Card>
          </div>
        </BlurFade>
      )}

      {/* Main Charts Grid: Revenue & Trends + Category Mix */}
      {(activeTab === "Overview" || activeTab === "Sales") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue & Trends Chart */}
          <BlurFade delay={0.3} className="lg:col-span-2">
            <Card className="border border-slate-200 shadow-md rounded-2xl p-6 bg-white overflow-hidden h-full flex flex-col justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    Revenue & Sales Trends
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    {timeRange === "all" ? "Lifetime Sales Timeline" : `Sales Trend for ${timeRange.toUpperCase()}`}
                  </p>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit">
                  {["Daily", "Weekly", "Monthly"].map((range) => (
                    <button
                      key={range}
                      onClick={() => setChartRange(range)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                        chartRange === range
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600 hover:text-slate-800",
                      )}>
                      {range}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-[360px] w-full mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={salesTrendArr}
                    margin={{ top: 10, right: 15, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748b", fontSize: 11, fontWeight: 700 }}
                      tickFormatter={(value) => `₹${Number(value).toLocaleString()}`}
                      domain={[0, (dataMax) => (dataMax > 0 ? Math.ceil(dataMax * 1.2) : 500)]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1e293b",
                        color: "#fff",
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.2)",
                        fontSize: "12px",
                        fontWeight: 700,
                      }}
                      itemStyle={{ color: "#fff" }}
                      formatter={(value, name) => [
                        name === "sales" ? `₹${Number(value).toLocaleString()}` : value,
                        name === "sales" ? "Payout Revenue" : name === "orders" ? "Orders Count" : name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#2563eb"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSales)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-semibold">
                <span>Showing net delivered order payouts</span>
                <span>Currency: INR (₹)</span>
              </div>
            </Card>
          </BlurFade>

          {/* Category Performance Mix */}
          <BlurFade delay={0.35} className="lg:col-span-1">
            <Card className="border border-slate-200 shadow-md rounded-2xl p-6 bg-white flex flex-col justify-between h-full">
              <div>
                <div className="text-left mb-4">
                  <h3 className="text-lg font-black text-slate-900">
                    Category Mix
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    Product Distribution & Sales
                  </p>
                </div>

                <div className="h-[280px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="75%" data={statsData?.categoryMix || []}>
                      <PolarGrid stroke="#e2e8f0" />
                      <PolarAngleAxis
                        dataKey="subject"
                        tick={{ fill: "#475569", fontSize: 10, fontWeight: 700 }}
                      />
                      <PolarRadiusAxis angle={30} domain={[0, "auto"]} tick={false} axisLine={false} />
                      <Radar
                        name="Volume"
                        dataKey="A"
                        stroke="#10b981"
                        strokeWidth={2.5}
                        fill="#10b981"
                        fillOpacity={0.2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Top Categories Badges */}
              <div className="grid grid-cols-2 gap-2 w-full mt-3 pt-3 border-t border-slate-100">
                {(statsData?.categoryMix || []).slice(0, 4).map((cat, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-50 p-2.5 rounded-xl flex items-center justify-between border border-slate-100">
                    <span className="text-[11px] font-bold text-slate-700 truncate max-w-[100px]">
                      {cat.subject}
                    </span>
                    <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md">
                      {cat.A}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </BlurFade>
        </div>
      )}

      {/* Top Products & Customer Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Performing Products */}
        {(activeTab === "Overview" || activeTab === "Sales") && (
          <BlurFade delay={0.4}>
            <Card className="border border-slate-200 shadow-md rounded-2xl p-0 overflow-hidden bg-white h-full flex flex-col justify-between">
              <div>
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">
                      Top Performing Products
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Bestsellers ranked by sales volume & total revenue.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs font-bold text-slate-600">
                    {(statsData?.topProducts || []).length} Products
                  </Badge>
                </div>

                <div className="divide-y divide-slate-100">
                  {(statsData?.topProducts || []).length === 0 ? (
                    <div className="p-8 text-center text-slate-400 font-semibold text-xs">
                      No product sales recorded in the selected period.
                    </div>
                  ) : (
                    (statsData?.topProducts || []).map((product, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setSelectedProduct(product);
                          setIsProductModalOpen(true);
                        }}
                        className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-black text-xs shrink-0 group-hover:bg-primary group-hover:text-white transition-all overflow-hidden">
                            {product.image ? (
                              <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                            ) : (
                              i + 1
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">
                              {product.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500 font-semibold">
                                {product.sales} units sold
                              </span>
                              {product.isLowStock && (
                                <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                                  Low Stock
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">
                            {product.revenue}
                          </p>
                          <span className="text-[10px] font-bold text-emerald-600 flex items-center justify-end">
                            <HiOutlineArrowUpRight className="h-3 w-3 mr-0.5" />
                            {product.trend}%
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-100 text-center">
                <button
                  onClick={() => navigate("/seller/products")}
                  className="text-xs font-black text-primary uppercase tracking-wider hover:underline">
                  Manage Product Inventory →
                </button>
              </div>
            </Card>
          </BlurFade>
        )}

        {/* Traffic Sources & Origin Insights */}
        {(activeTab === "Overview" || activeTab === "Customers") && (
          <BlurFade delay={0.45}>
            <Card className="border border-slate-200 shadow-md rounded-2xl p-6 bg-white overflow-hidden h-full flex flex-col justify-between">
              <div>
                <div className="mb-4">
                  <h3 className="text-lg font-black text-slate-900">
                    Customer Channels & Geography
                  </h3>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    Order Sources & Origin Analysis
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6 my-2">
                  <div className="h-[200px] w-full sm:w-1/2">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statsData?.trafficSources || []}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={6}
                          dataKey="value">
                          {(statsData?.trafficSources || []).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="w-full sm:w-1/2 space-y-3">
                    {(statsData?.trafficSources || []).map((source, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: source.color }}
                          />
                          <span className="font-bold text-slate-700">{source.name}</span>
                        </div>
                        <span className="font-black text-slate-900">
                          {((source.value / (statsData?.trafficSources?.reduce((a, b) => a + b.value, 0) || 1)) * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Geographic & Device Summary */}
              <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-5 text-center">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="h-8 w-8 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                    <HiOutlineMapPin className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {statsData?.insights?.topCity || "N/A"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Top City</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="h-8 w-8 bg-brand-50 text-brand-600 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                    <HiOutlineClock className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {statsData?.insights?.peakTime || "N/A"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Peak Time</p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="h-8 w-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center mx-auto mb-1.5">
                    <HiOutlineDevicePhoneMobile className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-black text-slate-900 truncate">
                    {statsData?.insights?.topDevice || "Mobile"}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Device</p>
                </div>
              </div>
            </Card>
          </BlurFade>
        )}
      </div>

      {/* Product Detail Modal */}
      <Modal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        title="Product Performance Insights">
        {selectedProduct && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="h-16 w-16 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-slate-600 shrink-0 overflow-hidden">
                {selectedProduct.image ? (
                  <img src={selectedProduct.image} alt={selectedProduct.name} className="h-full w-full object-cover" />
                ) : (
                  <HiOutlineShoppingBag className="h-8 w-8" />
                )}
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-base">
                  {selectedProduct.name}
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  Stock on hand: {selectedProduct.stock ?? "N/A"} units
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">
                  Total Revenue
                </p>
                <p className="text-xl font-black text-emerald-950 mt-1">
                  {selectedProduct.revenue}
                </p>
              </div>
              <div className="p-4 bg-brand-50 rounded-2xl border border-brand-100">
                <p className="text-[10px] font-black text-brand-700 uppercase tracking-wider">
                  Units Sold
                </p>
                <p className="text-xl font-black text-brand-950 mt-1">
                  {selectedProduct.sales} units
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-700 uppercase tracking-wider">Sales Velocity</span>
                <span className="text-emerald-700">+{selectedProduct.trend}% active</span>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[80%]" />
              </div>
            </div>

            <Button
              onClick={() => setIsProductModalOpen(false)}
              className="w-full py-3.5 rounded-xl font-black shadow-lg shadow-primary/20">
              CLOSE DETAILS
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Analytics;
