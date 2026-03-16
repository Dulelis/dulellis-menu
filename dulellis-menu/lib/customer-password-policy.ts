export const CUSTOMER_PASSWORD_MIN_LENGTH = 8;

export const CUSTOMER_PASSWORD_RULES_TEXT =
  "Use pelo menos 8 caracteres, com letra maiúscula, letra minúscula e número.";

export function validateCustomerPassword(password: string) {
  const value = String(password || "");

  if (value.length < CUSTOMER_PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      error: `Senha deve ter no mínimo ${CUSTOMER_PASSWORD_MIN_LENGTH} caracteres.`,
    };
  }

  if (!/[A-Z]/.test(value)) {
    return {
      valid: false,
      error: "Senha deve conter pelo menos 1 letra maiúscula.",
    };
  }

  if (!/[a-z]/.test(value)) {
    return {
      valid: false,
      error: "Senha deve conter pelo menos 1 letra minúscula.",
    };
  }

  if (!/\d/.test(value)) {
    return {
      valid: false,
      error: "Senha deve conter pelo menos 1 número.",
    };
  }

  return { valid: true, error: "" };
}
