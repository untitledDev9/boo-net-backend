import type { NavLinkItem, TickerItem } from '../types';

export const MAIN_NAV: NavLinkItem[] = [
  { label: 'NEWSROOM', to: '/culture' },
  { label: 'THE BLOCK', to: '/community' },
  { label: 'WATCH', to: '/watch' },
  { label: 'LISTEN', to: '/listen' },
  { label: 'BOOKS', to: '/books' },
  { label: 'LIVE STREAM', to: '/live' },
  { label: 'SHOUTOUTS', to: '/shoutouts' },
  { label: 'EVENTS/TOUR', to: '/tour' },
];

export const TICKER_ITEMS: TickerItem[] = [
  { label: 'BREAKING:', icon: 'flame', text: "BID ON BOOSIE'S CLOTHS IN THE CLOSET CLICK HERE", to: '/closet' },
  { label: 'BREAKING:', icon: 'megaphone', text: 'HUGE ANNOUNCMENTS COMING THIS WEEK!!!' },
  { label: 'BREAKING:', icon: 'flame', text: 'NEW MOVIE DROPPING SOON: Slick Hood Security by Hotboy Major' },
  { label: 'BOOSIE STUDIOS:', icon: 'flame', text: 'BIRTHDAY X STARRING OG DRE & BOOSIE BADAZZ — STREAMING NOW', to: '/watch/birthday-x' },
  { label: 'NEW:', icon: 'film', text: 'Birthday X — Official Trailer', to: '/watch/birthday-x-trailer' },
];

export const FOOTER_COLUMNS: { title: string; links: NavLinkItem[] }[] = [
  {
    title: 'LEGAL',
    links: [
      { label: 'Terms of Service', to: '/legal/terms-of-service' },
      { label: 'Privacy Policy', to: '/legal/privacy-policy' },
      { label: 'Community Guidelines', to: '/legal/community-guidelines' },
      { label: 'Copyright / DMCA', to: '/legal/copyright-dmca-policy' },
    ],
  },
  {
    title: 'POLICIES',
    links: [
      { label: 'Membership Terms', to: '/legal/membership-subscription-terms' },
      { label: 'Refunds & Returns', to: '/legal/refund-return-cancellation-policy' },
      { label: 'Cookie Notice', to: '/legal/cookie-tracking-notice' },
      { label: 'Accessibility', to: '/legal/accessibility-statement' },
    ],
  },
];

export const MOBILE_TABS: NavLinkItem[] = [
  { label: 'HOME', to: '/' },
  { label: 'CULTURE', to: '/culture' },
  { label: 'WATCH', to: '/watch' },
  { label: 'LISTEN', to: '/listen' },
  { label: 'SHOP', to: '/shop' },
  { label: 'BOOKS', to: '/books' },
];

export const MOBILE_MENU_LINKS: NavLinkItem[] = [
  ...MAIN_NAV,
  { label: 'THE CLOSET', to: '/closet' },
  { label: 'THE MALL', to: '/shop' },
  { label: 'RADIO', to: '/radio' },
  { label: 'WORK WITH US', to: '/work-with-us' },
  { label: 'SUPPORT', to: '/support' },
];
