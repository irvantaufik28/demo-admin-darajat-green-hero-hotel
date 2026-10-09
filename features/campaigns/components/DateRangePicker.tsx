"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "../../../components/ui/Icon";
import { useTranslations } from "../../../lib/i18n";
import "../styles/campaigns.css";
import enMessages from "../locales/en.json";
import idMessages from "../locales/id.json";

type DateRangePickerProps = {
  label: string;
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  disabled?: boolean;
  id?: string;
  minDate?: string;
  minNights?: number;
  fixedStart?: boolean;
};

const WEEKDAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function shiftMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + amount, 1))
    .toISOString()
    .slice(0, 7);
}

function monthDates(value: string) {
  const [year, month] = value.split("-").map(Number);
  const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const offset = (firstDay + 6) % 7;
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from(
    { length: Math.ceil((offset + count) / 7) * 7 },
    (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= count
        ? `${value}-${String(day).padStart(2, "0")}`
        : null;
    },
  );
}

export function DateRangePicker({
  label,
  start,
  end,
  onChange,
  disabled = false,
  id,
  minDate,
  minNights = 0,
  fixedStart = false,
}: DateRangePickerProps) {
  const { t } = useTranslations({ en: enMessages, id: idMessages });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(start.slice(0, 7) || "1970-01");
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 24);
      setPosition({
        top:
          rect.bottom + 6 + 360 > window.innerHeight
            ? Math.max(8, rect.top - 366)
            : rect.bottom + 6,
        left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)),
      });
    };
    const closeOnOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      )
        setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function toggle() {
    if (disabled) return;
    if (!open)
      setMonth(start.slice(0, 7) || new Date().toISOString().slice(0, 7));
    setOpen((current) => !current);
  }

  function select(date: string) {
    if (minDate && date < minDate) return;
    if (fixedStart) {
      if (date > start) {
        onChange(start, date);
        setOpen(false);
      }
      return;
    }
    if (!start || end) {
      onChange(date, "");
    } else {
      if (minNights > 0 && date === start) return;
      if (minNights > 0 && date < start) {
        onChange(date, "");
        return;
      }
      onChange(date < start ? date : start, date < start ? start : date);
      setOpen(false);
    }
  }

  const [year, monthNumber] = month.split("-").map(Number);
  const monthLabel = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));

  return (
    <>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="cf-range-trigger"
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        onClick={toggle}
      >
        <Icon name="calendar" width={16} height={16} />
        <span>
          {start ? formatDate(start) : t("dateRangePicker.startDate")} —{" "}
          {end ? formatDate(end) : t("dateRangePicker.endDate")}
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            className="cf-range-popover"
            style={position}
            role="dialog"
            aria-label={`${label} date range`}
          >
            <div className="cf-range-heading">
              <button
                type="button"
                aria-label={t("dateRangePicker.previousMonthAria")}
                disabled={Boolean(
                  minDate && shiftMonth(month, -1) < minDate.slice(0, 7),
                )}
                onClick={() => setMonth(shiftMonth(month, -1))}
              >
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button
                type="button"
                aria-label={t("dateRangePicker.nextMonthAria")}
                onClick={() => setMonth(shiftMonth(month, 1))}
              >
                ›
              </button>
            </div>
            <div className="cf-range-grid">
              {WEEKDAY_KEYS.map((day) => (
                <span className="cf-range-weekday" key={day}>
                  {t(`dateRangePicker.weekdays.${day}`)}
                </span>
              ))}
              {monthDates(month).map((date, index) =>
                date ? (
                  <button
                    type="button"
                    key={date}
                    className={`cf-range-day${date === start || date === end ? " cf-range-day--edge" : start && end && date > start && date < end ? " cf-range-day--inside" : ""}`}
                    disabled={Boolean(
                      (minDate && date < minDate) ||
                      (fixedStart && date <= start),
                    )}
                    aria-pressed={
                      date === start ||
                      date === end ||
                      Boolean(start && end && date > start && date < end)
                    }
                    onClick={() => select(date)}
                  >
                    {Number(date.slice(-2))}
                  </button>
                ) : (
                  <span key={`empty-${index}`} />
                ),
              )}
            </div>
            <div className="cf-range-footer">
              <span>
                {fixedStart
                  ? t("dateRangePicker.selectNewCheckout")
                  : start && !end
                    ? t("dateRangePicker.selectEndDate")
                    : t("dateRangePicker.selectStartAndEnd")}
              </span>
              {!fixedStart && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("", "");
                    setOpen(false);
                  }}
                >
                  {t("dateRangePicker.clear")}
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
