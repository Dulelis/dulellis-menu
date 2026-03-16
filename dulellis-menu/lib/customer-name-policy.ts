function normalizeName(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function validateCustomerFullName(name: string) {
  const clean = String(name || "")
    .trim()
    .replace(/\s+/g, " ");
  const parts = clean.split(" ").filter(Boolean);

  if (parts.length < 2) {
    return {
      valid: false,
      error: "Informe nome e sobrenome.",
      normalized: normalizeName(clean),
    };
  }

  if (parts.some((part) => part.length < 2)) {
    return {
      valid: false,
      error: "Informe nome e sobrenome válidos.",
      normalized: normalizeName(clean),
    };
  }

  return {
    valid: true,
    error: "",
    normalized: normalizeName(clean),
  };
}

export function customerNamesMatch(a: string, b: string) {
  return normalizeName(a) === normalizeName(b);
}
