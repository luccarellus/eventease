export function toDate(value: string): Date {
  return new Date(value);
}

export function toDateOrUndefined(value?: string | null): Date | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(value);
}

export function toDateOrNull(value?: string | null): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || value === '') {
    return null;
  }

  return new Date(value);
}
