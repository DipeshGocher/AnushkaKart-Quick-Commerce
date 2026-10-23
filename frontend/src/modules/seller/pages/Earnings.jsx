import React from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Button from "@shared/components/ui/Button";
import {
  TrendingUp,
  BarChart3,
  DollarSign,
  Download,
  Banknote,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { BlurFade } from "@/components/ui/blur-fade";
import ShimmerButton from "@/components/ui/shimmer-button";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { exportToCSV } from "@/lib/exportUtils";
import { useSellerEarnings } from "../context/SellerEarningsContext";
import { cn } from "@/lib/utils";

const formatCurrency = (val) => {
  const n = Number(val || 0);
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const Earnings = () => {
  const navigate = useNavigate();
  const { earningsData: data, earningsLoading: loading } = useSellerEarnings();
  const [tableFilter, setTableFilter] = React.useState("all");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen font-black text-slate-600">
        LOADING EARNINGS...
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <BlurFade delay={0.1}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900 hidden md:block">
              Earnings Overview
            </h2>
            <p className="text-xs text-gray-500 font-medium hidden md:block mt-0.5">
              Real-time revenue, in-transit payouts and withdrawal balance
            </p>
          </div>
          <div className="flex space-x-3">
            <Button
              onClick={() => {
                const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
                if (ledger.length === 0) {
                  toast.info("No transactions to export.");
                  return;
                }
                const exportData = ledger.map((txn) => ({
                  id: txn.id ?? txn.ref ?? "",
                  type: txn.type ?? "",
                  amount: `₹${Number(txn.amount ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                  status: txn.status ?? "",
                  date: formatDate(txn.date || txn.createdAt),
                  customer: txn.customer ?? "",
                  ref: txn.ref ?? "",
                }));
                exportToCSV(exportData, "Seller_Earnings_Report", {
                  id: "Transaction ID",
                  type: "Type",
                  amount: "Amount",
                  status: "Status",
                  date: "Date",
                  customer: "Customer",
                  ref: "Reference",
                });
                toast.success("Earnings report downloaded successfully!");
              }}
              variant="outline"
              className="border-gray-200">
              <Download className="mr-2 h-4 w-4" />
              Download Report
            </Button>
            <ShimmerButton
              onClick={() => navigate("/seller/withdrawals")}
              className="px-6 py-2 rounded-xl text-sm font-bold text-white shadow-lg">
              <span className="text-white">Withdraw Funds</span>
            </ShimmerButton>
          </div>
        </div>
      </BlurFade>

      {/* Financial Metric Cards (3 Columns) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Total Delivered Revenue */}
        <BlurFade delay={0.2}>
          <Card className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-teal-800 text-white border-none shadow-lg h-full p-6 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-indigo-100 font-semibold text-xs uppercase tracking-wider">
                  Total Delivered Revenue
                </p>
                <h3 className="text-3xl font-black mt-2 tracking-tight">
                  ₹{formatCurrency(data?.balances?.totalRevenue)}
                </h3>
              </div>
              <div className="p-3 bg-white/15 rounded-xl">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
            </div>
            <div className="mt-6 flex items-center text-emerald-200 bg-white/10 w-fit px-3 py-1 rounded-full text-xs font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-300" />
              <span>Settled from completed orders</span>
            </div>
          </Card>
        </BlurFade>

        {/* Card 2: Pending Orders (T+2) */}
        <BlurFade delay={0.25}>
          <Card className="h-full border-none shadow-md bg-white p-6 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-black text-amber-700 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  Pending Orders (T+2)
                </p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  ₹{formatCurrency(data?.balances?.pendingOrdersPayout)}
                </h2>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <TrendingUp className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <div className="mt-6 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">In-transit awaiting delivery</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                Settles on Delivery
              </span>
            </div>
          </Card>
        </BlurFade>

        {/* Card 3: Total Withdrawn & Available Balance */}
        <BlurFade delay={0.3}>
          <Card className="h-full border-none shadow-md bg-white p-6 flex flex-col justify-between group hover:shadow-xl transition-all duration-300">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">
                  Total Withdrawn
                </p>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  ₹{formatCurrency(data?.balances?.totalWithdrawn)}
                </h2>
              </div>
              <div className="p-3 bg-brand-50 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Banknote className="h-6 w-6 text-brand-500" />
              </div>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs">
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">
                    Available to Withdraw
                  </p>
                  <p className="text-xs font-black text-slate-900">
                    ₹{formatCurrency(data?.balances?.settledBalance)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/seller/withdrawals")}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 underline underline-offset-2">
                Payouts &rarr;
              </button>
            </div>
          </Card>
        </BlurFade>
      </div>

      {/* Monthly Revenue Performance Chart */}
      <BlurFade delay={0.4}>
        <Card className="p-6 border-none shadow-md bg-white">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-brand-500" />
                Monthly Revenue Performance
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Delivered order payouts aggregated over the past 6 months
              </p>
            </div>
          </div>
          <div className="h-[300px] w-full min-h-[200px] flex items-center justify-center">
            {(Array.isArray(data?.monthlyChart) ? data.monthlyChart : []).length === 0 ? (
              <p className="text-slate-500 text-sm font-medium">No monthly revenue data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyChart}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#f1f5f9"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 700 }}
                    tickFormatter={(value) => `₹${Number(value).toLocaleString("en-IN")}`}
                  />
                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: "12px",
                      border: "none",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                      fontSize: "12px",
                      fontWeight: "700",
                    }}
                    formatter={(value) => [
                      `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      "Delivered Revenue",
                    ]}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="url(#colorRevenue)"
                    radius={[6, 6, 0, 0]}
                    barSize={40}
                  />
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={1} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={1} />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </BlurFade>

      {/* Recent Per-Order Earnings Table */}
      <BlurFade delay={0.5}>
        <Card className="p-6 border-none shadow-md bg-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Banknote className="h-5 w-5 text-brand-500" />
                Recent Per-Order Earnings
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Breakdown of individual order settlements and cancelled orders
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTableFilter("all")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    tableFilter === "all"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}>
                  All Recent
                </button>
                <button
                  type="button"
                  onClick={() => setTableFilter("settled")}
                  className={cn(
                    "px-3 py-1 text-xs font-bold rounded-lg transition-all",
                    tableFilter === "settled"
                      ? "bg-emerald-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  )}>
                  Settled Only
                </button>
              </div>
              <Button
                variant="ghost"
                onClick={() => navigate("/seller/transactions")}
                className="text-xs font-bold text-brand-600 hover:text-brand-700">
                View All &rarr;
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Earning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(Array.isArray(data?.ledger) ? data.ledger : [])
                  .filter((txn) => txn.type === "Order Payment" || (txn.amount !== 0 && txn.type !== "Withdrawal"))
                  .filter((txn) => {
                    if (tableFilter === "settled") return txn.status === "Settled";
                    return true;
                  })
                  .slice(0, 10)
                  .map((txn, i) => {
                    const isCancelled = txn.status === "Cancelled";
                    const isSettled = txn.status === "Settled";

                    return (
                      <tr
                        key={txn.id || i}
                        className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 text-sm font-bold text-slate-900">
                          {txn.ref || txn.id || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-500">
                          {formatDate(txn.date || txn.createdAt)}
                        </td>
                        <td className="py-3 px-4">
                          {isSettled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Settled
                            </span>
                          ) : isCancelled ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-slate-100 text-slate-500 border border-slate-200">
                              Cancelled
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Pending (T+2)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isCancelled ? (
                            <div>
                              <span className="text-slate-400 line-through text-xs font-semibold mr-1.5">
                                ₹{formatCurrency(txn.amount)}
                              </span>
                              <span className="text-xs font-bold text-slate-500">₹0.00</span>
                              <p className="text-[10px] text-slate-400 font-medium">Order Cancelled</p>
                            </div>
                          ) : isSettled ? (
                            <div>
                              <span className="text-sm font-black text-emerald-700">
                                +₹{formatCurrency(txn.amount)}
                              </span>
                              <p className="text-[10px] text-emerald-600 font-medium">Settled to balance</p>
                            </div>
                          ) : (
                            <div>
                              <span className="text-sm font-bold text-amber-700">
                                +₹{formatCurrency(txn.amount)}
                              </span>
                              <p className="text-[10px] text-amber-600 font-medium">Payout on delivery</p>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {(Array.isArray(data?.ledger) ? data.ledger : []).filter(
                  (txn) => txn.type === "Order Payment" || (txn.amount !== 0 && txn.type !== "Withdrawal")
                ).length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-8 text-center text-sm font-medium text-slate-500">
                      No order earnings found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </BlurFade>
    </div>
  );
};

export default Earnings;

