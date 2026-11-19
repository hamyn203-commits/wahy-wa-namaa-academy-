/** Official academy contact channels (overridable via VITE_* env vars).
 * Empty optional social URLs are intentionally hidden.
 */
export const SOCIAL_LINKS = {
  facebook: import.meta.env.VITE_FACEBOOK_URL || '',
  whatsapp: import.meta.env.VITE_WHATSAPP_URL || 'https://wa.me/201557891330',
  instagram: import.meta.env.VITE_INSTAGRAM_URL || '',
  youtube: import.meta.env.VITE_YOUTUBE_URL || '',
  telegram: import.meta.env.VITE_TELEGRAM_URL || '',
};

export const CONTACT = {
  email: import.meta.env.VITE_SUPPORT_EMAIL || 'wahywanamaaacademy@gmail.com',
  phone: import.meta.env.VITE_SUPPORT_PHONE || '+20 155 789 1330',
  address: import.meta.env.VITE_SUPPORT_ADDRESS || '',
};
