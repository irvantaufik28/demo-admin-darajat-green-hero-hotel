import Image from "next/image";

export function BrandMark() {
  return (
    <div className="brand-mark">
      <Image src="/images/green-hero-logo.png" width={32} height={32} alt="Green Hero Darajat" priority />
    </div>
  );
}
