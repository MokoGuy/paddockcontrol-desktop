/**
 * Error parser utility for mapping backend errors to form fields
 */

export type FieldError = {
  field: string;
  message: string;
};

export type ParsedError = {
  fieldErrors: FieldError[];
  generalError: string | null;
};

/**
 * Parse a backend error message and map it to specific form fields when possible.
 * Falls back to a general error for unmappable errors.
 */
export function parseBackendError(error: string): ParsedError {
  const fieldErrors: FieldError[] = [];
  let generalError: string | null = null;

  const lowerError = error.toLowerCase();

  // Hostname errors
  if (lowerError.includes("hostname") && lowerError.includes("empty")) {
    fieldErrors.push({ field: "hostname", message: "Hostname is required" });
  } else if (lowerError.includes("hostname") && lowerError.includes("must end with")) {
    fieldErrors.push({ field: "hostname", message: error });
  } else if (lowerError.includes("already exists")) {
    fieldErrors.push({
      field: "hostname",
      message: "A certificate with this hostname already exists",
    });
  }
  // SAN errors
  else if (lowerError.includes("invalid ip address")) {
    fieldErrors.push({ field: "sans", message: error });
  } else if (lowerError.includes("invalid san") || lowerError.includes("unknown san type")) {
    fieldErrors.push({ field: "sans", message: error });
  }
  // Key size errors
  else if (lowerError.includes("key size")) {
    fieldErrors.push({ field: "key_size", message: error });
  }
  // Fallback to general error
  else {
    generalError = error;
  }

  return { fieldErrors, generalError };
}
