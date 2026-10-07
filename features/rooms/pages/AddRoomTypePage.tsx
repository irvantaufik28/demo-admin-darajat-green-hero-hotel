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

const steps = ["Basic Info", "Photos", "Amenities", "Capacity"] as const;
const descriptions = [
  "Tambahkan informasi dasar tipe kamar",
  "Tambahkan foto untuk tipe kamar",
  "Pilih fasilitas yang tersedia untuk tipe kamar ini",
  "Atur kapasitas tamu untuk tipe kamar",
];

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
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  options: RoomTypeOptions;
}) {
  return (
    <div className="room-wizard-sections">
      <section className="room-wizard-section">
        <div className="room-wizard-section-head">
          <h2>Basic Information</h2>
          <div
            className="room-wizard-status-toggle"
            aria-label="Room type status"
          >
            <button
              type="button"
              className={room.active ? "is-active" : ""}
              onClick={() => update({ active: true })}
            >
              ● Active
            </button>
            <button
              type="button"
              className={!room.active ? "is-inactive" : ""}
              onClick={() => update({ active: false })}
            >
              ● Inactive
            </button>
          </div>
        </div>
        <Field label="Room Type Name" required>
          <input
            value={room.name}
            maxLength={100}
            onChange={(event) => update({ name: event.target.value })}
            placeholder="Enter room type name"
          />
        </Field>
        <Field label="Description">
          <textarea
            value={room.description}
            maxLength={1000}
            rows={3}
            onChange={(event) => update({ description: event.target.value })}
            placeholder="Describe the room"
          />
          <small className="room-wizard-field-note">
            {room.description.length} / 1000
          </small>
        </Field>
      </section>

      <section className="room-wizard-section">
        <h2>Room Specification</h2>
        <div className="room-wizard-field-grid">
          <Field label="Room Size (m²)" required>
            <input
              type="number"
              min="1"
              value={room.size}
              onChange={(event) => update({ size: Number(event.target.value) })}
            />
          </Field>
          <Field label="Bed Type">
            <select
              value={room.bedType}
              onChange={(event) => update({ bedType: event.target.value })}
            >
              <option value="">Select bed type</option>
              {options.bedTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Number of Beds">
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
        <h2>Meal Type</h2>
        <p>Pilih paket makanan standar untuk tarif dasar kamar.</p>
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
              <strong>Rincian Tambahan Sarapan</strong>
              <div className="room-wizard-field-grid room-wizard-field-grid--two">
                <Field label="Adult Breakfast Price">
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
                <Field label="Child Breakfast Price">
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
            <h2>Extra Bed</h2>
            <p>Izinkan kasur tambahan untuk tipe kamar ini.</p>
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
            <Field label="Extra Bed Price / night">
              <input
                type="number"
                min="0"
                value={room.extraBedPrice}
                onChange={(event) =>
                  update({ extraBedPrice: Number(event.target.value) })
                }
              />
            </Field>
            <Field label="Maximum Extra Beds">
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
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  trackPreview: (url: string) => void;
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
        "Gunakan foto PNG, JPG, atau WebP dengan ukuran maksimal 4 MB.",
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
            <h2>Cover Photo</h2>
            <p>Foto baru akan diunggah saat tipe kamar disimpan.</p>
          </div>
          <span className="room-wizard-count">
            {room.cover ? "Preview" : "No preview"}
          </span>
        </div>
        {room.cover ? (
          <div className="room-wizard-cover">
            <img src={room.cover.url} alt="Cover tipe kamar" />
            <div>
              <strong>{room.cover.name}</strong>
              <small>{room.cover.size} · Cover Photo</small>
              <div className="room-wizard-photo-actions">
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                >
                  Replace
                </button>
                <button type="button" onClick={() => update({ cover: null })}>
                  Remove
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
            <strong>Upload Cover Photo</strong>
            <small>PNG, JPG, WebP up to 4 MB · 16:9 recommended</small>
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
            <h2>Gallery</h2>
            <p>Tambahkan beberapa foto untuk menampilkan detail kamar.</p>
          </div>
          <span className="room-wizard-count">
            {room.gallery.length} / 10 photos
          </span>
        </div>
        <div className="room-wizard-gallery">
          {room.gallery.map((photo, index) => (
            <div className="room-wizard-photo" key={photo.id}>
              <img src={photo.url} alt={`Foto kamar ${index + 1}`} />
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
                  aria-label={`Geser ${photo.name} ke kiri`}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => movePhoto(index, 1)}
                  disabled={index === room.gallery.length - 1}
                  aria-label={`Geser ${photo.name} ke kanan`}
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
                  Set Cover
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
                  Remove
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
              <strong>Upload Photos</strong>
              <small>PNG, JPG, WebP · up to 4 MB</small>
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
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  items: MasterOption[];
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
    groups.push({ title: "Other Amenities", items: otherItems });

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
          <h2>Amenities Selection</h2>
          <span className="room-wizard-count">
            {room.amenities.length} amenities selected
          </span>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search amenities..."
          aria-label="Cari fasilitas"
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
                Select All
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
          <p className="room-wizard-muted">Tidak ada fasilitas yang cocok.</p>
        )}
    </section>
  );
}

function Capacity({
  room,
  update,
  backToBasic,
}: {
  room: RoomTypeEntry;
  update: (values: Partial<RoomTypeEntry>) => void;
  backToBasic: () => void;
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
            <strong>Extra Bed Configuration</strong>
            <small>
              Maximum Extra Beds: {room.extraBedEnabled ? room.maxExtraBeds : 0}{" "}
              · Configured in Step 1: Basic Info
            </small>
          </div>
          <button type="button" onClick={backToBasic}>
            Step 1: Basic Info
          </button>
        </div>
      </section>
      <section className="room-wizard-section">
        <h2>Capacity Patterns</h2>
        <p>
          Pilih semua kombinasi tamu yang diperbolehkan untuk tipe kamar ini.
        </p>
        <div className="room-wizard-info">
          Pilih semua pola kapasitas yang valid, bukan hanya kapasitas maksimum.
          Setiap pola menentukan izin reservasi dan alokasi kasur tambahan.
        </div>
        <div className="room-wizard-capacity-head">
          <strong>Kombinasi Okupansi Tamu</strong>
          <span>{selectedCount} Dipilih</span>
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
            Select All
          </button>
        </div>
        <div className="room-wizard-capacity-scroll">
          <table className="room-wizard-capacity-table">
            <thead>
              <tr>
                <th>SELECT</th>
                <th>NUMBER OF PERSONS / GUEST COMBINATION</th>
                <th>EXTRA BED</th>
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
                      aria-label={`Pilih ${pattern.adults} dewasa ${pattern.children} anak`}
                    />
                  </td>
                  <td>
                    <strong>
                      {pattern.adults}{" "}
                      {pattern.adults === 1 ? "Adult" : "Adults"} +{" "}
                      {pattern.children}{" "}
                      {pattern.children === 1 ? "Child" : "Children"}
                    </strong>
                    <small>({pattern.adults + pattern.children} Orang)</small>
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
                      aria-label={`Extra bed untuk ${pattern.adults} dewasa ${pattern.children} anak`}
                    >
                      {Array.from(
                        {
                          length: room.extraBedEnabled
                            ? room.maxExtraBeds + 1
                            : 1,
                        },
                        (_, count) => (
                          <option value={count} key={count}>
                            {count} Extra Bed
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
          Engine reservasi hanya akan menampilkan kamar ini tersedia apabila
          kombinasi tamu yang dicari cocok dengan pola yang dicentang di atas.
        </p>
      </section>
    </div>
  );
}

export function AddRoomTypePage({ roomId }: { roomId?: string }) {
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
  const title = roomId ? "Edit Room Type" : "Add Room Type";

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
              : "Gagal memuat tipe kamar.",
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
    if (!room.name.trim()) return "Room Type Name wajib diisi.";
    if (!Number.isFinite(room.size) || room.size < 1)
      return "Room Size harus lebih dari 0.";
    if (!room.bedType) return "Pilih Bed Type.";
    if (!room.mealType) return "Pilih Meal Type.";
    if (!Number.isInteger(room.bedCount) || room.bedCount < 1)
      return "Number of Beds harus minimal 1.";
    if (
      room.extraBedEnabled &&
      (!Number.isInteger(room.maxExtraBeds) ||
        room.maxExtraBeds < 1 ||
        room.extraBedPrice < 0)
    )
      return "Periksa konfigurasi Extra Bed.";
    if (room.adultBreakfastPrice < 0 || room.childBreakfastPrice < 0)
      return "Harga sarapan tidak boleh negatif.";
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
      setError("Pilih minimal satu pola kapasitas tamu.");
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
          : "Gagal menyimpan tipe kamar.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (missing) {
    return (
      <AdminShell title="Rooms" context={title}>
        <div className="room-wizard-page">
          <h1>Tipe kamar tidak ditemukan</h1>
          <Link href="/rooms">← Room Types</Link>
        </div>
      </AdminShell>
    );
  }

  if (!loaded || !options) {
    return (
      <AdminShell title="Rooms" context={title}>
        <div className="room-wizard-page">
          {error || <LoadingSkeleton variant="form" rows={8} />}
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Rooms" context={title}>
      <div className="room-wizard-page">
        <div className="room-types-breadcrumb">
          <Link href="/rooms">Rooms</Link> /{" "}
          <Link href="/rooms">Room Types</Link> / {title}
        </div>
        <div className="room-wizard-heading">
          <h1>{title}</h1>
          <p>
            {roomId
              ? `Perbarui ${room.name} · ${descriptions[step].toLowerCase()}`
              : descriptions[step]}
          </p>
        </div>
        <nav className="room-wizard-steps" aria-label="Room Type form sections">
          {steps.map((name, index) => (
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
              <strong>{name}</strong>
              <small>
                {index === step
                  ? "In Progress"
                  : visitedSteps.includes(index)
                    ? "Visited"
                    : "Not visited"}
              </small>
            </button>
          ))}
        </nav>

        <div className="room-wizard-content">
          {step === 0 && (
            <BasicInfo room={room} update={update} options={options} />
          )}
          {step === 1 && (
            <Photos
              room={room}
              update={update}
              trackPreview={(url) => previewUrls.current.push(url)}
            />
          )}
          {step === 2 && (
            <Amenities room={room} update={update} items={options.amenities} />
          )}
          {step === 3 && (
            <Capacity
              room={room}
              update={update}
              backToBasic={() => setStep(0)}
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
              Cancel
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
              ← Previous: {steps[step - 1]}
            </button>
          )}
          {step < 3 ? (
            <button type="button" className="action-button" onClick={next}>
              Next: {steps[step + 1]} →
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
                ? "Saving..."
                : roomId
                  ? "Save Changes"
                  : "Save Room Type"}
            </button>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
