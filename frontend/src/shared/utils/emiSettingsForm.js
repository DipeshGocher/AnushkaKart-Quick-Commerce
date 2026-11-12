/**
 * Helpers for the admin "EMI Settings" form. They only change how the settings are SHOWN and
 * edited; the server still validates and stores exactly the same data.
 *
 * First-EMI date rules are edited as simple rows ("up to day 10 -> EMI on the 1st"). The
 * "from" day of each row is the previous row's "to" day + 1 and the last row always ends at
 * day 31, so the admin can never create a gap or an overlap.
 */

/** Saved rules -> editable rows [{ toDay, dueDay }] (strings, so typing stays natural). */
export function rulesToRows(rules) {
  const sorted = [...(rules || [])].sort((a, b) => Number(a.fromDay) - Number(b.fromDay));
  const rows = sorted.map((r) => ({ toDay: String(r.toDay), dueDay: String(r.dueDay) }));
  if (rows.length) rows[rows.length - 1].toDay = "31";
  return rows;
}

/** Editable rows -> the rules the server expects. */
export function rowsToRules(rows) {
  let from = 1;
  return rows.map((row, i) => {
    const toDay = i === rows.length - 1 ? 31 : Number(row.toDay);
    const rule = { fromDay: from, toDay, dueDay: Number(row.dueDay) };
    from = toDay + 1;
    return rule;
  });
}

/** A short, plain message if the rows cannot be saved, otherwise "". */
export function rowsProblem(rows) {
  if (!rows.length) return "Add at least one rule.";
  let prev = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const isLast = i === rows.length - 1;
    const toDay = isLast ? 31 : Number(rows[i].toDay);
    const dueDay = Number(rows[i].dueDay);
    if (!isLast && (!Number.isInteger(toDay) || toDay <= prev || toDay >= 31)) {
      return `Row ${i + 1}: the last day must be after day ${prev} and before 31.`;
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      return `Row ${i + 1}: the EMI day must be between 1 and 28.`;
    }
    prev = toDay;
  }
  return "";
}

/** Slab rows -> a plain message if the limits are not increasing, otherwise "". */
export function slabsProblem(slabs) {
  let prev = 0;
  for (let i = 0; i < slabs.length - 1; i += 1) {
    const limit = Number(slabs[i].upTo);
    if (!Number.isFinite(limit) || limit <= prev) {
      return `Row ${i + 1}: the amount must be more than ${prev ? "₹" + prev.toLocaleString("en-IN") : "0"}.`;
    }
    prev = limit;
  }
  return "";
}

/** Label for the left side of a file-charge row. */
export function slabRangeLabel(slabs, index) {
  const prev = index === 0 ? 0 : Number(slabs[index - 1].upTo) || 0;
  const money = (n) => "₹" + Number(n).toLocaleString("en-IN");
  if (index === slabs.length - 1) return index === 0 ? "Any amount" : `Above ${money(prev)}`;
  return index === 0 ? "Up to" : `${money(prev)} to`;
}

/** "If finance is taken today, the first EMI is on ..." for the example line. */
export function firstEmiExample(rules, today = new Date()) {
  const day = today.getDate();
  const rule = rules.find((r) => day >= r.fromDay && day <= r.toDay) || rules[rules.length - 1];
  if (!rule) return null;
  const due = new Date(today.getFullYear(), today.getMonth() + 1, rule.dueDay);
  return {
    day,
    text: due.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
  };
}
