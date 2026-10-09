import type { ApiReservationDetail } from "../services/api";

type DetailAction =
  "confirm" | "payment" | "check_in" | "check_out" | "no_show" | "cancel";

export type DetailPresentation = {
  title: string;
  description: string;
  tone: "success" | "warning" | "danger" | "neutral";
  actions: DetailAction[];
};

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
    return {
      title: "No Show",
      description:
        reservation.noShowChargeAmount !== null
          ? `Tamu tidak datang. Penalty no-show tercatat sebesar Rp${new Intl.NumberFormat("id-ID").format(reservation.noShowChargeAmount)}.`
          : "Tamu tidak datang. Penalty memerlukan pemeriksaan manual.",
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
