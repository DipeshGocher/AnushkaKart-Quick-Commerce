import React, { useState, useMemo, useCallback } from "react";
import Card from "@shared/components/ui/Card";
import Badge from "@shared/components/ui/Badge";
import Input from "@shared/components/ui/Input";
import Button from "@shared/components/ui/Button";
import Modal from "@shared/components/ui/Modal";
import {
  HiOutlineCreditCard,
  HiOutlineArrowDownTray,
  HiOutlineFunnel,
  HiOutlineMagnifyingGlass,
  HiOutlineDocumentText,
  HiOutlineBanknotes,
  HiOutlineClock,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineArrowUpRight,
  HiOutlineArrowDownLeft,
  HiOutlineCalendarDays,
} from "react-icons/hi2";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { MagicCard } from "@/components/ui/magic-card";
import { toast } from "sonner";
import { exportToCSV } from "@/lib/exportUtils";
import { useSellerEarnings } from "../context/SellerEarningsContext";
import Pagination from "@shared/components/ui/Pagination";

const formatINR = (val) => {
  const num = Number(val ?? 0);
  return num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const TransactionTableRow = React.memo(({ txn, onSelect, onDownloadReceipt }) => {
  const isCancelled = txn.status === "Cancelled" || txn.status === "Failed";
  const isWithdrawal = txn.type === "Withdrawal";
  const isSettled = txn.status === "Settled";
  const isPending = txn.status === "Pending" || txn.status === "Processing";

  let iconBg = "bg-emerald-50 text-emerald-600";
  let icon = <HiOutlineArrowDownLeft className="h-5 w-5" />;
  let amountColor = "text-emerald-600 font-black";
  let amountPrefix = "+";
  let settlementSubtext = "Settled";
  let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let badgeIcon = <HiOutlineCheckCircle className="mr-1 h-3 w-3 text-emerald-600" />;
  let badgeText = "Settled";

  if (isCancelled) {
    iconBg = "bg-slate-100 text-slate-400";
    icon = <HiOutlineXCircle className="h-5 w-5" />;
    amountColor = "text-slate-400 line-through font-semibold";
    amountPrefix = "";
    settlementSubtext = "Order Cancelled";
    badgeClass = "bg-slate-100 text-slate-600 border-slate-200";
    badgeIcon = <HiOutlineXCircle className="mr-1 h-3 w-3 text-slate-500" />;
    badgeText = "Cancelled";
  } else if (isWithdrawal) {
    iconBg = "bg-rose-50 text-rose-600";
    icon = <HiOutlineArrowUpRight className="h-5 w-5" />;
    amountColor = "text-rose-600 font-black";
    amountPrefix = "-";
    settlementSubtext = isSettled ? "Payout to Bank" : "Awaiting Approval";
    badgeClass = isSettled
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : "bg-amber-50 text-amber-700 border-amber-200";
    badgeIcon = isSettled
      ? <HiOutlineCheckCircle className="mr-1 h-3 w-3 text-emerald-600" />
      : <HiOutlineClock className="mr-1 h-3 w-3 text-amber-600" />;
    badgeText = isSettled ? "Settled" : "Pending";
  } else if (isPending) {
    iconBg = "bg-amber-50 text-amber-600";
    icon = <HiOutlineClock className="h-5 w-5" />;
    amountColor = "text-amber-600 font-black";
    amountPrefix = "+";
    settlementSubtext = "Settlement: T+2";
    badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
    badgeIcon = <HiOutlineClock className="mr-1 h-3 w-3 text-amber-600" />;
    badgeText = "Pending";
  }

  return (
    <tr
      onClick={() => onSelect(txn)}
      className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
    >
      <td className="px-6 py-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center font-black transition-all group-hover:scale-110 shrink-0",
              iconBg,
            )}>
            {icon}
          </div>
          <div>
            <p className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">
              {txn.type ?? "Order Payment"}
            </p>
            <p className="text-[10px] font-semibold text-slate-500 tracking-tight mt-0.5">
              {txn.date ?? "—"} • {txn.time ?? "—"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-6 py-5">
        <p className="text-xs font-bold text-slate-900">
          {txn.customer ?? "—"}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge className="text-[10px] sm:text-xs px-1.5 py-0.5 bg-slate-100 text-slate-700 font-bold border border-slate-200">
            {txn.ref ?? txn.id ?? "—"}
          </Badge>
        </div>
      </td>
      <td className="px-6 py-5">
        <p className={cn("text-sm tracking-tight", amountColor)}>
          {amountPrefix}₹{formatINR(Math.abs(Number(txn.amount ?? 0)))}
        </p>
        <p
          className={cn(
            "text-[10px] sm:text-xs font-bold mt-0.5",
            isCancelled ? "text-slate-400" : isWithdrawal ? "text-slate-500 font-medium" : isSettled ? "text-emerald-700" : "text-amber-700",
          )}>
          {settlementSubtext}
        </p>
      </td>
      <td className="px-6 py-5">
        <span
          className={cn(
            "inline-flex items-center text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border",
            badgeClass,
          )}>
          {badgeIcon}
          {badgeText}
        </span>
      </td>
      <td className="px-6 py-5 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDownloadReceipt(txn);
          }}
          title="Download Receipt"
          className="h-9 w-9 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all ml-auto">
          <HiOutlineArrowDownTray className="h-5 w-5" />
        </button>
      </td>
    </tr>
  );
});

const Transactions = () => {
  const { earningsData: data, earningsLoading: loading } = useSellerEarnings();
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const stats = [
    {
      label: "Settled Balance",
      value: `₹${formatINR(data?.balances?.settledBalance || 0)}`,
      sub: "Net available payout balance",
      icon: HiOutlineBanknotes,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
    },
    {
      label: "Pending Orders (T+2)",
      value: `₹${formatINR(data?.balances?.pendingOrdersPayout ?? data?.balances?.pendingPayouts ?? 0)}`,
      sub: "Active in-transit settlements",
      icon: HiOutlineClock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Total Delivered Revenue",
      value: `₹${formatINR(data?.balances?.totalRevenue || 0)}`,
      sub: "Gross revenue of delivered orders",
      icon: HiOutlineCreditCard,
      color: "text-brand-600",
      bg: "bg-brand-50",
    },
  ];

  const ledger = Array.isArray(data?.ledger) ? data.ledger : [];
  const filteredTransactions = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const result = ledger.filter((txn) => {
      const id = (txn.id ?? txn.ref ?? "").toString().toLowerCase();
      const customer = (txn.customer ?? "").toString().toLowerCase();
      const ref = (txn.ref ?? "").toString().toLowerCase();
      const status = (txn.status ?? "").toString().toLowerCase();
      const type = (txn.type ?? "").toString().toLowerCase();
      const amount = Math.abs(Number(txn.amount ?? 0)).toString();
      const matchesSearch =
        !term ||
        id.includes(term) ||
        customer.includes(term) ||
        ref.includes(term) ||
        status.includes(term) ||
        type.includes(term) ||
        amount.includes(term);

      let matchesType = true;
      if (activeTab === "Order Payment") {
        matchesType = txn.type === "Order Payment" && txn.status !== "Cancelled";
      } else if (activeTab === "Withdrawal") {
        matchesType = txn.type === "Withdrawal";
      } else if (activeTab === "Cancelled") {
        matchesType = txn.status === "Cancelled";
      }

      return matchesSearch && matchesType;
    });
    const totalPages = Math.max(1, Math.ceil(result.length / pageSize));
    if (page > totalPages) {
      setPage(1);
    }
    return result;
  }, [searchTerm, activeTab, ledger, page, pageSize]);

  const paginatedTransactions = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return filteredTransactions.slice(start, end);
  }, [filteredTransactions, page, pageSize]);

  const handleSelectTxn = useCallback((txn) => {
    setSelectedTxn(txn);
    setIsDetailModalOpen(true);
  }, []);

  const handleDownloadReceipt = useCallback((txn) => {
    try {
      const record = {
        id: txn.id ?? txn.ref ?? "",
        type: txn.type ?? "",
        amount: `₹${formatINR(Math.abs(Number(txn.amount ?? 0)))}`,
        status: txn.status ?? "",
        date:
          txn.date ??
          (txn.createdAt
            ? new Date(txn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : ""),
        time:
          txn.time ??
          (txn.createdAt
            ? new Date(txn.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })
            : ""),
        customer: txn.customer ?? "",
        ref: txn.ref ?? "",
      };
      exportToCSV([record], `Transaction_${record.id || "receipt"}`, {
        id: "Transaction ID",
        type: "Type",
        amount: "Amount",
        status: "Status",
        date: "Date",
        time: "Time",
        customer: "Customer/Recipient",
        ref: "Reference",
      });
      toast.success("Receipt downloaded");
    } catch (error) {
      console.error("Receipt download error:", error);
      toast.error("Failed to download receipt");
    }
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen font-black text-slate-600">LOADING TRANSACTIONS...</div>;
  }

  return (
    <div className="space-y-8 pb-16">
      <BlurFade delay={0.1}>
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              Transaction Ledger
              <Badge
                variant="primary"
                className="text-[10px] sm:text-xs px-1.5 py-0 font-bold tracking-wider uppercase bg-brand-100 text-brand-700">
                Audit Trail
              </Badge>
            </h1>
            <p className="text-slate-600 text-sm mt-0.5 font-medium">
              Keep track of all financial movements, payouts, and settlements.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                setIsDownloading(true);
                try {
                  const exportData = filteredTransactions.map((txn) => ({
                    id: txn.id ?? txn.ref ?? "",
                    type: txn.type ?? "",
                    amount: `₹${formatINR(Math.abs(Number(txn.amount ?? 0)))}`,
                    status: txn.status ?? "",
                    date: txn.date ?? (txn.createdAt ? new Date(txn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ""),
                    time: txn.time ?? (txn.createdAt ? new Date(txn.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""),
                    customer: txn.customer ?? "",
                    ref: txn.ref ?? "",
                  }));

                  exportToCSV(exportData, "Seller_Transactions", {
                    id: "Transaction ID",
                    type: "Type",
                    amount: "Amount",
                    status: "Status",
                    date: "Date",
                    time: "Time",
                    customer: "Customer",
                    ref: "Reference"
                  });
                  toast.success("Statement downloaded successfully!");
                } catch (error) {
                  console.error("Download Error:", error);
                  toast.error("Failed to download statement");
                } finally {
                  setIsDownloading(false);
                }
              }}
              className="rounded-lg px-4 py-2 shadow-lg shadow-primary/20 disabled:opacity-50"
              disabled={isDownloading || filteredTransactions.length === 0}>
              <HiOutlineDocumentText className="h-4 w-4 mr-2" />
              {isDownloading ? "DOWNLOADING..." : "DOWNLOAD STATEMENTS"}
            </Button>
          </div>
        </div>
      </BlurFade>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <BlurFade key={i} delay={0.1 + i * 0.05}>
            <MagicCard
              className="border-none shadow-md overflow-hidden bg-white p-0"
              gradientColor="#f8fafc">
              <div className="p-6 relative z-10 flex items-center gap-4">
                <div
                  className={cn(
                    "h-14 w-14 rounded-lg flex items-center justify-center shadow-lg shadow-black/5",
                    stat.bg,
                    stat.color,
                  )}>
                  <stat.icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-600 uppercase tracking-widest">
                    {stat.label}
                  </p>
                  <h4 className="text-3xl font-black text-slate-900 tracking-tight">
                    {stat.value}
                  </h4>
                </div>
              </div>
            </MagicCard>
          </BlurFade>
        ))}
      </div>

      <BlurFade delay={0.4}>
        <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden rounded-lg p-0 bg-white">
          {/* Toolbar */}
          <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 items-center justify-between bg-white">
            <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
              {["All", "Order Payment", "Withdrawal", "Cancelled"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                    activeTab === tab
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-700",
                  )}>
                  {tab === "Order Payment" ? "Payments" : tab}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-80">
              <HiOutlineMagnifyingGlass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-600" />
              <Input
                placeholder="Search by customer..."
                className="pl-10 pr-4 py-2.5 rounded-lg border-none ring-1 ring-slate-100 bg-slate-50/50 focus:ring-2 focus:ring-primary/20 transition-all text-xs font-semibold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="bg-slate-50/90 backdrop-blur-sm sticky top-0 z-10 border-b border-slate-100">
                  <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">
                    Transaction Details
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">
                    Reference
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest">
                    Status
                  </th>
                  <th className="px-6 py-4 text-xs font-black text-slate-600 uppercase tracking-widest text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-600 text-sm font-medium">
                      {ledger.length === 0 ? "No transactions yet." : "No matches for your search or filter."}
                    </td>
                  </tr>
                ) : (
                  paginatedTransactions.map((txn, idx) => (
                    <TransactionTableRow
                      key={txn.id || txn.ref || txn.reference || `txn-${idx}`}
                      txn={txn}
                      onSelect={handleSelectTxn}
                      onDownloadReceipt={handleDownloadReceipt}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredTransactions.length > 0 && (
            <div className="p-4 border-t border-slate-50 bg-slate-50/40">
              <Pagination
                page={page}
                totalPages={Math.max(1, Math.ceil(filteredTransactions.length / pageSize))}
                total={filteredTransactions.length}
                pageSize={pageSize}
                onPageChange={(newPage) => setPage(newPage)}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                loading={loading}
              />
            </div>
          )}
        </Card>
      </BlurFade>

      {/* Transaction Detail Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Transaction Receipt">
        {selectedTxn && (
          <div className="space-y-6">
            <div className="text-center p-6 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-1">
                Total Amount
              </p>
              <h2
                className={cn(
                  "text-4xl font-black tracking-tight",
                  selectedTxn.status === "Cancelled" || selectedTxn.status === "Failed"
                    ? "text-slate-400 line-through"
                    : Number(selectedTxn.amount ?? 0) > 0
                      ? "text-emerald-600"
                      : "text-rose-600",
                )}>
                {selectedTxn.status !== "Cancelled" && selectedTxn.status !== "Failed" && Number(selectedTxn.amount ?? 0) > 0 ? "+" : ""}
                {selectedTxn.status !== "Cancelled" && selectedTxn.status !== "Failed" && Number(selectedTxn.amount ?? 0) < 0 ? "-" : ""}
                ₹{formatINR(Math.abs(Number(selectedTxn.amount ?? 0)))}
              </h2>
              <Badge
                className={cn(
                  "mt-4 uppercase font-black text-[10px] sm:text-xs px-3 py-1",
                  selectedTxn.status === "Settled" && "bg-emerald-50 text-emerald-700 border-emerald-200",
                  (selectedTxn.status === "Cancelled" || selectedTxn.status === "Failed") && "bg-slate-100 text-slate-600 border-slate-300",
                  (selectedTxn.status === "Pending" || selectedTxn.status === "Processing") && "bg-amber-50 text-amber-700 border-amber-200"
                )}
                variant="outline">
                {selectedTxn.status ?? "—"}
              </Badge>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Transaction ID</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.id ?? selectedTxn.ref ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Type</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.type ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">
                  Customer/Recipient
                </span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.customer ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Reference</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.ref ?? "—"}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-600 font-bold">Date & Time</span>
                <span className="text-slate-900 font-black">
                  {selectedTxn.date && selectedTxn.time
                    ? `${selectedTxn.date} at ${selectedTxn.time}`
                    : selectedTxn.createdAt
                      ? `${new Date(selectedTxn.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} at ${new Date(selectedTxn.createdAt).toLocaleTimeString()}`
                      : "—"}
                </span>
              </div>
            </div>

            {selectedTxn.status === "Cancelled" || selectedTxn.status === "Failed" ? (
              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center gap-3">
                <HiOutlineXCircle className="h-5 w-5 text-slate-500 shrink-0" />
                <p className="text-xs text-slate-700 font-semibold leading-relaxed">
                  Order was cancelled by customer. No payout applicable.
                </p>
              </div>
            ) : selectedTxn.status === "Settled" ? (
              <div className="p-4 bg-emerald-50/80 rounded-lg border border-emerald-200/60 flex items-center gap-3">
                <HiOutlineCheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-800 font-semibold leading-relaxed">
                  {selectedTxn.type === "Withdrawal"
                    ? "Payout successfully transferred to your bank account."
                    : "Payout settled to your balance."}
                </p>
              </div>
            ) : selectedTxn.type === "Withdrawal" ? (
              <div className="p-4 bg-amber-50/80 rounded-lg border border-amber-200/60 flex items-center gap-3">
                <HiOutlineClock className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                  Withdrawal request submitted. Awaiting bank settlement / admin approval.
                </p>
              </div>
            ) : (
              <div className="p-4 bg-amber-50/80 rounded-lg border border-amber-200/60 flex items-center gap-3">
                <HiOutlineClock className="h-5 w-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800 font-semibold leading-relaxed">
                  Settlement Scheduled (T+2 rolling cycle). Funds will be credited once order delivery is confirmed.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => window.print()}
                className="rounded-lg py-4 font-black bg-white">
                PRINT RECEIPT
              </Button>
              <Button
                onClick={() => setIsDetailModalOpen(false)}
                className="rounded-lg py-4 font-black shadow-xl shadow-primary/20">
                CLOSE
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Transactions;
