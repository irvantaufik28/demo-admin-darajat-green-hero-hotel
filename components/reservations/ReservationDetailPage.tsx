"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../layout/AdminShell";
import {
  calculateNights,
  extraBedRates,
  extras,
  formatRupiah,
  formatStayDate,
  getExtraCost,
  getRoomExtraBedsTotal,
  roomTypes,
  type RoomType,
} from "../../lib/walk-in-data";
import {
  loadReservationDetail,
  saveReservationDetail,
  type ReservationDetail,
} from "../../lib/reservation-detail-data";
import { PendingReservationDetail } from "./PendingReservationDetail";
import { RecordOutstandingPayment } from "./RecordOutstandingPayment";
import { ConfirmReservationAction } from "./ConfirmReservationAction";

type ModalKind = "check-in" | "check-out" | null;
type RoomUnit = { type: RoomType; name: string; index: number };

function parseCurrency(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

function dateLabel(value: string) {
  if (!value) return "—";
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }).format(date);
}

function timeLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

function sourceLabel(reservation: ReservationDetail) {
  return reservation.source === "OTA" && reservation.channel
    ? "OTA · " + reservation.channel
    : reservation.source;
}

function Badge({ value }: { value: string }) {
  const tone =
    value === "Paid" || value === "Confirmed" || value === "Received"
      ? "success"
      : value === "Checked-in"
        ? "info"
        : value === "Checked-out" || value === "Refunded"
          ? "neutral"
          : value === "Cancelled" || value === "Expired" || value === "Failed"
            ? "danger"
            : "warning";
  return (
    <span className={"reservations-badge reservations-badge--" + tone}>
      {value}
    </span>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="reservation-detail-row">
      <span>{label}</span>
      <strong>{children}</strong>
    </div>
  );
}

export function ReservationDetailPage() {
  const checkInAutoOpened = useRef(false);
  const params = useParams<{ bookingId: string }>();
  const bookingId = params.bookingId;
  const [reservation, setReservation] = useState<ReservationDetail | null>(
    null,
  );
  const [loaded, setLoaded] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [assignedRooms, setAssignedRooms] = useState<string[]>([]);
  const [requireDeposit, setRequireDeposit] = useState(true);
  const [depositAmount, setDepositAmount] = useState(300000);
  const [depositMethod, setDepositMethod] = useState("Cash");
  const [depositNote, setDepositNote] = useState("");
  const [depositHandling, setDepositHandling] = useState<"full" | "deduction">(
    "full",
  );
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [deductionNote, setDeductionNote] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [balanceAcknowledged, setBalanceAcknowledged] = useState(false);
  const [checkoutBalanceAcknowledged, setCheckoutBalanceAcknowledged] = useState(false);
  const [checkoutOutstandingReason, setCheckoutOutstandingReason] = useState("");

  useEffect(() => {
    setReservation(loadReservationDetail(bookingId));
    setLoaded(true);
  }, [bookingId]);
  useEffect(() => {
    if (!modal) return;
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setModal(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [modal]);

  const units = useMemo<RoomUnit[]>(() => {
    if (!reservation) return [];
    const quantity = reservation.quantities ?? {};
    const expanded = roomTypes.flatMap((type) =>
      Array.from(
        { length: Math.min(Math.max(0, quantity[type.id] ?? 0), 20) },
        (_, index) => ({ type: type.id, name: type.name, index }),
      ),
    );
    if (expanded.length) return expanded;
    const match =
      roomTypes.find((type) => reservation.room.includes(type.name)) ??
      roomTypes[0];
    return [{ type: match.id, name: match.name, index: 0 }];
  }, [reservation]);
  const nights = reservation
    ? calculateNights(reservation.checkIn, reservation.checkOut)
    : 0;
  const selectedExtras = reservation?.selectedExtras ?? [];
  const extrasTotal = selectedExtras.reduce(
    (sum, id) =>
      sum + getExtraCost(id, reservation?.extraQuantities?.[id] ?? 1, nights),
    0,
  );
  const extraBedsTotal = getRoomExtraBedsTotal(reservation?.roomExtraBeds);
  const total = reservation?.total ?? 0;
  const roomTotal = Math.max(0, total - extrasTotal - extraBedsTotal);
  const amountPaid = reservation?.amountPaid ?? 0;
  const balance = Math.max(0, total - amountPaid);
  const heldDeposit =
    reservation?.status === "Checked-out"
      ? 0
      : (reservation?.depositAmount ?? 0);

  const openCheckIn = useCallback(() => {
    if (!reservation) return;
    const used = new Set<string>();
    setAssignedRooms(
      units.map((unit, index) => {
        const saved = reservation.roomNumbers?.[index];
        const next =
          saved ||
          roomTypes
            .find((type) => type.id === unit.type)
            ?.numbers.find((number) => !used.has(number)) ||
          "";
        used.add(next);
        return next;
      }),
    );
    setRequireDeposit(
      (reservation.depositAmount ?? 0) > 0 ||
        reservation.depositAmount === undefined,
    );
    setDepositAmount(reservation.depositAmount || 300000);
    setDepositMethod(reservation.depositMethod || "Cash");
    setDepositNote(reservation.depositNote || "");
    setBalanceAcknowledged(false);
    setError("");
    setModal("check-in");
  }, [reservation, units]);

  useEffect(() => {
    if (
      checkInAutoOpened.current ||
      reservation?.status !== "Confirmed" ||
      reservation.paymentStatus !== "Paid" ||
      window.location.hash !== "#check-in"
    )
      return;
    checkInAutoOpened.current = true;
    openCheckIn();
  }, [reservation, openCheckIn]);

  function confirmCheckIn() {
    if (!reservation) return;
    if (
      assignedRooms.length !== units.length ||
      assignedRooms.some((value) => !value) ||
      new Set(assignedRooms).size !== assignedRooms.length
    ) {
      setError("Pilih nomor kamar yang berbeda untuk setiap unit.");
      return;
    }
    if (requireDeposit && depositAmount < 1) {
      setError("Jumlah deposit harus lebih dari Rp0.");
      return;
    }
    if (reservation.paymentStatus !== "Paid" && !balanceAcknowledged) {
      setError("Konfirmasi sisa tagihan sebelum check-in.");
      return;
    }
    const updated = saveReservationDetail(reservation.bookingId, "Checked-in", {
      roomNumbers: assignedRooms,
      depositAmount: requireDeposit ? depositAmount : 0,
      depositMethod: requireDeposit ? depositMethod : "",
      depositNote: requireDeposit ? depositNote.trim() : "",
      checkInAt: new Date().toISOString(),
    });
    setReservation(updated);
    setModal(null);
    setNotice("Check-in tamu berhasil dicatat.");
  }

  function openCheckOut() {
    setDepositHandling("full");
    setDeductionAmount(0);
    setDeductionNote("");
    setCheckoutBalanceAcknowledged(false);
    setCheckoutOutstandingReason("");
    setError("");
    setModal("check-out");
  }

  function confirmCheckOut() {
    if (!reservation) return;
    if (balance > 0 && (!checkoutBalanceAcknowledged || !checkoutOutstandingReason.trim())) {
      setError("Centang konfirmasi dan isi alasan check-out dengan sisa tagihan.");
      return;
    }
    const deposit = reservation.depositAmount ?? 0;
    if (
      depositHandling === "deduction" &&
      (deductionAmount < 0 || deductionAmount > deposit)
    ) {
      setError("Potongan deposit tidak boleh melebihi jumlah deposit.");
      return;
    }
    const deducted = depositHandling === "deduction" ? deductionAmount : 0;
    const updated = saveReservationDetail(
      reservation.bookingId,
      "Checked-out",
      {
        depositRefunded: deposit - deducted,
        depositDeducted: deducted,
        deductionNote: deducted ? deductionNote.trim() : "",
        checkOutAt: new Date().toISOString(),
        checkoutOutstandingReason: balance > 0 ? checkoutOutstandingReason.trim() : "",
      },
    );
    setReservation(updated);
    setModal(null);
    setNotice(balance > 0 ? `Check-out dicatat dengan sisa tagihan ${formatRupiah(balance)}.` : "Check-out tamu berhasil dicatat.");
  }

  if (!loaded)
    return (
      <AdminShell title="Reservations" context="Reservation Detail">
        <div className="reservation-detail-page">Memuat reservasi...</div>
      </AdminShell>
    );
  if (!reservation)
    return (
      <AdminShell title="Reservations" context="Reservation Detail">
        <div className="reservation-detail-page reservation-detail-missing">
          <h1>Reservasi tidak ditemukan</h1>
          <Link href="/reservations">Kembali ke All Reservations</Link>
        </div>
      </AdminShell>
    );
  if (
    (reservation.status === "Pending" || reservation.status === "Confirmed") &&
    (reservation.paymentStatus === "Unpaid" ||
      reservation.paymentStatus === "Partial")
  ) {
    return (
      <PendingReservationDetail
        reservation={reservation}
        notice={notice}
        onDismissNotice={() => setNotice("")}
        onUpdate={(updated, message) => {
          setReservation(updated);
          setNotice(message);
        }}
      />
    );
  }

  return (
    <AdminShell title="Reservations" context={reservation.bookingId}>
      <div className="reservation-detail-page">
        <div className="reservation-detail-heading">
          <div>
            <div className="reservation-detail-title">
              <h1>Reservation Detail</h1>
              <span>{reservation.bookingId}</span>
            </div>
            <div className="reservation-detail-badges">
              <Badge value={reservation.status} />
              <Badge value={reservation.paymentStatus} />
              <span className="reservations-source">
                {sourceLabel(reservation)}
              </span>
            </div>
          </div>
          <Link className="reservation-secondary-button" href="/reservations">
            ← All Reservations
          </Link>
        </div>
        {notice && (
          <div
            className="reservation-feedback reservation-feedback--success"
            role="status"
          >
            {notice}
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Tutup pesan"
            >
              ×
            </button>
          </div>
        )}
        <div className="reservation-detail-columns">
          <div className="reservation-detail-content">
            <section>
              <div className="reservation-detail-section-title">
                <h2>Guest Information</h2>
                <span>Primary Contact</span>
              </div>
              <div className="reservation-detail-info-grid">
                <div>
                  <small>Full Name</small>
                  <strong>{reservation.guestName}</strong>
                </div>
                <div>
                  <small>WhatsApp</small>
                  <strong>{reservation.whatsapp}</strong>
                </div>
                <div>
                  <small>Email</small>
                  <strong>{reservation.email || "—"}</strong>
                </div>
              </div>
              {reservation.notes && (
                <p className="reservation-detail-note">
                  <strong>Guest Notes:</strong> {reservation.notes}
                </p>
              )}
            </section>
            <section>
              <div className="reservation-detail-section-title">
                <h2>Stay Details</h2>
                <span>
                  {nights} {nights === 1 ? "Night" : "Nights"} Stay
                </span>
              </div>
              <div className="reservation-detail-info-grid reservation-detail-stay-grid">
                <div>
                  <small>Check-in</small>
                  <strong>{dateLabel(reservation.checkIn)}</strong>
                  <span>From 14:00</span>
                </div>
                <div>
                  <small>Check-out</small>
                  <strong>{dateLabel(reservation.checkOut)}</strong>
                  <span>Until 12:00</span>
                </div>
                <div>
                  <small>Duration</small>
                  <strong>
                    {nights} {nights === 1 ? "night" : "nights"}
                  </strong>
                </div>
                <div>
                  <small>Guests</small>
                  <strong>
                    {reservation.adults ?? 2} Adults
                    {(reservation.children ?? 0) > 0
                      ? ` · ${reservation.children} Children`
                      : ""}
                  </strong>
                </div>
              </div>
            </section>
            <section>
              <div className="reservation-detail-section-title">
                <h2>Room Allocation &amp; Rate</h2>
                <span>
                  {units.length} {units.length === 1 ? "Unit" : "Units"}
                </span>
              </div>
              <div className="reservation-detail-info-grid reservation-detail-room-grid">
                <div>
                  <small>Room Type</small>
                  <strong>{reservation.room}</strong>
                </div>
                <div>
                  <small>Room Number</small>
                  {reservation.roomNumbers?.length ? (
                    <strong>{reservation.roomNumbers.join(", ")}</strong>
                  ) : (
                    <Badge value="Not Assigned" />
                  )}
                </div>
              </div>
              {units.some(
                (unit) =>
                  (reservation.roomExtraBeds?.[`${unit.type}-${unit.index}`] ??
                    0) > 0,
              ) && (
                <div className="reservation-detail-room-beds">
                  {units.map((unit, index) => {
                    const bedNights =
                      reservation.roomExtraBeds?.[
                        `${unit.type}-${unit.index}`
                      ] ?? 0;
                    return bedNights > 0 ? (
                      <div key={`${unit.type}-${unit.index}`}>
                        <span>
                          ↳ Extra Bed · {unit.name}{" "}
                          {reservation.roomNumbers?.[index] ?? `#${index + 1}`}
                        </span>
                        <strong>
                          1 Bed · {bedNights} Nights @{" "}
                          {formatRupiah(extraBedRates[unit.type])} ={" "}
                          {formatRupiah(extraBedRates[unit.type] * bedNights)}
                        </strong>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
              <div className="reservation-detail-room-total">
                <span>Room Total</span>
                <strong>{formatRupiah(roomTotal)}</strong>
              </div>
            </section>
            <section>
              <div className="reservation-detail-section-title">
                <h2>Experiences &amp; Add-ons</h2>
              </div>
              {selectedExtras.length ? (
                <div className="reservation-detail-extras">
                  <div className="reservation-detail-extras-head">
                    <span>Item &amp; Package</span>
                    <span>Qty</span>
                    <span>Subtotal</span>
                  </div>
                  {selectedExtras.map((id) => {
                    const extra = extras.find((item) => item.id === id);
                    const quantity = reservation.extraQuantities?.[id] ?? 1;
                    return extra ? (
                      <div key={id}>
                        <span>{extra.label}</span>
                        <span>{quantity}</span>
                        <strong>
                          {formatRupiah(getExtraCost(id, quantity, nights))}
                        </strong>
                      </div>
                    ) : null;
                  })}
                </div>
              ) : (
                <p className="reservation-empty">Belum ada add-on.</p>
              )}
            </section>
            <section>
              <div className="reservation-detail-section-title">
                <h2>Booking Payment</h2>
                <span>
                  Method: <strong>{reservation.paymentMethod || "—"}</strong>{" "}
                  &nbsp; <Badge value={reservation.paymentStatus} />
                </span>
              </div>
              <div className="reservation-detail-payment">
                <DetailRow
                  label={
                    "Room Charge (" +
                    nights +
                    " Night" +
                    (nights === 1 ? "" : "s") +
                    ")"
                  }
                >
                  {formatRupiah(roomTotal)}
                </DetailRow>
                {extraBedsTotal > 0 && (
                  <DetailRow label="Extra Bed">
                    {formatRupiah(extraBedsTotal)}
                  </DetailRow>
                )}
                {extrasTotal > 0 && (
                  <DetailRow label="Add-ons">
                    {formatRupiah(extrasTotal)}
                  </DetailRow>
                )}
                <DetailRow label="Total Booking">
                  {formatRupiah(total)}
                </DetailRow>
                <DetailRow label="Amount Paid">
                  {formatRupiah(amountPaid)}
                </DetailRow>
                <DetailRow label="Remaining Balance">
                  {formatRupiah(balance)}
                </DetailRow>
              </div>
            </section>
            {(reservation.status === "Checked-in" ||
              reservation.status === "Checked-out") && (
              <section>
                <div className="reservation-detail-section-title">
                  <h2>Deposit</h2>
                  <Badge
                    value={
                      reservation.status === "Checked-out"
                        ? "Settled"
                        : "Received"
                    }
                  />
                </div>
                <div className="reservation-detail-info-grid reservation-detail-deposit-grid">
                  <div>
                    <small>Deposit Amount</small>
                    <strong>
                      {formatRupiah(reservation.depositAmount ?? 0)}
                    </strong>
                  </div>
                  <div>
                    <small>Method</small>
                    <strong>{reservation.depositMethod || "—"}</strong>
                  </div>
                  <div>
                    <small>Refunded</small>
                    <strong>
                      {formatRupiah(reservation.depositRefunded ?? 0)}
                    </strong>
                  </div>
                  <div>
                    <small>Remaining Deposit</small>
                    <strong>{formatRupiah(heldDeposit)}</strong>
                  </div>
                </div>
                {reservation.depositDeducted ? (
                  <p className="reservation-detail-note">
                    Deduction: {formatRupiah(reservation.depositDeducted)}
                    {reservation.deductionNote
                      ? " · " + reservation.deductionNote
                      : ""}
                  </p>
                ) : null}
              </section>
            )}
            <section>
              <div className="reservation-detail-section-title">
                <h2>Activity Timeline</h2>
                <span>Audit Trail</span>
              </div>
              <div className="reservation-detail-timeline">
                {reservation.checkOutAt && (
                  <div>
                    <strong>Guest checked out</strong>
                    <span>{timeLabel(reservation.checkOutAt)}</span>
                  </div>
                )}
                {(reservation.checkInAt ||
                  reservation.status === "Checked-in" ||
                  reservation.status === "Checked-out") && (
                  <div>
                    <strong>
                      Guest checked in
                      {reservation.roomNumbers?.length
                        ? " · Room " + reservation.roomNumbers.join(", ")
                        : ""}
                    </strong>
                    <span>{timeLabel(reservation.checkInAt)}</span>
                  </div>
                )}
                {reservation.paymentStatus === "Paid" && (
                  <div>
                    <strong>
                      Payment completed · {formatRupiah(amountPaid)}
                    </strong>
                    <span>{reservation.paymentMethod || "—"}</span>
                  </div>
                )}
                <div>
                  <strong>Reservation created</strong>
                  <span>Source: {sourceLabel(reservation)}</span>
                </div>
              </div>
            </section>
          </div>
          <aside className="reservation-detail-summary">
            <div className="reservation-detail-section-title">
              <h2>
                {reservation.status === "Checked-in" ||
                reservation.status === "Checked-out"
                  ? "Stay Summary"
                  : "Reservation Summary"}
              </h2>
              <span>
                {nights} {nights === 1 ? "Night" : "Nights"}
              </span>
            </div>
            <div className="reservation-detail-summary-rows">
              <DetailRow label="Guest">{reservation.guestName}</DetailRow>
              <DetailRow label="Stay">
                {formatStayDate(reservation.checkIn)} →{" "}
                {formatStayDate(reservation.checkOut)}
              </DetailRow>
              <DetailRow label="Room Type">{reservation.room}</DetailRow>
              <DetailRow label="Room Number">
                {reservation.roomNumbers?.length
                  ? reservation.roomNumbers.join(", ")
                  : "Not Assigned"}
              </DetailRow>
              <div className="reservation-detail-summary-divider" />
              <DetailRow label="Booking Total">{formatRupiah(total)}</DetailRow>
              <DetailRow label="Payment">
                <Badge value={reservation.paymentStatus} />
              </DetailRow>
              {(reservation.status === "Checked-in" ||
                reservation.status === "Checked-out") && (
                <DetailRow label="Deposit">
                  {formatRupiah(reservation.depositAmount ?? 0)}
                </DetailRow>
              )}
              <DetailRow label="Balance">{formatRupiah(balance)}</DetailRow>
              <DetailRow label="Status">
                <Badge value={reservation.status} />
              </DetailRow>
            </div>
            {reservation.status === "Pending" &&
              reservation.paymentStatus === "Paid" && (
                <ConfirmReservationAction
                  reservation={reservation}
                  onUpdate={(updated, message) => {
                    setReservation(updated);
                    setNotice(message);
                  }}
                />
              )}
            {(reservation.status === "Checked-in" || reservation.status === "Checked-out") &&
              (reservation.paymentStatus === "Partial" ||
                reservation.paymentStatus === "Unpaid") && (
                <RecordOutstandingPayment
                  reservation={reservation}
                  onUpdate={(updated, message) => {
                    setReservation(updated);
                    setNotice(message);
                  }}
                />
              )}
            {reservation.status === "Confirmed" &&
              reservation.paymentStatus === "Paid" && (
                <button
                  type="button"
                  className="action-button reservation-detail-main-action"
                  onClick={openCheckIn}
                >
                  Check-in Guest
                </button>
              )}
            {reservation.status === "Checked-in" &&
              ["Paid", "Partial", "Unpaid"].includes(reservation.paymentStatus) && (
                <button
                  type="button"
                  className="action-button reservation-detail-main-action"
                  onClick={openCheckOut}
                >
                  Check Out Guest
                </button>
              )}
            {reservation.status === "Pending" && (
              <p className="reservation-detail-summary-hint">
                Pembayaran telah diterima. Reservasi menunggu konfirmasi.
              </p>
            )}
            {reservation.status === "Cancelled" && (
              <p className="reservation-detail-summary-hint">
                Reservasi dibatalkan.{" "}
                {reservation.paymentStatus === "Partial" ||
                reservation.paymentStatus === "Paid"
                  ? "Pembayaran memerlukan settlement atau refund."
                  : reservation.paymentStatus === "Refunded"
                    ? "Refund telah selesai."
                    : "Belum ada pembayaran."}
              </p>
            )}
            {reservation.status === "Expired" && (
              <p className="reservation-detail-summary-hint">
                Reservasi kedaluwarsa dengan pembayaran{" "}
                {reservation.paymentStatus}.
              </p>
            )}
            {reservation.status === "Checked-out" && (
              <p className="reservation-detail-summary-hint">
                Tamu telah check-out.{reservation.checkoutOutstandingReason ? ` Alasan sisa tagihan: ${reservation.checkoutOutstandingReason}` : ""}
              </p>
            )}
          </aside>
        </div>
        {modal && (
          <div
            className="reservation-operation-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setModal(null);
            }}
          >
            <section
              className="reservation-operation-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="operation-title"
            >
              <div className="reservation-operation-header">
                <h2 id="operation-title">
                  {modal === "check-in" ? "Check-in Guest" : "Check-out Guest"}
                </h2>
                <button
                  type="button"
                  onClick={() => setModal(null)}
                  aria-label="Tutup modal"
                >
                  ×
                </button>
              </div>
              <div className="reservation-operation-body">
                <div className="reservation-operation-context">
                  <div>
                    <strong>{reservation.guestName}</strong>
                    <span>{reservation.bookingId}</span>
                  </div>
                  <small>
                    {reservation.room} · {formatStayDate(reservation.checkIn)} →{" "}
                    {formatStayDate(reservation.checkOut)} ({nights}{" "}
                    {nights === 1 ? "night" : "nights"})
                  </small>
                </div>
                {modal === "check-in" ? (
                  <>
                    <div className="reservation-operation-rooms">
                      {units.map((unit, index) => (
                        <label key={unit.type + "-" + unit.index}>
                          Assign {unit.name}
                          {units.length > 1 ? " #" + (index + 1) : ""}{" "}
                          <span>*</span>
                          <select
                            value={assignedRooms[index] ?? ""}
                            onChange={(event) =>
                              setAssignedRooms((current) =>
                                current.map((value, roomIndex) =>
                                  roomIndex === index
                                    ? event.target.value
                                    : value,
                                ),
                              )
                            }
                          >
                            <option value="">Select room</option>
                            {roomTypes
                              .find((type) => type.id === unit.type)
                              ?.numbers.map((number) => (
                                <option
                                  key={number}
                                  value={number}
                                  disabled={assignedRooms.some(
                                    (selected, selectedIndex) =>
                                      selectedIndex !== index &&
                                      selected === number,
                                  )}
                                >
                                  {number} — Available
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                    </div>
                    <p className="reservation-operation-hint">
                      Pilih nomor kamar saat tamu tiba di hotel.
                    </p>
                    <div className="reservation-operation-deposit">
                      <label className="reservation-operation-check">
                        <input
                          type="checkbox"
                          checked={requireDeposit}
                          onChange={(event) =>
                            setRequireDeposit(event.target.checked)
                          }
                        />
                        Require Deposit <span>Security guarantee</span>
                      </label>
                      {requireDeposit && (
                        <div className="reservation-operation-deposit-fields">
                          <label>
                            Deposit Amount
                            <input
                              inputMode="numeric"
                              value={formatRupiah(depositAmount)}
                              onChange={(event) =>
                                setDepositAmount(
                                  parseCurrency(event.target.value),
                                )
                              }
                            />
                          </label>
                          <label>
                            Deposit Method
                            <select
                              value={depositMethod}
                              onChange={(event) =>
                                setDepositMethod(event.target.value)
                              }
                            >
                              {["Cash", "Bank Transfer", "QRIS", "Other"].map(
                                (value) => (
                                  <option key={value}>{value}</option>
                                ),
                              )}
                            </select>
                          </label>
                          <label className="reservation-operation-wide">
                            Deposit Note (Optional)
                            <input
                              value={depositNote}
                              onChange={(event) =>
                                setDepositNote(event.target.value)
                              }
                              placeholder="e.g. Received at front desk"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="reservation-operation-balances">
                      <div>
                        <span>Booking Balance</span>
                        <strong>{formatRupiah(balance)}</strong>
                      </div>
                      <div>
                        <span>Deposit Held</span>
                        <strong>{formatRupiah(heldDeposit)}</strong>
                      </div>
                    </div>
                    {balance > 0 && <div className="reservation-outstanding-checkout">
                      <strong>Check-out dengan sisa tagihan</strong>
                      <p>Sisa {formatRupiah(balance)} tetap tercatat sebagai tagihan tamu setelah check-out.</p>
                      <label className="reservation-operation-check">
                        <input type="checkbox" checked={checkoutBalanceAcknowledged} onChange={(event) => setCheckoutBalanceAcknowledged(event.target.checked)} />
                        Saya menyetujui check-out dengan pembayaran belum lunas.
                      </label>
                      <label className="reservation-outstanding-reason">Alasan <span>*</span>
                        <textarea value={checkoutOutstandingReason} onChange={(event) => setCheckoutOutstandingReason(event.target.value)} placeholder="Jelaskan alasan check-out sebelum pelunasan" rows={3} />
                      </label>
                    </div>}
                    <div className="reservation-operation-deposit">
                      <strong>Deposit Handling</strong>
                      <label className="reservation-operation-radio">
                        <input
                          type="radio"
                          name="deposit-handling"
                          checked={depositHandling === "full"}
                          onChange={() => setDepositHandling("full")}
                        />
                        <span>
                          <strong>
                            Full Refund ({formatRupiah(heldDeposit)})
                          </strong>
                          <small>
                            Deposit will be returned in full to the guest.
                          </small>
                        </span>
                      </label>
                      <label className="reservation-operation-radio">
                        <input
                          type="radio"
                          name="deposit-handling"
                          checked={depositHandling === "deduction"}
                          onChange={() => setDepositHandling("deduction")}
                        />
                        <span>
                          <strong>Deduction</strong>
                          <small>
                            Deduct damages, minibar, or incidental fees.
                          </small>
                        </span>
                      </label>
                      {depositHandling === "deduction" && (
                        <div className="reservation-operation-deposit-fields">
                          <label>
                            Deduction Amount
                            <input
                              inputMode="numeric"
                              value={formatRupiah(deductionAmount)}
                              onChange={(event) =>
                                setDeductionAmount(
                                  parseCurrency(event.target.value),
                                )
                              }
                            />
                          </label>
                          <label className="reservation-operation-wide">
                            Reason (Optional)
                            <input
                              value={deductionNote}
                              onChange={(event) =>
                                setDeductionNote(event.target.value)
                              }
                              placeholder="e.g. Minibar charge"
                            />
                          </label>
                          <p className="reservation-operation-refund">
                            Refund to guest:{" "}
                            <strong>
                              {formatRupiah(
                                Math.max(0, heldDeposit - deductionAmount),
                              )}
                            </strong>
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
                {modal === "check-in" &&
                  reservation.paymentStatus !== "Paid" && (
                    <label className="partial-check-in-confirmation">
                      <input
                        type="checkbox"
                        checked={balanceAcknowledged}
                        onChange={(event) =>
                          setBalanceAcknowledged(event.target.checked)
                        }
                      />
                      <span>
                        Saya mengonfirmasi sisa tagihan{" "}
                        <strong>{formatRupiah(balance)}</strong> telah
                        dijelaskan kepada tamu. Jika belum lunas saat check-out,
                        petugas wajib mencatat konfirmasi dan alasan.
                      </span>
                    </label>
                  )}
                {error && (
                  <p className="reservation-operation-error" role="alert">
                    {error}
                  </p>
                )}
              </div>
              <div className="reservation-operation-actions">
                <button
                  type="button"
                  className="reservation-secondary-button"
                  onClick={() => setModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="action-button"
                  onClick={
                    modal === "check-in" ? confirmCheckIn : confirmCheckOut
                  }
                  disabled={modal === "check-in" && reservation.paymentStatus !== "Paid" && !balanceAcknowledged || modal === "check-out" && balance > 0 && (!checkoutBalanceAcknowledged || !checkoutOutstandingReason.trim())}
                >
                  Confirm {modal === "check-in" ? "Check-in" : "Check-out"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </AdminShell>
  );
}
