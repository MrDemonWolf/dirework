// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export function deepMerge(defaults: AnyRecord, overrides: AnyRecord): AnyRecord {
  const result = { ...defaults };
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] &&
      typeof overrides[key] === "object" &&
      !Array.isArray(overrides[key]) &&
      defaults[key] &&
      typeof defaults[key] === "object"
    ) {
      result[key] = deepMerge(defaults[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}
