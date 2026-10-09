import type { ApiReservationDetail } from "../services/api";

type DetailAction =
  "confirm" | "payment" | "check_in" | "check_out" | "no_show" | "cancel";

export type DetailPresentation = {
  title: string;
  description: string;
  tone: "success" | "warning" | "danger" | "neutral";
  actions: DetailAction[];
};

export function noShowSettlementPresentation(detail: ApiReservationDetail) {
  const { reservation, summary } = detail;
  const snapshot = reservation.noShowSettlementSnapshot;
  const storedCharge = reservation.noShowChargeAmount;
  const paidAmount = summary.paidAmount;
  const isManualReview =
    snapshot?.settlementStatus === "manual_review_required" ||
    reservation.source === "ota" ||
    (reservation.source === "website" && reservation.paymentStatus !== "paid");
  const realizedPenalty = isManualReview
    ? null
    : snapshot?.amounts?.paymentAppliedToPenalty ??
      (storedCharge === null
        ? paidAmount
        : Math.min(storedCharge, paidAmount));
  const paymentRefundDue =
    snapshot?.amounts?.maximumRefundWithoutOverride ??
    (realizedPenalty === null ? 0 : Math.max(0, paidAmount - realizedPenalty));
  const depositReturnRequired =
    snapshot?.amounts?.depositReturnRequired ?? summary.depositBalance > 0;
  const status = isManualReview
    ? "manual_review_required"
    : depositReturnRequired || paymentRefundDue > 0
      ? "refund_required"
      : "settled";

  return {
    status,
    label:
      status === "settled"
        ? "Selesai"
        : status === "refund_required"
          ? "Pengembalian dana diperlukan"
          : "Perlu pemeriksaan manual",
    realizedPenalty,
    paymentRefundDue,
    depositReturnRequired,
  };
}

export function reservationDetailPresentation(
  detail: ApiReservationDetail,
): DetailPresentation {
  const { reservation, summary } = detail;
  const { reservationStatus, paymentStatus, source } = reservation;
  const hasBalance = summary.remainingBalance > 0;
  const canConfirmPayment =
    paymentStatus === "unpaid" ||
    paymentStatus === "partial" ||
    paymentStatus === "paid";

  if (reservationStatus === "pending") {
    return {
      title: "Awaiting Confirmation",
      description:
        paymentStatus === "paid"
          ? "Pembayaran lunas. Reservasi menunggu konfirmasi petugas."
          : paymentStatus === "partial"
            ? "Pembayaran sebagian diterima. Konfirmasi reservasi dapat dilakukan dengan sisa tagihan."
            : "Reservasi menunggu pembayaran atau konfirmasi petugas.",
      tone: "warning",
      actions: [
        ...((source === "phone" || source === "walk_in") && canConfirmPayment
          ? (["confirm"] as const)
          : []),
        ...(hasBalance ? (["payment"] as const) : []),
        "cancel",
      ],
    };
  }

  if (reservationStatus === "confirmed") {
    return {
      title: hasBalance
        ? "Check-in confirmation required"
        : "Ready to Check-in",
      description: hasBalance
        ? `Sisa tagihan harus dikonfirmasi petugas sebelum check-in. Nomor kamar ditetapkan saat check-in.`
        : "Reservasi sudah dikonfirmasi. Tetapkan nomor kamar untuk check-in.",
      tone: hasBalance ? "warning" : "success",
      actions: [
        ...(canConfirmPayment ? (["check_in"] as const) : []),
        ...(hasBalance ? (["payment"] as const) : []),
        "no_show",
        "cancel",
      ],
    };
  }

  if (reservationStatus === "checked_in") {
    return {
      title: hasBalance
        ? "Guest In House · Outstanding Balance"
        : "Guest In House",
      description: hasBalance
        ? "Tamu masih memiliki tagihan. Checkout dengan sisa tagihan memerlukan alasan dan izin khusus."
        : "Tamu sedang menginap. Periksa tagihan dan deposit sebelum checkout.",
      tone: hasBalance ? "warning" : "success",
      actions: ["check_out", ...(hasBalance ? (["payment"] as const) : [])],
    };
  }

  if (reservationStatus === "checked_out") {
    return {
      title: "Checked Out",
      description: hasBalance
        ? `Tamu telah checkout dengan sisa tagihan. ${reservation.checkoutOutstandingReason ? `Alasan: ${reservation.checkoutOutstandingReason}` : "Tagihan tetap tercatat di Payments."}`
        : "Masa inap selesai dan tidak ada sisa tagihan.",
      tone: hasBalance ? "warning" : "neutral",
      actions: hasBalance ? ["payment"] : [],
    };
  }

  if (reservationStatus === "cancelled") {
    return {
      title: "Reservation Cancelled",
      description:
        paymentStatus === "refunded"
          ? "Reservasi dibatalkan dan refund telah selesai."
          : detail.summary.paidAmount > 0
            ? "Reservasi dibatalkan setelah pembayaran. Periksa proses settlement atau refund."
            : "Reservasi dibatalkan sebelum pembayaran.",
      tone: "danger",
      actions: [],
    };
  }

  if (reservationStatus === "no_show") {
    const settlement = noShowSettlementPresentation(detail);
    const rupiah = (amount: number) =>
      `Rp${new Intl.NumberFormat("id-ID").format(amount)}`;
    const depositMessage = settlement.depositReturnRequired
      ? ` Security deposit ${rupiah(summary.depositBalance)} harus dikembalikan.`
      : "";
    const refundMessage = settlement.paymentRefundDue > 0
      ? ` Kelebihan pembayaran ${rupiah(settlement.paymentRefundDue)} harus dikembalikan.`
      : "";
    const description =
      settlement.status === "manual_review_required"
        ? reservation.source === "ota"
          ? `Tamu tidak datang. Settlement no-show mengikuti kebijakan OTA dan perlu diperiksa manual.${depositMessage}`
          : `Tamu tidak datang. Reservasi website belum lunas sehingga settlement perlu diperiksa manual.${depositMessage}`
        : settlement.realizedPenalty && settlement.realizedPenalty > 0
          ? `Tamu tidak datang. ${reservation.source === "website" ? "Pembayaran" : "Pembayaran/DP"} ${rupiah(settlement.realizedPenalty)} dicatat sebagai penalti no-show. Tidak ada sisa tagihan.${refundMessage}${depositMessage} Settlement: ${settlement.label}.`
          : `Tamu tidak datang. Tidak ada pembayaran yang ditahan dan tidak ada sisa tagihan.${depositMessage} Settlement: ${settlement.label}.`;

    return {
      title: "No Show",
      description,
      tone: "danger",
      actions: [],
    };
  }

  return {
    title: "Reservation Expired",
    description: `Reservasi kedaluwarsa dengan status pembayaran ${paymentStatus}.`,
    tone: "neutral",
    actions: [],
  };
}
