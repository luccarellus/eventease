import type { CookieOptions } from 'express';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: IS_PRODUCTION,
  sameSite: 'strict',
};

export function getAccessTokenCookieOptions(): CookieOptions {
  return {
    ...baseCookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  };
}

export function getRefreshTokenCookieOptions(): CookieOptions {
  return {
    ...baseCookieOptions,
    path: '/auth/refresh',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  };
}

export function getRefreshTokenClearCookieOptions(): CookieOptions {
  return {
    path: '/auth/refresh',
  };
}
