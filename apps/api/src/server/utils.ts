export function toIso(dt: Date): string {
  return dt.toISOString();
}

export function stringifyBigint(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(stringifyBigint);
  if (value && typeof value === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(value as any)) out[k] = stringifyBigint(v);
    return out;
  }
  return value;
}

/**
 * Sinh biển số giả lập cho fixture/dev fallback. Không nhằm mục đích chuẩn pháp lý.
 */
export function simulateVietnamPlate(): string {
  // Tỉnh/thành phổ biến (sample)
  const provinces = ['11', '12', '14', '15', '17', '18', '20', '29', '30', '31', '33', '36', '37', '38', '43', '47', '49', '50', '51', '59', '60', '61', '63', '64', '65', '66', '67', '68', '69'];
  const province = provinces[Math.floor(Math.random() * provinces.length)];
  const letter = String.fromCharCode('A'.charCodeAt(0) + Math.floor(Math.random() * 12));
  const serie = `${Math.floor(Math.random() * 9) + 1}`;
  const tail = `${Math.floor(Math.random() * 900) + 100}.${Math.floor(Math.random() * 90) + 10}`;
  return `${province}${letter}-${serie}${tail}`;
}

/**
 * Chuẩn hoá biển số theo local fallback: uppercase + bỏ ký tự phân tách (space, '-', '.', ...)
 * Ví dụ: "59A-1 234.56" -> "59A123456"
 */
export function normalizeVietnamPlate(input: string): string {
  const s = String(input ?? '').trim().toUpperCase();
  return s.replace(/[^0-9A-Z]/g, '');
}

export function nowTrimMs(): Date {
  const d = new Date();
  d.setMilliseconds(0);
  return d;
}
