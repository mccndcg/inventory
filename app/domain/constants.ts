export const CURRENCY_CODE = "PHP" as const;
export const BUSINESS_TIMEZONE = "Asia/Manila" as const;
export const RECORD_SCHEMA_VERSION = 1;
export const LOCAL_SCHEMA_VERSION = 3;

export type CurrencyCode = typeof CURRENCY_CODE;
export type BusinessTimezone = typeof BUSINESS_TIMEZONE;
