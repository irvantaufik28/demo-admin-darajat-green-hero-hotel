"use client";

import Image from "next/image";

type Props = {
  id: string;
  title: string;
  recommendation: string;
  imageUrl: string | null;
  noPhoto: string;
  choosePhoto: string;
  replacePhoto: string;
  removePhoto: string;
  uploadingLabel: string;
  uploading: boolean;
  disabled: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
};

export function ExperiencePhotoField({
  id, title, recommendation, imageUrl, noPhoto, choosePhoto, replacePhoto, removePhoto, uploadingLabel,
  uploading, disabled, onSelect, onRemove,
}: Props) {
  return (
    <div className="exp-photo-field">
      <div className="exp-photo-field__heading">
        <label className="exp-modal-label" htmlFor={id}>{title}</label>
        <span className="exp-modal-label--hint">{recommendation}</span>
      </div>
      <div className="exp-photo-field__content">
        <div className="exp-photo-field__preview">
          {imageUrl ? <Image src={imageUrl} alt={title} width={112} height={76} unoptimized /> : <span>{noPhoto}</span>}
        </div>
        <div className="exp-photo-field__controls">
          <input
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={disabled || uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onSelect(file);
              event.target.value = "";
            }}
          />
          <span className="exp-modal-label--hint">{uploading ? uploadingLabel : imageUrl ? replacePhoto : choosePhoto}</span>
          {imageUrl && <button type="button" className="exp-photo-field__remove" disabled={disabled || uploading} onClick={onRemove}>{removePhoto}</button>}
        </div>
      </div>
    </div>
  );
}
