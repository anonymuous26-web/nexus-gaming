export function serializeFirestoreValue(value) {
  if (value == null) return value;

  if (typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  if (
    typeof value === "object" &&
    Number.isFinite(value._seconds) &&
    Number.isFinite(value._nanoseconds)
  ) {
    return new Date(
      value._seconds * 1000 + value._nanoseconds / 1_000_000
    ).toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(serializeFirestoreValue);
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeFirestoreValue(item),
      ])
    );
  }

  return value;
}

export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;

  const result = new Date(value).getTime();
  return Number.isFinite(result) ? result : 0;
}
