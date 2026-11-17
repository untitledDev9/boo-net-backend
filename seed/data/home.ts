import type { Article, ClosetItem, FeaturedItem, Pillar, StudioItem, Track } from '../types';
import { img, unsplash } from '../lib/assets';

const SPRITE = img('044cd8c1a_ChatGPTImageAug29202608_46_58PM.png');

export const PILLARS: Pillar[] = [
  { kicker: 'The Movement', title: 'Culture', description: 'Breaking stories, editorial, and real talk straight from the culture.', to: '/culture', image: unsplash('1504711434969-e33886168f5c') },
  { kicker: 'Boosie Studios', title: 'Watch', description: 'Movies, series, documentaries, and exclusives on demand.', to: '/watch', sprite: { src: SPRITE, x: 25, y: 0 } },
  { kicker: 'The Vault', title: 'Listen', description: 'Every album, track, and mixtape in the Boosie catalog.', to: '/listen', sprite: { src: SPRITE, x: 50, y: 0 } },
  { kicker: 'Going Live', title: 'Live Stream', description: 'Real-time streams, catalog battles, and premieres.', to: '/live', image: unsplash('1514525253161-7a46d19cd819') },
  { kicker: 'Badazz Radio', title: 'Radio', description: 'All the classic hits, new songs, and everything in between — plus talk shows. Free to subscribers.', to: '/radio', image: unsplash('1478737270239-2f02b77fc618') },
  { kicker: 'The Vault Store', title: 'Shop', description: 'Apparel, limited drops, collectibles, and artist merch.', to: '/shop', image: unsplash('1441986300917-64674bd600d8') },
  { kicker: 'The Library', title: 'Books', description: 'Paperbacks, eBooks, and audiobooks — sold and fulfilled through Amazon KDP.', to: '/books', image: unsplash('1497633762265-9d179a990aa6') },
  { kicker: 'The Family', title: 'Community', description: 'Feed, posts, polls, and the Boosie faithful.', to: '/community', sprite: { src: SPRITE, x: 50, y: 50 } },
  { kicker: 'On The Road', title: 'Events', description: 'Every show, appearance, and live stream — one network calendar.', to: '/events', image: unsplash('1505236858219-8359eb29e329') },
];

const LOT = (hash: string, lot: string) => img(`${hash}_LOT_${lot}_PHOTO_1.jpg`);

export const CLOSET_ITEMS: ClosetItem[] = [
  { id: '6abc846dd2beffc9bb298272', title: 'Louis Vuitton LV Trainer — White/Blue/Turquoise', image: LOT('fb055d36e', '034'), status: 'LIVE', startingAt: 515, bids: 0, endsInSeconds: 4 * 86400 + 16 * 3600 + 14 * 60 + 1 },
  { id: '6abc846dd2beffc9bb298258', title: 'Dolce & Gabbana Portofino — Graffiti', image: LOT('f10e16ec9', '008'), status: 'LIVE', startingAt: 176, bids: 0, endsInSeconds: 4 * 86400 + 16 * 3600 + 14 * 60 + 1 },
  { id: '6abc846dd2beffc9bb298251', title: 'Designer Orange/Black/Red Chunky Sneaker', image: LOT('398ce8267', '001'), status: 'LIVE', startingAt: 318, bids: 0, endsInSeconds: 4 * 86400 + 16 * 3600 + 14 * 60 + 1 },
  { id: '6abc846dd2beffc9bb298273', title: 'Giuseppe Zanotti Low-Top — White/Pink/Yellow', image: LOT('4d6d81db2', '038'), status: 'UPCOMING', startingAt: 234, bids: 0 },
  { id: '6abc846dd2beffc9bb298275', title: 'Casablanca Atlantis — White/Red', image: LOT('f37d34277', '037'), status: 'UPCOMING', startingAt: 134, bids: 0 },
  { id: '6abc846dd2beffc9bb298274', title: 'Versace Odissea — Bright Yellow', image: LOT('eea995d26', '036'), status: 'UPCOMING', startingAt: 318, bids: 0 },
  { id: '6abc846dd2beffc9bb298276', title: 'Amiri Newport Sneaker — White/Burgundy', image: LOT('efed512a9', '035'), status: 'UPCOMING', startingAt: 318, bids: 0 },
  { id: '6abc846dd2beffc9bb298271', title: 'Givenchy Glide — Red Technical', image: LOT('02614c7dd', '033'), status: 'UPCOMING', startingAt: 234, bids: 0 },
];

export const FEATURED_ITEMS: FeaturedItem[] = [
  { title: 'Birthday X — Official Trailer', subtitle: 'trailer', image: img('1b2d61bac_birthday-x-poster.png'), to: '/watch/birthday-x-trailer', badge: 'WATCH', price: 'FREE' },
  { title: 'Boosie After Dark', subtitle: 'Boosie Badazz', image: img('5bf372d0f_image.png'), to: '/live/6acd451a946ef9d4933b4a60', badge: 'LIVE', price: 'FREE' },
  { title: 'Hotboxin Ep. 2', subtitle: 'interview', image: img('8f94fe5e2_thumbnail.jpg'), to: '/watch/hotboxin-ep-2-y0dl', badge: 'WATCH', price: 'FREE' },
  { title: 'No Country for Old Crooks', subtitle: 'movie', image: img('7e7a25395_ncfocposter.webp'), to: '/watch/no-country-for-old-crooks', badge: 'WATCH', price: 19.99 },
  { title: 'Easy Town 4', subtitle: 'movie', image: img('90f092976_EasyTown4OfficialArtworkPoster1.webp'), to: '/watch/easy-town-4', badge: 'WATCH', price: 9.99 },
  { title: 'Heartless', subtitle: 'movie', image: img('2f7e659f2_heartless.webp'), to: '/watch/heartless', badge: 'WATCH', price: 14.99 },
  { title: 'New Raq City', subtitle: 'movie', image: img('86ac0a8a9_raqcity.webp'), to: '/watch/new-raq-city', badge: 'WATCH', price: 14.99 },
];

export const CULTURE_ARTICLES: Article[] = [
  {
    slug: 'halle-berry-olivier-martinez-child-support-update',
    category: 'movies tv',
    title: 'Olivier Martinez Seeks Increased Child Support From Halle Berry Following Custody Shift',
    excerpt: 'Following a recent court-ordered shift in custody, Olivier Martinez has filed for a recalculation of child support payments from Halle Berry.',
    image: img('wiki-halle-berry.jpg'),
    author: 'Devon Carter',
    readMinutes: 4,
  },
  {
    slug: 'lngshot-bananas-number-one-trending',
    category: 'music',
    title: "LNGSHOT Takes Over Global Charts with 'Bananas' Music Video",
    excerpt: "Fresh off the release of their new EP 'S.W.I.S.H.', boy group LNGSHOT has secured the top spot on YouTube's global trending music video chart with their latest visual for 'Bananas'.",
    image: img('wiki-lngshot-bounce.jpg'),
    author: 'Dre Collins',
    tag: 'Music',
    readMinutes: 3,
  },
  {
    slug: 'flo-rida-best-buddies-miami-gala-2026',
    category: 'music',
    title: "Flo Rida Tapped to Headline 2026 Jersey Mike's Subs Best Buddies Miami Gala",
    excerpt: "The Florida-born hitmaker is set to take the stage at Mana Wynwood this November to support Best Buddies International's mission of inclusion.",
    image: img('wiki-flo-rida.jpg'),
    author: 'Nia Monroe',
    tag: 'Entertainment',
    readMinutes: 3,
  },
];

const POSTER = img('1b2d61bac_birthday-x-poster.png');
const TOUR_POSTER = img('536a9116e_boosie-on-the-road-poster.png');

export const STUDIO_ITEMS: StudioItem[] = [
  { title: "Columbus, GA and KG's CSMA - Boosie On The Road", kind: 'VLOG', access: 'FREE', image: TOUR_POSTER, to: '/watch', meta: '2026' },
  { title: 'Birthday X', kind: 'FILM', access: 'OWN', image: POSTER, to: '/watch/birthday-x', meta: '2026 · 85m · NR' },
  { title: 'Birthday X — Official Trailer', kind: 'VIDEO', access: 'FREE', image: POSTER, to: '/watch/birthday-x-trailer', meta: '2026' },
  { title: "Boosie's CM/NL Tour Vlog — Baton Rouge", kind: 'VLOG', access: 'OWN', image: TOUR_POSTER, to: '/watch', meta: '48m' },
  { title: "Boosie's CM/NL Tour Vlog — Atlanta", kind: 'VLOG', access: 'OWN', image: TOUR_POSTER, to: '/watch', meta: '42m' },
  ...(
    [
      ['9', '991b7c585', '62m'],
      ['8', '0ba7cdf04', '47m'],
      ['4', '8a27deb24', '39m'],
      ['3', 'ec67e5159', '25m'],
      ['7', 'f9aa8b1fc', '45m'],
      ['5', '19b98dad5', '38m'],
      ['6', '3bf3232e1', '35m'],
      ['2', 'dca052276', '40m'],
      ['1', '2844e1d36', '27m'],
    ] as const
  ).map(
    ([ep, hash, meta]): StudioItem => ({
      title: `Sexy on Wheels — EP ${ep}`,
      kind: 'SERIES',
      access: 'OWN',
      image: img(`${hash}_thumbnail.jpg`),
      to: '/watch',
      meta,
    }),
  ),
];

const COVERS = ['24931a1af', '1efb09bb3', '7a09d8df8', 'b3f59cf92', '81aa4fa9a', '21804b95d'];
export const VAULT_TRACKS: Track[] = [
  ['We Out Chea', '5:22'],
  ['What Goes Up', '4:45'],
  ['Shit Yea', '3:35'],
  ['One Love', '5:07'],
  ['Fuck Em All (Gone Till December)', '3:24'],
  ['Gone But Not Forgotten', '3:35'],
].map(([title, duration], i) => ({
  id: `vault-${i + 1}`,
  title,
  artist: 'Boosie Badazz',
  cover: img(`${COVERS[i]}_generated_image.png`),
  plays: 0,
  duration,
}));
