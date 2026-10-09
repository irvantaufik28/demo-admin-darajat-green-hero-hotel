"use client";
import "../../dashboard/styles/dashboard.css";
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
import {
  noShowSettlementPresentation,
  reservationDetailPresentation,
} from "../utils/detail-rules";
import { restoreSession } from "../../../lib/auth";
import { useTranslations } from "../../../lib/i18n";
import en from "../locales/en.json";
import idLocale from "../locales/id.json";

const labels: Record<string, string> = {
  walk_in: "Walk-in",
  website: "Website",
  phone: "Phone",
  ota: "OTA",
  pending: "Pending",
  confirmed: "Confirmed",
  checked_in: "Checked-in",
  checked_out: "Checked-out",
  no_show: "No Show",
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
              value === "no_show" ||
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
  const { t } = useTranslations({ en, id: idLocale });
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
            cause instanceof Error ? cause.message : t("detail.loadError"),
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
  const noShowSettlement =
    detail?.reservation.reservationStatus === "no_show"
      ? noShowSettlementPresentation(detail)
      : null;

  return (
    <AdminShell
      title={t("shell.title")}
      context={reservation?.bookingCode ?? t("shell.reservationDetail")}
    >
      <div
        className={`reservation-detail-page api-reservation-detail-page${isPreStay && isOutstanding ? " api-reservation-detail-page--phone-unpaid" : ""}${isInHouse ? " api-reservation-detail-page--in-house" : ""}`}
      >
        <header className="reservation-detail-heading">
          <div>
            <div className="reservation-detail-title">
              <h1>
                {isInHouse
                  ? t("detail.guestStay")
                  : t("detail.reservationDetail")}
              </h1>
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
                  ? t("detail.createdViaPhone")
                  : t("detail.sourcePrefix", {
                      source: label(reservation.source),
                    })}
              </p>
            )}
          </div>
          <Link href="/reservations" className="reservation-secondary-button">
            ← {t("detail.allReservations")}
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
              aria-label={t("common.closeMessage")}
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
                      ? t("detail.holdActive")
                      : t("detail.outstandingBalance")}
                  </strong>{" "}
                  {reservation?.reservationStatus === "pending"
                    ? t("detail.holdPendingMessage")
                    : t("detail.holdConfirmedMessage", {
                        amount: rupiah(detail.summary.remainingBalance),
                      })}
                </div>
                <span>
                  {reservation?.paymentStatus === "partial"
                    ? t("detail.partialPayment")
                    : t("detail.awaitingPayment")}
                </span>
              </div>
            )}

            <div className="reservation-detail-columns">
              <div className="reservation-detail-content">
                <section>
                  <div className="reservation-detail-section-title">
                    <h2>{t("detail.sections.guestInformation")}</h2>
                    <span>{t("detail.sections.primaryContact")}</span>
                  </div>
                  <div className="reservation-detail-info-grid">
                    <Info
                      name={t("detail.fields.fullName")}
                      value={detail.guest.fullName}
                    />
                    <Info
                      name={t("detail.fields.whatsappPhone")}
                      value={detail.guest.phone}
                    />
                    <Info
                      name={t("detail.fields.email")}
                      value={detail.guest.email ?? t("common.emptyDash")}
                    />
                  </div>
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>{t("detail.sections.stayDetails")}</h2>
                    <span>
                      {t("detail.sections.nightStay", {
                        nights: detail.summary.nights,
                      })}
                    </span>
                  </div>
                  {isPreStay && isOutstanding ? (
                    <div className="pending-detail-stay-grid">
                      <div>
                        <small>{t("detail.fields.checkIn")}</small>
                        <strong>
                          {dateLabel(detail.reservation.checkInDate)}
                        </strong>
                        <span>{t("detail.fields.fromTime")}</span>
                      </div>
                      <div>
                        <small>{t("detail.fields.checkOut")}</small>
                        <strong>
                          {dateLabel(detail.reservation.checkOutDate)}
                        </strong>
                        <span>{t("detail.fields.untilTime")}</span>
                      </div>
                      <div>
                        <small>{t("detail.fields.duration")}</small>
                        <strong>
                          {detail.summary.nights}{" "}
                          {detail.summary.nights === 1
                            ? t("common.night")
                            : t("common.nights")}
                        </strong>
                      </div>
                      <div>
                        <small>{t("detail.fields.totalGuests")}</small>
                        <strong>
                          {t("detail.rooms.adults", {
                            count: detail.reservation.adults,
                          })}
                        </strong>
                        <span>
                          {detail.reservation.children} {t("common.children")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="reservation-detail-info-grid">
                      <Info
                        name={t("detail.fields.checkIn")}
                        value={dateLabel(detail.reservation.checkInDate)}
                      />
                      <Info
                        name={t("detail.fields.checkOut")}
                        value={dateLabel(detail.reservation.checkOutDate)}
                      />
                      <Info
                        name={t("detail.fields.totalGuests")}
                        value={t("detail.fields.adultsChildren", {
                          adults: detail.reservation.adults,
                          children: detail.reservation.children,
                        })}
                      />
                    </div>
                  )}
                  {detail.reservation.specialRequests && (
                    <p className="reservation-detail-note">
                      <strong>{t("detail.fields.specialRequests")}</strong>
                      {detail.reservation.specialRequests}
                    </p>
                  )}
                  {detail.reservation.internalNotes && (
                    <p className="reservation-detail-note">
                      <strong>{t("detail.fields.internalNotes")}</strong>
                      {detail.reservation.internalNotes}
                    </p>
                  )}
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>
                      {isInHouse
                        ? t("detail.sections.assignedRoomConfig")
                        : t("detail.sections.roomAllocationRate")}
                    </h2>
                    <span>
                      {detail.rooms.length === 1
                        ? t("detail.sections.roomCountSingle")
                        : t("detail.sections.roomsCount", {
                            count: detail.rooms.length,
                          })}
                    </span>
                  </div>
                  {isPreStay &&
                    detail.rooms.some((room) => !room.roomNumber) && (
                      <div className="pending-detail-lock">
                        {t("detail.rooms.assignedAtCheckIn")}
                      </div>
                    )}
                  <div className="pending-detail-table-scroll">
                    <table className="pending-detail-table api-reservation-room-table">
                      <thead>
                        <tr>
                          <th>{t("detail.rooms.roomType")}</th>
                          <th>{t("detail.rooms.roomNo")}</th>
                          <th>{t("detail.rooms.guests")}</th>
                          <th>{t("detail.rooms.nights")}</th>
                          <th>{t("detail.rooms.roomRate")}</th>
                          <th>{t("detail.rooms.extraBed")}</th>
                          {isInHouse && <th>{t("detail.rooms.actions")}</th>}
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
                                    {t("detail.rooms.notAssigned")}
                                  </span>
                                )}
                              </td>
                              <td>
                                {t("detail.rooms.adults", {
                                  count: room.adults,
                                })}
                                {room.children
                                  ? t("detail.rooms.childrenSuffix", {
                                      count: room.children,
                                    })
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
                                {room.extraBeds.some(
                                  (bed) =>
                                    bed.dateTo ===
                                    detail.reservation.checkOutDate,
                                )
                                  ? t("detail.rooms.bed", {
                                      count: room.extraBeds
                                        .filter(
                                          (bed) =>
                                            bed.dateTo ===
                                            detail.reservation.checkOutDate,
                                        )
                                        .reduce(
                                          (sum, bed) => sum + bed.quantity,
                                          0,
                                        ),
                                    })
                                  : t("common.emptyDash")}
                              </td>
                              {isInHouse && (
                                <td>
                                  <ReservationRoomOperations
                                    detail={detail}
                                    room={room}
                                    onUpdated={onUpdated}
                                  />
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
                                    {t("detail.rooms.extraBedLine", {
                                      room: room.roomNumber
                                        ? t("roomRack.newBooking.room", {
                                            roomNumber: room.roomNumber,
                                          })
                                        : room.roomTypeNameSnapshot,
                                    })}
                                  </strong>{" "}
                                  ·{" "}
                                  {t("detail.rooms.extraBedDetail", {
                                    quantity: bed.quantity,
                                    from: dateLabel(bed.dateFrom),
                                    to: dateLabel(bed.dateTo),
                                    nights: stayNights(
                                      bed.dateFrom,
                                      bed.dateTo,
                                    ),
                                    rate: rupiah(bed.unitPricePerNight),
                                  })}{" "}
                                  ={" "}
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
                      <h2>{t("detail.sections.campaignDiscount")}</h2>
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
                    <h2>{t("detail.sections.experiencesAddOns")}</h2>
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
                    <p className="reservation-empty">
                      {t("detail.experiences.empty")}
                    </p>
                  )}
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>
                      {isPreStay && isOutstanding
                        ? t("detail.sections.chargesFolio")
                        : t("detail.sections.bookingPayment")}
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
                      <p className="cell-muted">{t("detail.charges.empty")}</p>
                    )}
                    <div className="reservation-detail-summary-divider" />
                    <SummaryRow name={t("detail.fields.bookingTotal")}>
                      {rupiah(detail.summary.bookingTotal)}
                    </SummaryRow>
                    <SummaryRow name={t("detail.fields.totalPaid")}>
                      {rupiah(detail.summary.paidAmount)}
                    </SummaryRow>
                    <div className="pending-detail-balance">
                      <span>
                        {t("detail.fields.remainingBalanceOutstanding")}
                      </span>
                      <strong>{rupiah(detail.summary.remainingBalance)}</strong>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="reservation-detail-section-title">
                    <h2>{t("detail.sections.paymentHistory")}</h2>
                    <span>
                      {t("detail.sections.transactions", {
                        count: detail.payments.length,
                      })}
                    </span>
                  </div>
                  <div className="pending-detail-history">
                    {detail.payments.map((payment) => (
                      <div key={payment.id}>
                        <div>
                          <strong>{rupiah(payment.amount)}</strong>
                          <span>
                            {payment.method?.name ?? t("common.emptyDash")} ·{" "}
                            {label(payment.status)}
                          </span>
                        </div>
                        <small>{timeLabel(payment.paidAt)}</small>
                      </div>
                    ))}
                    {detail.payments.length === 0 && (
                      <div className="pending-detail-payment-empty">
                        <strong>{t("detail.payment.empty")}</strong>
                      </div>
                    )}
                  </div>
                </section>

                {detail.deposits.length > 0 && (
                  <section>
                    <div className="reservation-detail-section-title">
                      <h2>{t("detail.sections.deposit")}</h2>
                    </div>
                    {detail.deposits.map((deposit) => (
                      <div
                        className="api-reservation-deposit-row"
                        key={deposit.id}
                      >
                        <div className="reservation-detail-row">
                          <span>
                            {t("detail.depositRow.held", {
                              method:
                                deposit.method?.name ?? t("common.emptyDash"),
                            })}
                          </span>
                          <strong>{rupiah(deposit.amountHeld)}</strong>
                        </div>
                        <div className="reservation-detail-row">
                          <span>{t("detail.depositRow.refundedDeducted")}</span>
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
                    <h2>{t("detail.sections.internalNotes")}</h2>
                  </div>
                  <p className="pending-detail-internal-note">
                    {detail.reservation.internalNotes ||
                      t("detail.internalNotesEmpty")}
                  </p>
                </section>
              </div>

              <aside className="reservation-detail-summary">
                <div className="reservation-detail-section-title">
                  <h2>
                    {reservation?.reservationStatus === "checked_in" ||
                    reservation?.reservationStatus === "checked_out"
                      ? t("detail.sections.staySummary")
                      : t("detail.sections.stickySummary")}
                  </h2>
                  <span>
                    {t("detail.sections.nightLabel", {
                      nights: detail.summary.nights,
                    })}
                  </span>
                </div>
                <div className="reservation-detail-summary-rows">
                  <SummaryRow name={t("detail.fields.guest")}>
                    {detail.guest.fullName}
                  </SummaryRow>
                  <SummaryRow name={t("detail.fields.stayPeriod")}>
                    {dateLabel(detail.reservation.checkInDate)} →{" "}
                    {dateLabel(detail.reservation.checkOutDate)}
                  </SummaryRow>
                  <SummaryRow name={t("detail.fields.roomTypes")}>
                    {detail.rooms
                      .map((room) => room.roomTypeNameSnapshot)
                      .join(", ")}
                  </SummaryRow>
                  <SummaryRow name={t("detail.fields.roomNumbers")}>
                    {detail.rooms
                      .map(
                        (room) =>
                          room.roomNumber || t("detail.rooms.notAssigned"),
                      )
                      .join(", ")}
                  </SummaryRow>
                  <div className="reservation-detail-summary-divider" />
                  <SummaryRow name={t("detail.fields.bookingTotal")}>
                    {rupiah(detail.summary.bookingTotal)}
                  </SummaryRow>
                  <SummaryRow name={t("detail.fields.paidAmount")}>
                    {rupiah(detail.summary.paidAmount)}
                  </SummaryRow>
                  <SummaryRow name={t("detail.fields.remainingBalance")}>
                    {rupiah(detail.summary.remainingBalance)}
                  </SummaryRow>
                  {detail.deposits.length > 0 && (
                    <SummaryRow name={t("detail.fields.depositBalance")}>
                      {rupiah(detail.summary.depositBalance)}
                    </SummaryRow>
                  )}
                  <SummaryRow name={t("detail.fields.paymentStatus")}>
                    <StatusBadge value={detail.reservation.paymentStatus} />
                  </SummaryRow>
                  <SummaryRow name={t("detail.fields.reservationStatus")}>
                    <StatusBadge value={detail.reservation.reservationStatus} />
                  </SummaryRow>
                  {noShowSettlement && (
                    <SummaryRow name={t("detail.fields.settlement")}>
                      {noShowSettlement.label}
                    </SummaryRow>
                  )}
                  {isPreStay && isOutstanding && (
                    <p className="pending-detail-summary-warning">
                      {reservation?.reservationStatus === "pending"
                        ? t("detail.summaryWarningPending")
                        : t("detail.summaryWarningConfirmed")}
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
