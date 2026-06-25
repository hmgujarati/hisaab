// Indian currency + date + FY helpers
const inrFmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function formatINR(amount) {
  if (amount == null || isNaN(amount)) return "₹0";
  return inrFmt.format(Math.round(Number(amount)));
}

export function formatINRPlain(amount) {
  if (amount == null || isNaN(amount)) return "0";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    Math.round(Number(amount))
  );
}

export function formatDate(d) {
  if (!d) return "—";
  try {
    const dt = typeof d === "string" ? new Date(d) : d;
    return dt.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (_) {
    return d;
  }
}

export function currentFY() {
  const t = new Date();
  const sy = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
  return `${sy}-${String(sy + 1).slice(-2)}`;
}

export function fyOptions(count = 5) {
  const t = new Date();
  const cur = t.getMonth() >= 3 ? t.getFullYear() : t.getFullYear() - 1;
  const out = [];
  for (let i = 0; i < count; i++) {
    const y = cur - i;
    out.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return out;
}

export function daysFromNow(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}
