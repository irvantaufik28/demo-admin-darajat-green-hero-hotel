"use client";
import "../styles/reservations.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { ReservationDetailActions } from "../components/ReservationDetailActions";
import { ReservationAuditTrail } from "../components/ReservationAuditTrail";
import { ReservationRoomOperations } from "../components/ReservationRoomOperations";
import {
  getReservationDetail,
  getReservationHistory,
  getReservations,
  type ApiReservationDetail,
  type ReservationHistoryItem,
} from "../services/api";
import { reservationDetailPresentation } from "../utils/detail-rules";
import { restoreSession } from "../../../lib/auth";

const labels: Record<string, string> = {
  walk_in: "Walk-in",
  website: "Website",
  phone: "Phone",
  ota: "OTA",
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked-in",
  checked_out: "Checked-out",
  cancelled: "Cancelled",
  expired: "Expired",
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  refunded: "Refunded",
  failed: "Failed",
};

function label(value: string) {
  return labels[value] ?? value;
}

function rupiah(value: number) {
  return `Rp${new Intl.NumberFormat("id-ID").format(value)}`;
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function timeLabel(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function stayNights(from: string, to: string) {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(0, Math.round((end - start) / 86_400_000))
    : 0;
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "confirmed" || value === "paid"
      ? "success"
      : value === "checked_in"
        ? "info"
        : value === "checked_out" || value === "refunded"
          ? "neutral"
          : value === "cancelled" ||
              value === "expired" ||
              value === "failed" ||
              value === "unpaid"
            ? "danger"
            : "warning";
  return (
    <span className={`status-badge status-badge--${tone}`}>{label(value)}</span>
  );
}

function Info({ name, value }: { name: string; value: string }) {
  return (
    <div>
      <span>{name}</span>
      <strong>{value || "—"}</strong>
    </div>
  );
}

function SummaryRow({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="reservation-detail-row">
      <span>{name}</span>
      <strong>{children}</strong>
    </div>
  );
}

export function ReservationDetailPage() {
  const { bookingId: id } = useParams<{ bookingId: string }>();
  const [detail, setDetail] = useState<ApiReservationDetail | null>(null);
  const [history, setHistory] = useState<ReservationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      let reservationId = id;
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          id,
        )
      ) {
        const matches = await getReservations(
          new URLSearchParams({ search: id, limit: "20" }),
          signal,
        );
        reservationId =
          matches.items.find((item) => item.bookingCode === id)?.id ?? id;
      }
      const [reservation, events] = await Promise.all([
        getReservationDetail(reservationId, signal),
        getReservationHistory(reservationId, signal).catch(
          () => [] as ReservationHistoryItem[],
        ),
      ]);
      if (!signal?.aborted) {
        setDetail(reservation);
        setHistory(events);
      }
    },
    [id],
  );

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function load() {
      try {
        if (!(await restoreSession())) return;
        await reload(controller.signal);
      } catch (cause) {
        if (active && !controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Detail reservasi gagal dimuat.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [reload]);

  async function onUpdated(message: string) {
    await reload();
    setNotice(message);
  }

  const presentation = detail ? reservationDetailPresentation(detail) : null;
  const reservation = detail?.reservation;
  const isPreStay =
    reservation?.reservationStatus === "pending" ||
    reservation?.reservationStatus === "confirmed";
  const isOutstanding = (detail?.summary.remainingBalance ?? 0) > 0;
  const isInHouse = reservation?.reservationStatus === "checked_in";

  return (
    <AdminShell
      title="Reservations"
      context={reservation?.bookingCode ?? "Reservation Detail"}
    >
      <div
        className={`reservation-detail-page api-reservation-detail-page${isPreStay && isOutstanding ? " api-reservation-detail-page--phone-unpaid" : ""}${isInHouse ? " api-reservation-detail-page--in-house" : ""}`}
      >
        <header className="reservation-detail-heading">
          <div>
            <div className="reservation-detail-title">
              <h1>{isInHouse ? "Guest Stay" : "Reservation Detail"}</h1>
            </div>
            {reservation && (
              <div className="reservation-detail-badges">
                <StatusBadge value={reservation.reservationStatus} />
                <StatusBadge value={reservation.paymentStatus} />
                <span className="reservations-source">
                  {reservation.source === "ota" && detail?.otaChannel
                    ? `OTA · ${detail.otaChannel.name}`
                    : label(reservation.source)}
                </span>
              </div>
            )}
            {reservation && (
              <p className="api-reservation-origin">
                <strong>{reservation.bookingCode}</strong> ·{" "}
                {reservation.source === "phone"
                  ? "Created via Front Desk Phone Log"
                  : `Source: ${label(reservation.source)}`}
              </p>
            )}
          </div>
          <Link href="/reservations" className="reservation-secondary-button">
            ← All Reservations
          </Link>
        </header>

        {loading && <LoadingSkeleton variant="detail" />}
        {error && !loading && (
          <div className="reservation-detail-missing" role="alert">
            {error}
          </div>
        )}
        {notice && (
          <div className="dashboard-message" role="status">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Tutup pesan"
            >
              ×
            </button>
          </div>
        )}

        {detail && presentation && !loading && (
          <>
            <div
              className={`api-reservation-state api-reservation-state--${isPreStay && reservation?.reservationStatus === "confirmed" ? "success" : presentation.tone}`}
            >
              <strong>{presentation.title}</strong>
              <span>{presentation.description}</span>
            </div>

            {isPreStay && isOutstanding && (
              <div className="pending-detail-hold">
                <div>
                  <strong>
                    {reservation?.reservationStatus === "pending"
                      ? "Hold Reservation Active:"
                      : "Outstanding Balance:"}
                  </strong>{" "}
                  {reservation?.reservationStatus === "pending"
                    ? "Konfirmasi reservasi dan sisa tagihan sebelum check-in."
                    : `Check-in tersedia setelah petugas mengonfirmasi sisa tagihan ${rupiah(detail.summary.remainingBalance)}.`}
                </div>
                <span>
                  {reservation?.paymentStatus === "partial"
                    ? "Partial Payment"
                    : "Awaiting Payment"}
                </span>
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
                    <Info name="Full Name" value={detail.guest.fullName} />
                    <Info name="WhatsApp / Phone" value={detail.guest.phone} />
                    <Info name="Email" value={detail.guest.email ?? "—"} />
                  </div>
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>Stay Details</h2>
                    <span>{detail.summary.nights} Night Stay</span>
                  </div>
                  {isPreStay && isOutstanding ? (
                    <div className="pending-detail-stay-grid">
                      <div>
                        <small>Check-in</small>
                        <strong>
                          {dateLabel(detail.reservation.checkInDate)}
                        </strong>
                        <span>From 14:00 WIB</span>
                      </div>
                      <div>
                        <small>Check-out</small>
                        <strong>
                          {dateLabel(detail.reservation.checkOutDate)}
                        </strong>
                        <span>Until 12:00 WIB</span>
                      </div>
                      <div>
                        <small>Duration</small>
                        <strong>
                          {detail.summary.nights}{" "}
                          {detail.summary.nights === 1 ? "Night" : "Nights"}
                        </strong>
                      </div>
                      <div>
                        <small>Total Guests</small>
                        <strong>{detail.reservation.adults} Adults</strong>
                        <span>{detail.reservation.children} Children</span>
                      </div>
                    </div>
                  ) : (
                    <div className="reservation-detail-info-grid">
                      <Info
                        name="Check-in"
                        value={dateLabel(detail.reservation.checkInDate)}
                      />
                      <Info
                        name="Check-out"
                        value={dateLabel(detail.reservation.checkOutDate)}
                      />
                      <Info
                        name="Total Guests"
                        value={`${detail.reservation.adults} Adults · ${detail.reservation.children} Children`}
                      />
                    </div>
                  )}
                  {detail.reservation.specialRequests && (
                    <p className="reservation-detail-note">
                      <strong>Special Requests: </strong>
                      {detail.reservation.specialRequests}
                    </p>
                  )}
                  {detail.reservation.internalNotes && (
                    <p className="reservation-detail-note">
                      <strong>Internal Notes: </strong>
                      {detail.reservation.internalNotes}
                    </p>
                  )}
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>
                      {isInHouse
                        ? "Assigned Room & Configuration"
                        : "Room Allocation & Rate"}
                    </h2>
                    <span>
                      {detail.rooms.length}{" "}
                      {detail.rooms.length === 1 ? "Room" : "Rooms"}
                    </span>
                  </div>
                  {isPreStay &&
                    detail.rooms.some((room) => !room.roomNumber) && (
                      <div className="pending-detail-lock">
                        Room numbers are assigned during check-in.
                      </div>
                    )}
                  <div className="pending-detail-table-scroll">
                    <table className="pending-detail-table api-reservation-room-table">
                      <thead>
                        <tr>
                          <th>Room Type</th>
                          <th>Room No.</th>
                          <th>Guests</th>
                          <th>Nights</th>
                          <th>Room Rate</th>
                          <th>Extra Bed</th>
                          {isInHouse && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.rooms.map((room) => (
                          <Fragment key={room.id}>
                            <tr>
                              <td>
                                <strong>{room.roomTypeNameSnapshot}</strong>
                              </td>
                              <td>
                                {room.roomNumber ?? (
                                  <span className="pending-detail-locked-badge">
                                    Not Assigned
                                  </span>
                                )}
                              </td>
                              <td>
                                {room.adults} Adults
                                {room.children
                                  ? ` · ${room.children} Children`
                                  : ""}
                              </td>
                              <td>{room.nights.length}</td>
                              <td>
                                {rupiah(
                                  room.nights.reduce(
                                    (sum, night) => sum + night.finalPrice,
                                    0,
                                  ),
                                )}
                              </td>
                              <td>
                                {room.extraBeds.some((bed) => bed.dateTo === detail.reservation.checkOutDate)
                                  ? `${room.extraBeds.filter((bed) => bed.dateTo === detail.reservation.checkOutDate).reduce((sum, bed) => sum + bed.quantity, 0)} Bed`
                                  : "—"}
                              </td>
                              {isInHouse && (
                                <td>
                                  <ReservationRoomOperations detail={detail} room={room} onUpdated={onUpdated} />
                                </td>
                              )}
                            </tr>
                            {room.extraBeds.map((bed) => (
                              <tr
                                className="api-reservation-bed-row"
                                key={bed.id}
                              >
                                <td colSpan={isInHouse ? 7 : 6}>
                                  ↳{" "}
                                  <strong>
                                    Extra Bed (
                                    {room.roomNumber
                                      ? `Room ${room.roomNumber}`
                                      : room.roomTypeNameSnapshot}
                                    )
                                  </strong>{" "}
                                  · {bed.quantity} Bed ·{" "}
                                  {dateLabel(bed.dateFrom)} –{" "}
                                  {dateLabel(bed.dateTo)} (
                                  {stayNights(bed.dateFrom, bed.dateTo)} Nights
                                  @ {rupiah(bed.unitPricePerNight)}) ={" "}
                                  <strong>
                                    {rupiah(
                                      bed.quantity *
                                        stayNights(bed.dateFrom, bed.dateTo) *
                                        bed.unitPricePerNight,
                                    )}
                                  </strong>
                                </td>
                              </tr>
                            ))}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {detail.appliedCampaigns?.length > 0 && (
                  <section>
                    <div className="reservation-detail-section-title">
                      <h2>Campaign &amp; Discount</h2>
                    </div>
                    {detail.appliedCampaigns.map((campaign) => (
                      <div className="reservation-detail-row" key={campaign.id}>
                        <span>
                          {campaign.name}
                          {campaign.promoCode ? ` · ${campaign.promoCode}` : ""}
                        </span>
                        <strong>
                          −
                          {rupiah(
                            detail.rooms.reduce(
                              (total, room) =>
                                total +
                                room.nights.reduce(
                                  (sum, night) =>
                                    sum +
                                    (night.campaignSnapshot?.id === campaign.id
                                      ? night.discountAmount
                                      : 0),
                                  0,
                                ),
                              0,
                            ),
                          )}
                        </strong>
                      </div>
                    ))}
                  </section>
                )}

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>Experiences & Add-ons</h2>
                  </div>
                  {detail.experiences.map((item) => (
                    <div className="reservation-detail-row" key={item.id}>
                      <span>
                        {item.nameSnapshot} × {item.quantity}
                      </span>
                      <strong>{rupiah(item.quantity * item.unitPrice)}</strong>
                    </div>
                  ))}
                  {detail.experiences.length === 0 && (
                    <p className="reservation-empty">Belum ada add-on.</p>
                  )}
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>
                      {isPreStay && isOutstanding
                        ? "Charges & Folio"
                        : "Booking Payment"}
                    </h2>
                  </div>
                  <div className="api-reservation-financial-list">
                    {detail.charges.map((charge) => (
                      <div className="reservation-detail-row" key={charge.id}>
                        <span>{charge.description}</span>
                        <strong>{rupiah(charge.amount)}</strong>
                      </div>
                    ))}
                    {detail.charges.length === 0 && (
                      <p className="cell-muted">Belum ada tagihan.</p>
                    )}
                    <div className="reservation-detail-summary-divider" />
                    <SummaryRow name="Booking Total">
                      {rupiah(detail.summary.bookingTotal)}
                    </SummaryRow>
                    <SummaryRow name="Total Paid">
                      {rupiah(detail.summary.paidAmount)}
                    </SummaryRow>
                    <div className="pending-detail-balance">
                      <span>Remaining Balance (Outstanding)</span>
                      <strong>{rupiah(detail.summary.remainingBalance)}</strong>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>Payment History</h2>
                    <span>{detail.payments.length} Transactions</span>
                  </div>
                  <div className="pending-detail-history">
                    {detail.payments.map((payment) => (
                      <div key={payment.id}>
                        <div>
                          <strong>{rupiah(payment.amount)}</strong>
                          <span>
                            {payment.method?.name ?? "—"} ·{" "}
                            {label(payment.status)}
                          </span>
                        </div>
                        <small>{timeLabel(payment.paidAt)}</small>
                      </div>
                    ))}
                    {detail.payments.length === 0 && (
                      <div className="pending-detail-payment-empty">
                        <strong>
                          No payment has been recorded for this reservation.
                        </strong>
                      </div>
                    )}
                  </div>
                </section>

                {detail.deposits.length > 0 && (
                  <section>
                    <div className="reservation-detail-section-title">
                      <h2>Deposit</h2>
                    </div>
                    {detail.deposits.map((deposit) => (
                      <div
                        className="api-reservation-deposit-row"
                        key={deposit.id}
                      >
                        <div className="reservation-detail-row">
                          <span>Held · {deposit.method?.name ?? "—"}</span>
                          <strong>{rupiah(deposit.amountHeld)}</strong>
                        </div>
                        <div className="reservation-detail-row">
                          <span>Refunded / Deducted</span>
                          <strong>
                            {rupiah(deposit.amountRefunded)} /{" "}
                            {rupiah(deposit.amountDeducted)}
                          </strong>
                        </div>
                      </div>
                    ))}
                  </section>
                )}

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>Internal Notes</h2>
                  </div>
                  <p className="pending-detail-internal-note">
                    {detail.reservation.internalNotes ||
                      "No internal notes have been recorded."}
                  </p>
                </section>
              </div>

              <aside className="reservation-detail-summary">
                <div className="reservation-detail-section-title">
                  <h2>
                    {reservation?.reservationStatus === "checked_in" ||
                    reservation?.reservationStatus === "checked_out"
                      ? "Stay Summary"
                      : "Reservation Summary"}
                  </h2>
                  <span>{detail.summary.nights} Night</span>
                </div>
                <div className="reservation-detail-summary-rows">
                  <SummaryRow name="Guest">{detail.guest.fullName}</SummaryRow>
                  <SummaryRow name="Stay Period">
                    {dateLabel(detail.reservation.checkInDate)} →{" "}
                    {dateLabel(detail.reservation.checkOutDate)}
                  </SummaryRow>
                  <SummaryRow name="Room Types">
                    {detail.rooms
                      .map((room) => room.roomTypeNameSnapshot)
                      .join(", ")}
                  </SummaryRow>
                  <SummaryRow name="Room Numbers">
                    {detail.rooms
                      .map((room) => room.roomNumber || "Not Assigned")
                      .join(", ")}
                  </SummaryRow>
                  <div className="reservation-detail-summary-divider" />
                  <SummaryRow name="Booking Total">
                    {rupiah(detail.summary.bookingTotal)}
                  </SummaryRow>
                  <SummaryRow name="Paid Amount">
                    {rupiah(detail.summary.paidAmount)}
                  </SummaryRow>
                  <SummaryRow name="Remaining Balance">
                    {rupiah(detail.summary.remainingBalance)}
                  </SummaryRow>
                  {detail.deposits.length > 0 && (
                    <SummaryRow name="Deposit Balance">
                      {rupiah(detail.summary.depositBalance)}
                    </SummaryRow>
                  )}
                  <SummaryRow name="Payment Status">
                    <StatusBadge value={detail.reservation.paymentStatus} />
                  </SummaryRow>
                  <SummaryRow name="Reservation Status">
                    <StatusBadge value={detail.reservation.reservationStatus} />
                  </SummaryRow>
                  {isPreStay && isOutstanding && (
                    <p className="pending-detail-summary-warning">
                      {reservation?.reservationStatus === "pending"
                        ? "Reservasi menunggu konfirmasi. Sisa tagihan tetap tercatat."
                        : "Check-in memerlukan konfirmasi petugas atas sisa tagihan."}
                    </p>
                  )}
                </div>
                <ReservationDetailActions
                  detail={detail}
                  onUpdated={onUpdated}
                />
              </aside>
            </div>
            <ReservationAuditTrail history={history} />
          </>
        )}
      </div>
    </AdminShell>
  );
}
