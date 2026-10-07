"use client";
import "../styles/rooms.css";

import { LoadingSkeleton } from "../../../components/ui/LoadingSkeleton";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminShell } from "../../../components/layout/AdminShell";
import { ApiError } from "../../../lib/api/client";
import { restoreSession } from "../../../lib/auth";
import {
  amenityGroups,
  type CapacityPattern,
  type RoomPhoto,
  type RoomTypeEntry,
} from "../constants/rooms-data";
import {
  createRoomType,
  getRoomType,
  getRoomTypeOptions,
  updateRoomType,
  uploadRoomPhoto,
  type MasterOption,
  type RoomTypeImage,
  type RoomTypeOptions,
  type RoomTypeRecord,
  type RoomTypeInput,
} from "../services/room-types";
import { useTranslations, type Translate } from "../../../lib/i18n";
import en from "../locales/en.json";
import id from "../locales/id.json";

const stepKeys = ["basicInfo", "photos", "amenities", "capacity"] as const;
const stepDescKeys = ["basicInfo", "photos", "amenities", "capacity"] as const;

const initialRoom: RoomTypeEntry = {
  id: "",
  name: "",
  description: "",
  active: true,
  size: 0,
  bedType: "",
  bedCount: 1,
  mealType: "",
  adultBreakfastPrice: 75000,
  childBreakfastPrice: 50000,
  extraBedEnabled: true,
  extraBedPrice: 200000,
  maxExtraBeds: 1,
  cover: null,
  gallery: [],
  amenities: [],
  capacityPatterns: [],
};

function mapRoomType(
  record: RoomTypeRecord,
  options: RoomTypeOptions,
): RoomTypeEntry {
  const selected = new Map(
    (record.capacityPatterns ?? []).map((pattern) => [
      pattern.capacityPatternId,
      pattern.extraBeds,
    ]),
  );
  const photos = (record.images ?? []).map((image, index): RoomPhoto => ({
    id: `${image.url}-${index}`,
    name: image.altText || `Room photo ${index + 1}`,
    url: image.url,
    size: "",
    altText: image.altText,
  }));
  const coverIndex = (record.images ?? []).findIndex((image) => image.isCover);
  return {
    id: record.id,
    name: record.name,
    description: record.description ?? "",
    active: record.isActive,
    size: Number(record.sizeSqm ?? 0),
    bedType: record.bedTypeId ?? "",
    bedCount: record.bedCount,
    mealType: record.mealTypeId ?? "",
    adultBreakfastPrice: record.adultBreakfastPrice,
    childBreakfastPrice: record.childBreakfastPrice,
    extraBedEnabled: record.extraBedEnabled,
    extraBedPrice: record.extraBedPricePerNight,
    maxExtraBeds: record.maxExtraBeds,
    cover: coverIndex >= 0 ? photos[coverIndex] : null,
    gallery: photos.filter((_, index) => index !== coverIndex),
    amenities: (record.amenities ?? []).map((item) => item.id),
    capacityPatterns: options.capacities.map((pattern) => ({
      id: pattern.id,
      adults: pattern.adults,
      children: pattern.children,
      selected: selected.has(pattern.id),
      extraBeds: selected.get(pattern.id) ?? 0,
    })),
  };
}

function toInput(
  room: RoomTypeEntry,
  original: RoomTypeRecord | null,
  images: RoomTypeImage[],
): RoomTypeInput {
  return {
    name: room.name.trim(),
    description: room.description.trim() || null,
    sizeSqm: String(room.size),
    bedTypeId: room.bedType || null,
    mealTypeId: room.mealType || null,
    viewTypeId: original?.viewTypeId ?? null,
    bedCount: room.bedCount,
    extraBedEnabled: room.extraBedEnabled,
    maxExtraBeds: room.extraBedEnabled ? room.maxExtraBeds : 0,
    extraBedPricePerNight: room.extraBedEnabled ? room.extraBedPrice : 0,
    adultBreakfastPrice: room.adultBreakfastPrice,
    childBreakfastPrice: room.childBreakfastPrice,
    amenityIds: room.amenities,
    capacityPatterns: room.capacityPatterns
      .filter((pattern) => pattern.selected)
      .map((pattern) => ({
        capacityPatternId: pattern.id!,
        extraBeds: room.extraBedEnabled
          ? Math.min(pattern.extraBeds, room.maxExtraBeds)
          : 0,
      })),
    images,
    ...(original === null || room.active !== original.isActive
      ? { isActive: room.active }
      : {}),
  };
}

async function prepareRoomImages(
  room: RoomTypeEntry,
  uploadedUrls: Map<string, string>,
): Promise<RoomTypeImage[]> {
  const photos = [room.cover, ...room.gallery].filter(
    (photo): photo is RoomPhoto => photo !== null,
  );
  const uniquePhotos = photos.filter(
    (photo, index) => photos.findIndex((item) => item.id === photo.id) === index,
  );
  return Promise.all(
    uniquePhotos.map(async (photo, index) => {
      let url = uploadedUrls.get(photo.id) ?? photo.url;
      if (photo.file && !uploadedUrls.has(photo.id)) {
        url = await uploadRoomPhoto(photo.file);
        uploadedUrls.set(photo.id, url);
      }
      return {
        url,
        altText: photo.altText ?? photo.name,
        isCover: photo.id === room.cover?.id,
        sortOrder: index,
      };
    }),
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="room-wizard-field">
      <span>
        {label}
        {required && <b> *</b>}
      </span>
      {children}
    </label>
  );
}

function BasicInfo({
  room,
  update,
  options,
  t,
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  options: RoomTypeOptions;
  t: Translate;
}) {
  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <h2>{t("wizard.basic.sectionTitle")}</h2>
          <div
            className="room-wizard-status-toggle"
            aria-label={t("wizard.basic.statusToggleAriaLabel")}
          >
            <button
              type="button"
              className={room.active ? "is-active" : ""}
              onClick={() => update({ active: true })}
            >
              ● {t("wizard.basic.active")}
            </button>
            <button
              type="button"
              className={!room.active ? "is-inactive" : ""}
              onClick={() => update({ active: false })}
            >
              ● {t("wizard.basic.inactive")}
            </button>
          </div>
        </div>
        <Field label={t("wizard.basic.nameLabel")} required>
          <input
            value={room.name}
            maxLength={100}
            onChange={(event) => update({ name: event.target.value })}
            placeholder={t("wizard.basic.namePlaceholder")}
          />
        </Field>
        <Field label={t("wizard.basic.descriptionLabel")}>
          <textarea
            value={room.description}
            maxLength={1000}
            rows={3}
            onChange={(event) => update({ description: event.target.value })}
            placeholder={t("wizard.basic.descriptionPlaceholder")}
          />
          <small className="room-wizard-field-note">
            {t("wizard.basic.descriptionCounter", { count: room.description.length })}
          </small>
        </Field>
      </section>

      <section className="room-wizard-section">
        <h2>{t("wizard.basic.specificationTitle")}</h2>
        <div className="room-wizard-field-grid">
          <Field label={t("wizard.basic.roomSizeLabel")} required>
            <input
              type="number"
              min="1"
              value={room.size}
              onChange={(event) => update({ size: Number(event.target.value) })}
            />
          </Field>
          <Field label={t("wizard.basic.bedTypeLabel")}>
            <select
              value={room.bedType}
              onChange={(event) => update({ bedType: event.target.value })}
            >
              <option value="">{t("wizard.basic.bedTypePlaceholder")}</option>
              {options.bedTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("wizard.basic.numberOfBedsLabel")}>
            <input
              type="number"
              min="1"
              max="8"
              value={room.bedCount}
              onChange={(event) =>
                update({ bedCount: Number(event.target.value) })
              }
            />
          </Field>
        </div>
      </section>

      <section className="room-wizard-section">
        <h2>{t("wizard.basic.mealTypeTitle")}</h2>
        <p>{t("wizard.basic.mealTypeDescription")}</p>
        <div className="room-wizard-choice-grid">
          {options.mealTypes.map((item) => (
            <label
              className={
                room.mealType === item.id
                  ? "room-wizard-choice is-selected"
                  : "room-wizard-choice"
              }
              key={item.id}
            >
              <input
                type="radio"
                name="meal-type"
                checked={room.mealType === item.id}
                onChange={() => update({ mealType: item.id })}
              />
              <span>
                <strong>{item.name}</strong>
              </span>
            </label>
          ))}
        </div>
        {room.mealType &&
          !options.mealTypes
            .find((item) => item.id === room.mealType)
            ?.name.toLowerCase()
            .includes("room only") && (
            <div className="room-wizard-breakfast">
              <strong>{t("wizard.basic.breakfastDetailTitle")}</strong>
              <div className="room-wizard-field-grid room-wizard-field-grid--two">
                <Field label={t("wizard.basic.adultBreakfastPriceLabel")}>
                  <input
                    type="number"
                    min="0"
                    value={room.adultBreakfastPrice}
                    onChange={(event) =>
                      update({
                        adultBreakfastPrice: Number(event.target.value),
                      })
                    }
                  />
                </Field>
                <Field label={t("wizard.basic.childBreakfastPriceLabel")}>
                  <input
                    type="number"
                    min="0"
                    value={room.childBreakfastPrice}
                    onChange={(event) =>
                      update({
                        childBreakfastPrice: Number(event.target.value),
                      })
                    }
                  />
                </Field>
              </div>
            </div>
          )}
      </section>

      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <div>
            <h2>{t("wizard.basic.extraBedTitle")}</h2>
            <p>{t("wizard.basic.extraBedDescription")}</p>
          </div>
          <label className="room-wizard-switch">
            <input
              type="checkbox"
              checked={room.extraBedEnabled}
              onChange={(event) =>
                update({
                  extraBedEnabled: event.target.checked,
                  maxExtraBeds: event.target.checked
                    ? Math.max(1, room.maxExtraBeds)
                    : 0,
                })
              }
            />
            <span />
          </label>
        </div>
        {room.extraBedEnabled && (
          <div className="room-wizard-field-grid room-wizard-field-grid--two">
            <Field label={t("wizard.basic.extraBedPriceLabel")}>
              <input
                type="number"
                min="0"
                value={room.extraBedPrice}
                onChange={(event) =>
                  update({ extraBedPrice: Number(event.target.value) })
                }
              />
            </Field>
            <Field label={t("wizard.basic.maxExtraBedsLabel")}>
              <input
                type="number"
                min="1"
                max="4"
                value={room.maxExtraBeds}
                onChange={(event) =>
                  update({ maxExtraBeds: Number(event.target.value) })
                }
              />
            </Field>
          </div>
        )}
      </section>
    </div>
  );
}

function Photos({
  room,
  update,
  trackPreview,
  t,
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  trackPreview: (url: string) => void;
  t: Translate;
}) {
  const coverInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const [photoError, setPhotoError] = useState("");

  function toPhoto(file: File): RoomPhoto {
    const url = URL.createObjectURL(file);
    trackPreview(url);
    return {
      id: crypto.randomUUID(),
      name: file.name,
      url,
      size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
      file,
    };
  }

  function receiveFiles(
    event: ChangeEvent<HTMLInputElement>,
    target: "cover" | "gallery",
  ) {
    const files = Array.from(event.target.files ?? []);
    const invalid = files.find(
      (file) =>
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size > 4_000_000,
    );
    if (invalid) {
      setPhotoError(
        t("wizard.photos.error"),
      );
      event.target.value = "";
      return;
    }
    setPhotoError("");
    if (target === "cover" && files[0]) update({ cover: toPhoto(files[0]) });
    if (target === "gallery")
      update({
        gallery: [
          ...room.gallery,
          ...files.slice(0, 10 - room.gallery.length).map(toPhoto),
        ],
      });
    event.target.value = "";
  }

  function movePhoto(index: number, direction: number) {
    const next = [...room.gallery];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update({ gallery: next });
  }

  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <div>
            <h2>{t("wizard.photos.coverTitle")}</h2>
            <p>{t("wizard.photos.coverDescription")}</p>
          </div>
          <span className="room-wizard-count">
            {room.cover ? t("wizard.photos.preview") : t("wizard.photos.noPreview")}
          </span>
        </div>
        {room.cover ? (
          <div className="room-wizard-cover">
            <img src={room.cover.url} alt={t("wizard.photos.coverAlt")} />
            <div>
              <strong>{room.cover.name}</strong>
              <small>{t("wizard.photos.coverCaption", { size: room.cover.size })}</small>
              <div className="room-wizard-photo-actions">
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                >
                  {t("wizard.photos.replace")}
                </button>
                <button type="button" onClick={() => update({ cover: null })}>
                  {t("wizard.photos.remove")}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="room-wizard-cover-empty"
            onClick={() => coverInput.current?.click()}
          >
            <span>▧</span>
            <strong>{t("wizard.photos.uploadCover")}</strong>
            <small>{t("wizard.photos.coverHint")}</small>
          </button>
        )}
        <input
          ref={coverInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          hidden
          onChange={(event) => receiveFiles(event, "cover")}
        />
      </section>

      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <div>
            <h2>{t("wizard.photos.galleryTitle")}</h2>
            <p>{t("wizard.photos.galleryDescription")}</p>
          </div>
          <span className="room-wizard-count">
            {t("wizard.photos.galleryCount", { count: room.gallery.length })}
          </span>
        </div>
        <div className="room-wizard-gallery">
          {room.gallery.map((photo, index) => (
            <div className="room-wizard-photo" key={photo.id}>
              <img src={photo.url} alt={t("wizard.photos.photoAlt", { index: index + 1 })} />
              <span className="room-wizard-photo-index">{index + 1}</span>
              <div>
                <strong title={photo.name}>{photo.name}</strong>
                <small>{photo.size}</small>
              </div>
              <div className="room-wizard-photo-actions">
                <button
                  type="button"
                  onClick={() => movePhoto(index, -1)}
                  disabled={index === 0}
                  aria-label={t("wizard.photos.moveLeftAriaLabel", { name: photo.name })}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(index, 1)}
                  disabled={index === room.gallery.length - 1}
                  aria-label={t("wizard.photos.moveRightAriaLabel", { name: photo.name })}
                >
                  →
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      cover: photo,
                      gallery: [
                        ...room.gallery.filter((item) => item.id !== photo.id),
                        ...(room.cover ? [room.cover] : []),
                      ],
                    })
                  }
                >
                  {t("wizard.photos.setCover")}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    update({
                      gallery: room.gallery.filter(
                        (item) => item.id !== photo.id,
                      ),
                    })
                  }
                >
                  {t("wizard.photos.remove")}
                </button>
              </div>
            </div>
          ))}
          {room.gallery.length < 10 && (
            <button
              type="button"
              className="room-wizard-upload-tile"
              onClick={() => galleryInput.current?.click()}
            >
              <span>＋</span>
              <strong>{t("wizard.photos.uploadPhotos")}</strong>
              <small>{t("wizard.photos.galleryHint")}</small>
            </button>
          )}
        </div>
        <input
          ref={galleryInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          hidden
          onChange={(event) => receiveFiles(event, "gallery")}
        />
        {photoError && (
          <p className="room-wizard-error" role="alert">
            {photoError}
          </p>
        )}
      </section>
    </div>
  );
}

function Amenities({
  room,
  update,
  items,
  t,
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  items: MasterOption[];
  t: Translate;
}) {
  const [search, setSearch] = useState("");
  const matchedIds = new Set<string>();
  const groups = amenityGroups.map((group) => {
    const groupItems = items.filter((item) =>
      group.items.some(
        (name) => name.toLowerCase() === item.name.toLowerCase(),
      ),
    );
    groupItems.forEach((item) => matchedIds.add(item.id));
    return { title: group.title, items: groupItems };
  });
  const otherItems = items.filter((item) => !matchedIds.has(item.id));
  if (otherItems.length)
    groups.push({ title: t("wizard.amenities.otherAmenities"), items: otherItems });

  function toggle(item: string) {
    update({
      amenities: room.amenities.includes(item)
        ? room.amenities.filter((value) => value !== item)
        : [...room.amenities, item],
    });
  }

  function toggleGroup(items: string[]) {
    const allSelected = items.every((item) => room.amenities.includes(item));
    update({
      amenities: allSelected
        ? room.amenities.filter((item) => !items.includes(item))
        : [...new Set([...room.amenities, ...items])],
    });
  }

  return (
    <section className="room-wizard-section room-wizard-amenities">
      <div className="room-wizard-section-head">
        <div className="room-wizard-section-title-inline">
          <h2>{t("wizard.amenities.title")}</h2>
          <span className="room-wizard-count">
            {t("wizard.amenities.selectedCount", { count: room.amenities.length })}
          </span>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("wizard.amenities.searchPlaceholder")}
          aria-label={t("wizard.amenities.searchAriaLabel")}
        />
      </div>
      {groups.map((group) => {
        const visible = group.items.filter((item) =>
          item.name.toLowerCase().includes(search.toLowerCase()),
        );
        if (!visible.length) return null;
        return (
          <div className="room-wizard-amenity-group" key={group.title}>
            <div className="room-wizard-section-head">
              <h3>{group.title}</h3>
              <button
                type="button"
                onClick={() => toggleGroup(visible.map((item) => item.id))}
              >
                {t("wizard.amenities.selectAll")}
              </button>
            </div>
            <div className="room-wizard-amenity-grid">
              {visible.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={room.amenities.includes(item.id)}
                    onChange={() => toggle(item.id)}
                  />
                  {item.name}
                </label>
              ))}
            </div>
          </div>
        );
      })}
      {search &&
        !items.some((item) =>
          item.name.toLowerCase().includes(search.toLowerCase()),
        ) && (
          <p className="room-wizard-muted">{t("wizard.amenities.empty")}</p>
        )}
    </section>
  );
}

function Capacity({
  room,
  update,
  backToBasic,
  t,
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  backToBasic: () => void;
  t: Translate;
}) {
  const selectedCount = room.capacityPatterns.filter(
    (pattern) => pattern.selected,
  ).length;

  function updatePattern(index: number, values: Partial<CapacityPattern>) {
    update({
      capacityPatterns: room.capacityPatterns.map((pattern, current) =>
        current === index ? { ...pattern, ...values } : pattern,
      ),
    });
  }

  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-extra-summary">
          <div>
            <strong>{t("wizard.capacity.extraBedConfigTitle")}</strong>
            <small>
              {t("wizard.capacity.extraBedConfigHint", { count: room.extraBedEnabled ? room.maxExtraBeds : 0 })}
            </small>
          </div>
          <button type="button" onClick={backToBasic}>
            {t("wizard.capacity.step1Button")}
          </button>
        </div>
      </section>
      <section className="room-wizard-section">
        <h2>{t("wizard.capacity.patternsTitle")}</h2>
        <p>
          {t("wizard.capacity.patternsDescription")}
        </p>
        <div className="room-wizard-info">
          {t("wizard.capacity.info")}
        </div>
        <div className="room-wizard-capacity-head">
          <strong>{t("wizard.capacity.combinationHead")}</strong>
          <span>{t("wizard.capacity.selectedLabel", { count: selectedCount })}</span>
          <button
            type="button"
            onClick={() =>
              update({
                capacityPatterns: room.capacityPatterns.map((pattern) => ({
                  ...pattern,
                  selected: selectedCount !== room.capacityPatterns.length,
                })),
              })
            }
          >
            {t("wizard.capacity.selectAll")}
          </button>
        </div>
        <div className="room-wizard-capacity-scroll">
          <table className="room-wizard-capacity-table">
            <thead>
              <tr>
                <th>{t("wizard.capacity.table.select")}</th>
                <th>{t("wizard.capacity.table.combination")}</th>
                <th>{t("wizard.capacity.table.extraBed")}</th>
              </tr>
            </thead>
            <tbody>
              {room.capacityPatterns.map((pattern, index) => (
                <tr
                  key={`${pattern.adults}-${pattern.children}`}
                  className={pattern.selected ? "is-selected" : ""}
                >
                  <td>
                    <input
                      type="checkbox"
                      checked={pattern.selected}
                      onChange={(event) =>
                        updatePattern(index, { selected: event.target.checked })
                      }
                      aria-label={t("wizard.capacity.selectAriaLabel", { adults: pattern.adults, children: pattern.children })}
                    />
                  </td>
                  <td>
                    <strong>
                      {pattern.adults}{" "}
                      {pattern.adults === 1 ? t("wizard.capacity.adult") : t("wizard.capacity.adults")} +{" "}
                      {pattern.children}{" "}
                      {pattern.children === 1 ? t("wizard.capacity.child") : t("wizard.capacity.children")}
                    </strong>
                    <small>{t("wizard.capacity.personsCount", { count: pattern.adults + pattern.children })}</small>
                  </td>
                  <td>
                    <select
                      value={Math.min(
                        pattern.extraBeds,
                        room.extraBedEnabled ? room.maxExtraBeds : 0,
                      )}
                      onChange={(event) =>
                        updatePattern(index, {
                          extraBeds: Number(event.target.value),
                        })
                      }
                      disabled={!pattern.selected || !room.extraBedEnabled}
                      aria-label={t("wizard.capacity.extraBedAriaLabel", { adults: pattern.adults, children: pattern.children })}
                    >
                      {Array.from(
                        {
                          length: room.extraBedEnabled
                            ? room.maxExtraBeds + 1
                            : 1,
                        },
                        (_, count) => (
                          <option value={count} key={count}>
                            {t("wizard.capacity.extraBedOption", { count })}
                          </option>
                        ),
                      )}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="room-wizard-capacity-note">
          {t("wizard.capacity.note")}
        </p>
      </section>
    </div>
  );
}

export function AddRoomTypePage({ roomId }: { roomId?: string }) {
  const { t } = useTranslations({ en, id });
  const router = useRouter();
  const previewUrls = useRef<string[]>([]);
  const uploadedPhotoUrls = useRef(new Map<string, string>());
  const [step, setStep] = useState(0);
  const [visitedSteps, setVisitedSteps] = useState<number[]>([0]);
  const [room, setRoom] = useState<RoomTypeEntry>(initialRoom);
  const [options, setOptions] = useState<RoomTypeOptions | null>(null);
  const [original, setOriginal] = useState<RoomTypeRecord | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const title = roomId ? t("wizard.titleEdit") : t("wizard.titleAdd");

  useEffect(() => {
    return () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        if (!(await restoreSession())) return;
        const [formOptions, detail] = await Promise.all([
          getRoomTypeOptions(controller.signal),
          roomId
            ? getRoomType(roomId, controller.signal)
            : Promise.resolve(null),
        ]);
        if (controller.signal.aborted) return;
        setOptions(formOptions);
        if (detail) {
          setOriginal(detail.roomType);
          setRoom(mapRoomType(detail.roomType, formOptions));
        } else {
          setRoom({
            ...initialRoom,
            capacityPatterns: formOptions.capacities.map((pattern) => ({
              id: pattern.id,
              adults: pattern.adults,
              children: pattern.children,
              selected: false,
              extraBeds: 0,
            })),
          });
        }
        setStep(0);
        setVisitedSteps([0]);
      } catch (caught) {
        if (controller.signal.aborted) return;
        if (caught instanceof ApiError && caught.status === 404)
          setMissing(true);
        else
          setError(
            caught instanceof Error
              ? caught.message
              : t("wizard.messages.loadError"),
          );
      } finally {
        if (!controller.signal.aborted) setLoaded(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [roomId]);

  function update(values: Partial<RoomTypeEntry>) {
    setRoom((current) => ({ ...current, ...values }));
    setError("");
  }

  function validateBasic() {
    if (!room.name.trim()) return t("wizard.validation.nameRequired");
    if (!Number.isFinite(room.size) || room.size < 1)
      return t("wizard.validation.sizeInvalid");
    if (!room.bedType) return t("wizard.validation.bedTypeRequired");
    if (!room.mealType) return t("wizard.validation.mealTypeRequired");
    if (!Number.isInteger(room.bedCount) || room.bedCount < 1)
      return t("wizard.validation.bedCountInvalid");
    if (
      room.extraBedEnabled &&
      (!Number.isInteger(room.maxExtraBeds) ||
        room.maxExtraBeds < 1 ||
        room.extraBedPrice < 0)
    )
      return t("wizard.validation.extraBedInvalid");
    if (room.adultBreakfastPrice < 0 || room.childBreakfastPrice < 0)
      return t("wizard.validation.breakfastNegative");
    return "";
  }

  function next() {
    if (step === 0) {
      const message = validateBasic();
      if (message) {
        setError(message);
        return;
      }
    }
    setError("");
    setVisitedSteps((current) => [...new Set([...current, step + 1])]);
    setStep((current) => current + 1);
  }

  async function save() {
    const basicError = validateBasic();
    if (basicError) {
      setStep(0);
      setError(basicError);
      return;
    }
    if (!room.capacityPatterns.some((pattern) => pattern.selected)) {
      setError(t("wizard.validation.capacityRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const images = await prepareRoomImages(room, uploadedPhotoUrls.current);
      const body = toInput(room, original, images);
      if (roomId) await updateRoomType(roomId, body);
      else await createRoomType(body);
      router.push("/rooms");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : t("wizard.messages.saveError"),
      );
    } finally {
      setSaving(false);
    }
  }

  if (missing) {
    return (
      <AdminShell title={t("shell.title")} context={title}>
        <div className="room-wizard-page">
          <h1>{t("wizard.messages.notFound")}</h1>
          <Link href="/rooms">← {t("wizard.messages.backToRoomTypes")}</Link>
        </div>
      </AdminShell>
    );
  }

  if (!loaded || !options) {
    return (
      <AdminShell title={t("shell.title")} context={title}>
        <div className="room-wizard-page">
          {error || <LoadingSkeleton variant="form" rows={8} />}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={t("shell.title")} context={title}>
      <div className="room-wizard-page">
        <div className="room-types-breadcrumb">
          <Link href="/rooms">{t("wizard.breadcrumbRooms")}</Link> /{" "}
          <Link href="/rooms">{t("wizard.breadcrumbRoomTypes")}</Link> / {title}
        </div>
        <div className="room-wizard-heading">
          <h1>{title}</h1>
          <p>
            {roomId
              ? t("wizard.editDescription", { name: room.name, step: t(`wizard.stepDescriptions.${stepDescKeys[step]}`).toLowerCase() })
              : t(`wizard.stepDescriptions.${stepDescKeys[step]}`)}
          </p>
        </div>
        <nav className="room-wizard-steps" aria-label={t("wizard.stepsNavAriaLabel")}>
          {stepKeys.map((name, index) => (
            <button
              type="button"
              key={name}
              className={
                index === step
                  ? "is-current"
                  : visitedSteps.includes(index)
                    ? "is-complete"
                    : ""
              }
              onClick={() => {
                setStep(index);
                setVisitedSteps((current) => [...new Set([...current, index])]);
                setError("");
              }}
              aria-current={index === step ? "step" : undefined}
            >
              <span>{index + 1}</span>
              <strong>{t(`wizard.steps.${name}`)}</strong>
              <small>
                {index === step
                  ? t("wizard.stepStatus.inProgress")
                  : visitedSteps.includes(index)
                    ? t("wizard.stepStatus.visited")
                    : t("wizard.stepStatus.notVisited")}
              </small>
            </button>
          ))}
        </nav>

        <div className="room-wizard-content">
          {step === 0 && (
            <BasicInfo room={room} update={update} options={options} t={t} />
          )}
          {step === 1 && (
            <Photos
              room={room}
              update={update}
              trackPreview={(url) => previewUrls.current.push(url)}
              t={t}
            />
          )}
          {step === 2 && (
            <Amenities room={room} update={update} items={options.amenities} t={t} />
          )}
          {step === 3 && (
            <Capacity
              room={room}
              update={update}
              backToBasic={() => setStep(0)}
              t={t}
            />
          )}
        </div>
        {error && (
          <p className="room-wizard-error" role="alert">
            {error}
          </p>
        )}
        <div className="room-wizard-footer">
          {step === 0 ? (
            <Link href="/rooms" className="room-wizard-secondary">
              {t("wizard.footer.cancel")}
            </Link>
          ) : (
            <button
              type="button"
              className="room-wizard-secondary"
              onClick={() => {
                setStep((current) => current - 1);
                setError("");
              }}
            >
              ← {t("wizard.footer.previous", { step: t(`wizard.steps.${stepKeys[step - 1]}`) })}
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="action-button" onClick={next}>
              {t("wizard.footer.next", { step: t(`wizard.steps.${stepKeys[step + 1]}`) })} →
            </button>
          ) : (
            <button
              type="button"
              className="action-button"
              onClick={() => void save()}
              disabled={saving}
            >
              ◉{" "}
              {saving
                ? t("wizard.footer.saving")
                : roomId
                  ? t("wizard.footer.saveChanges")
                  : t("wizard.footer.saveRoomType")}
            </button>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
