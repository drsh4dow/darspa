import QRCode from "qrcode";

export function VoucherQr({ code }: { code: string }) {
  const { modules } = QRCode.create(code, { errorCorrectionLevel: "M" });
  const squares: string[] = [];

  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) squares.push(`M${column + 4} ${row + 4}h1v1h-1z`);
    }
  }

  // These are standard SVG accessibility/rendering attributes, not custom shape names.
  /* oxlint-disable jsx-a11y/prefer-tag-over-role, anti-slop/no-shape-in-symbol-names */
  return (
    <svg
      role="img"
      aria-label="Código QR del voucher"
      viewBox={`0 0 ${modules.size + 8} ${modules.size + 8}`}
      className="h-40 w-40"
      shapeRendering="crispEdges"
    >
      <rect width="100%" height="100%" fill="white" />
      <path d={squares.join("")} fill="black" />
    </svg>
  );
}
