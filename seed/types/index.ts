export interface NavLinkItem {
  label: string;
  to: string;
}

export interface TickerItem {
  label: string;
  text: string;
  icon: 'flame' | 'megaphone' | 'film';
  to?: string;
  external?: boolean;
}

export interface Pillar {
  kicker: string;
  title: string;
  description: string;
  to: string;
  /** Plain cover photo. */
  image?: string;
  /** Sprite-sheet cover: a cell of a 5x3 grid. */
  sprite?: { src: string; x: number; y: number };
}

export interface ClosetItem {
  id: string;
  title: string;
  image: string;
  status: 'LIVE' | 'UPCOMING';
  startingAt: number;
  bids: number;
  /** Seconds remaining (LIVE only). */
  endsInSeconds?: number;
}

export interface FeaturedItem {
  title: string;
  subtitle: string;
  image: string;
  to: string;
  badge: 'WATCH' | 'LIVE';
  price: number | 'FREE';
}

export interface Article {
  slug: string;
  category: string;
  title: string;
  excerpt: string;
  image: string;
  author: string;
  readMinutes: number;
  tag?: string;
}

export interface StudioItem {
  title: string;
  kind: 'VLOG' | 'FILM' | 'VIDEO' | 'SERIES';
  access: 'FREE' | 'OWN' | 'MEMBERS';
  image: string;
  to: string;
  meta: string;
}

export interface WatchTitle {
  title: string;
  kind: string;
  access: string;
  meta: string;
  /** File name inside public/assets/images. */
  image: string;
}

export interface SingleTrack {
  title: string;
  artist: string;
  cover: string;
  price: number;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  cover: string;
  plays: number;
  duration: string;
}

export interface MerchItem {
  slug: string;
  name: string;
  price: number;
  /** File name inside public/assets/images/merch. */
  image: string;
  badge: string;
}

export interface Product {
  id: string;
  title: string;
  price: number;
  image: string;
  category: string;
}

export interface CartLine {
  id: string;
  title: string;
  price: number;
  image: string;
  qty: number;
}
