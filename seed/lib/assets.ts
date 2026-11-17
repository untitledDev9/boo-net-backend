/** Resolve a file in public/assets/images. */
export const img = (file: string): string => `/assets/images/${file}`;

/** Resolve an Unsplash photo that the original site references (stored locally). */
export const unsplash = (id: string): string => img(`unsplash-photo-${id}.jpg`);

export const LOGO = '/assets/logos/boosie-network.png';
export const LIL_BOO = img('53ce6c7d7_generated_image.png');
export const BIRTHDAY_X_POSTER = img('1b2d61bac_birthday-x-poster.png');
