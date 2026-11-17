import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BIRTHDAY_X } from './data/birthdayX';
import { WATCH_TITLES, WATCH_SECTIONS, LISTEN_SINGLES, RADIO_ROTATION } from './data/catalog';
import { CLOSET_ITEMS, CULTURE_ARTICLES, FEATURED_ITEMS, PILLARS, VAULT_TRACKS } from './data/home';
import { LEGAL_CATEGORIES, LEGAL_DOCS } from './data/legalDocs';
import { MERCH } from './data/merch';
import { TALENT } from './data/shoutouts';
import { FOOTER_COLUMNS, MAIN_NAV, MOBILE_MENU_LINKS, MOBILE_TABS, TICKER_ITEMS } from './data/site';
import { DOOR_GROUPS } from './data/workWithUs';
import { LIL_BOO, LOGO, img, unsplash } from './lib/assets';

const here = path.dirname(fileURLToPath(import.meta.url));

export type Doc = Record<string, any>;
/** Marker resolved to a MediaAsset id when seeding. */
export const M = (url: string, alt = ''): Doc => ({ $media: url, alt });
/** Marker resolved to the _id of another seeded document. */
export const R = (resource: string, by: Record<string, string>): Doc => ({ $ref: resource, by });

const cents = (dollars: number): number => Math.round(dollars * 100);
const published = { status: 'published' as const };
const withOrder = <T extends Doc>(docs: T[], step = 10): T[] => docs.map((d, i) => ({ ...d, sortOrder: i * step, ...published }));

const ICON: Record<string, string> = { newspaper: 'newspaper', film: 'film', music: 'music', video: 'video', radio: 'radio', 'shopping-bag': 'shopping-bag', users: 'users', calendar: 'calendar', store: 'store', megaphone: 'megaphone', briefcase: 'briefcase', mic: 'mic', heart: 'heart' };

export function buildSeed(now: Date = new Date()): Record<string, Doc[]> {
  const out: Record<string, Doc[]> = {};

  // ───────── Site settings ─────────
  out.siteSettings = [{ logo: M(LOGO, 'Boosie Network'), favicon: M(LOGO, 'Boosie Network'), ogImage: M(LOGO, 'Boosie Network'), lilBooAvatar: M(LIL_BOO, 'Lil Boo'), contactEmail: 'legal@boosienetwork.com', watchShelfOrder: WATCH_SECTIONS.map((s) => s.name) }];

  // ───────── Site text (page copy that lives outside the structured models) ─────────
  const texts: [string, string, string][] = [
    ['watch.hero.kicker', 'Boosie Studios', 'Watch'], ['watch.hero.tag', 'STREAMING NETWORK', 'Watch'], ['watch.hero.title', 'Watch', 'Watch'],
    ['watch.hero.description', 'Movies, series, documentaries, and exclusives on demand — the catalog of the culture.', 'Watch'],
    ['listen.hero.kicker', 'The Vault', 'Listen'], ['listen.hero.title', 'Listen', 'Listen'],
    ['listen.hero.description', 'Every track in the Boosie catalog — the soundtrack of the culture. Build your own album from the singles you love.', 'Listen'],
    ['listen.buildAlbum.kicker', 'New · The Vault', 'Listen'], ['listen.buildAlbum.heading', 'Build Your Own Album', 'Listen'],
    ['listen.buildAlbum.body', 'Why buy a whole album when you only want the hits? Pick the songs you want at 99¢ each and build your own custom Boosie album.', 'Listen'],
    ['listen.buildAlbum.cta', 'START BUILDING', 'Listen'], ['listen.singles.heading', 'Singles · 99¢', 'Listen'],
    ['radio.hero.kicker', 'Badazz Radio', 'Radio'], ['radio.hero.title', 'Radio', 'Radio'],
    ['radio.hero.description', '24/7 curated stations and hosted shows streaming free across the network — listeners tune in free, artists push their best songs into rotation.', 'Radio'],
    ['radio.rotation.heading', 'In Rotation', 'Radio'], ['radio.schedule.heading', 'Weekly Schedule', 'Radio'],
    ['radio.schedule.emptyTitle', 'No Shows Scheduled', 'Radio'], ['radio.schedule.emptyText', 'The Badazz Radio lineup is being booked.', 'Radio'],
    ['books.hero.kicker', 'The Library', 'Books'], ['books.hero.title', 'Books', 'Books'],
    ['books.hero.description', 'Paperbacks, eBooks, and audiobooks from the Boosie catalog — published and fulfilled through Amazon KDP.', 'Books'],
    ['books.empty.title', 'The Library Is Loading', 'Books'], ['books.empty.text', 'New titles are being added to the catalog.', 'Books'],
    ['live.hero.kicker', 'Going Live', 'Live'], ['live.hero.title', 'Live Stream', 'Live'],
    ['live.hero.description', 'Real-time streams, catalog battles, and premieres — straight from the network.', 'Live'],
    ['live.soon.badge', 'COMING SOON', 'Live'], ['live.soon.heading', 'First Live Stream\nComing Soon', 'Live'],
    ['live.soon.body', 'Boosie is gearing up for a 24-hour subathon. The stream goes live right here the moment it drops. Tap in.', 'Live'],
    ['shop.hero.kicker', 'The Vault Store', 'Shop'], ['shop.hero.title', 'Shop', 'Shop'],
    ['shop.hero.description', 'Apparel, limited drops, collectibles, and artist merch — straight from the vault.', 'Shop'],
    ['shopper.hero.kicker', 'The Vault District', 'Shopper'], ['shopper.hero.title', 'Welcome to the Vault', 'Shopper'],
    ['shopper.hero.description', 'Everything here is for sale. No membership, no freebies — just the vault.', 'Shopper'],
    ['tv.title', 'BoosieTV', 'TV'], ['tv.description', 'The streaming home of Boosie Badazz. Movies, documentaries, concerts, interviews and originals. Titles appear here once the catalog is published.', 'TV'],
    ['join.hero.kicker', 'Membership', 'Join'], ['join.hero.title', 'Join The Network', 'Join'],
    ['join.hero.description', "Pick your lane and pay — then set your password and you're in the moment your payment goes through. No invite emails, no waiting.", 'Join'],
    ['tv.title', 'BoosieTV', 'TV'], ['tv.description', 'The streaming home of Boosie Badazz. Movies, documentaries, concerts, interviews and originals. Titles appear here once the catalog is published.', 'TV'],
    ['legal.hero.kicker', 'Legal Center', 'Legal'], ['legal.hero.title', 'Policies & Legal', 'Legal'],
    ['legal.hero.description', 'The rules of the road for the Boosie Network — for fans, creators, advertisers, vendors and partners. All policies below are effective {date}.', 'Legal'],
    ['legal.footer', '© Boosie Network. Policies effective {date}.', 'Legal'],
    ['tour.events.kicker', 'Boosie Events', 'Tour'], ['tour.events.title', 'All Events', 'Tour'],
    ['tour.events.description', 'Every show and appearance — tickets via BoosieEvents. You stay right here.', 'Tour'],
    ['tour.empty.title', 'No Events Listed Yet', 'Tour'], ['tour.empty.text', 'New shows drop here the moment they go live on BoosieEvents.', 'Tour'],
    ['tour.route.kicker', 'The Route', 'Tour'], ['tour.route.title', 'Verified Tour Dates', 'Tour'],
    ['cart.empty.title', 'Cart Is Empty', 'Cart'], ['cart.empty.text', 'Browse the vault store and add some heat.', 'Cart'],
    ['home.pillars.kicker', 'The Network', 'Home'], ['home.pillars.title', 'Eight Pillars. One Empire.', 'Home'],
    ['home.pillars.description', 'Every pillar of the culture lives under one roof — owned, operated, and routed through Badazz Radio.', 'Home'],
    ['home.tour.kicker', 'Cash Money × No Limit Tour', 'Home'], ['home.tour.heading', 'Boosie On The Road', 'Home'],
    ['home.tour.body', 'Two legendary empires. One massive tour. Boosie Badazz live.', 'Home'],
    ['home.closet.kicker', 'From the personal vault', 'Home'], ['home.closet.heading', "Boosie's Closet", 'Home'],
    ['home.closet.body', "Straight out Boosie's own wardrobe — game-worn, concert-worn, movie-worn & music-video pieces. One-of-one auctions, when it's gone it's gone.", 'Home'],
    ['home.featured.kicker', 'Hand-Picked', 'Home'], ['home.featured.title', 'Featured on the Network', 'Home'],
    ['home.culture.kicker', 'The Movement', 'Home'], ['home.culture.title', 'Culture', 'Home'],
    ['home.studios.kicker', 'Boosie Studios', 'Home'], ['home.studios.title', 'Watch Now', 'Home'],
    ['home.vault.kicker', 'The Vault', 'Home'], ['home.vault.title', 'Fresh From The Vault', 'Home'],
    ['home.drops.kicker', 'The Vault Store', 'Home'], ['home.drops.title', 'Fresh Drops', 'Home'],
    ['shoutouts.chooseHeading', 'Choose Talent', 'Shoutouts'],
  ];
  out.siteText = texts.map(([key, value, group]) => ({ key, value, group }));

  // ───────── Navigation ─────────
  const nav: Doc[] = [];
  MAIN_NAV.forEach((l) => nav.push({ location: 'main', label: l.label, to: l.to }));
  nav.push({ location: 'pill', label: 'THE CLOSET', to: '/closet', style: 'gold' }, { location: 'pill', label: 'THE MALL', to: '/shop', style: 'outline' }, { location: 'pill', label: 'WORK WITH US', to: '/work-with-us', style: 'outline' }, { location: 'pill', label: 'SIGN IN', to: '/login', style: 'outline' });
  MOBILE_TABS.forEach((l) => nav.push({ location: 'mobileTab', label: l.label, to: l.to, icon: { HOME: 'home', CULTURE: 'newspaper', WATCH: 'circle-play', LISTEN: 'music', SHOP: 'shopping-bag', BOOKS: 'book-open' }[l.label] ?? '' }));
  MOBILE_MENU_LINKS.forEach((l) => nav.push({ location: 'mobileMenu', label: l.label, to: l.to }));
  [['HOME', '/shopper'], ['MALL', '/shop'], ['WATCH', '/watch'], ['LISTEN', '/listen'], ['LIVE', '/live'], ['SHOUTOUTS', '/shoutouts'], ['EVENTS', '/events'], ['TOURS', '/tour']].forEach(([label, to]) => nav.push({ location: 'shopper', label, to }));
  FOOTER_COLUMNS.forEach((c) => c.links.forEach((l) => nav.push({ location: 'footer', group: c.title, label: l.label, to: l.to })));
  nav.push({ location: 'footer', group: 'FULL CENTER', label: 'All 20 Policies →', to: '/legal' });
  out.navItem = withOrder(nav, 10);

  out.tickerItem = withOrder(TICKER_ITEMS.map((t) => ({ label: t.label, icon: t.icon, text: t.text, to: t.to ?? '' })));

  // ───────── Homepage blocks ─────────
  out.contentBlock = withOrder([
    { key: 'hero.listen', heading: 'Listen page hero', image: M(img('5cca87b44_greenboo.jpeg'), 'Boosie Badazz') },
    { key: 'hero.radio', heading: 'Radio page hero', image: M(unsplash('1511671782779-c97d3d27a1d4')) },
    { key: 'hero.books', heading: 'Books page hero', image: M(unsplash('1495446815901-a7297e633e8d')) },
    { key: 'hero.live', heading: 'Live page hero', image: M(img('f365915ec_generated_image.png')) },
    { key: 'hero.shop', heading: 'Shop page hero', image: M(img('6e5457afb_lakersboo.jpeg'), 'Boosie Badazz') },
    { key: 'hero.join', heading: 'Join page hero', image: M(unsplash('1470225620780-dba8ba36b745')) },
    { key: 'home.welcome', kicker: "THE CULTURE'S NEW HOME", body: 'Music. Movies. Live. Radio. Culture. Artists. Community. Business. The owned digital headquarters of Boosie Badazz.', cta1Label: 'JOIN THE NETWORK', cta1To: '/join', cta2Label: 'JUST WANT TO SHOP', cta2To: '/shopper', image: M(img('7c7dfc24f_hustleboo.jpeg'), 'Boosie Badazz'), extra: { networkLabel: 'NETWORK', note: 'Already a member? Use Sign In up top.', pillars: ['100% INDEPENDENT', 'BATON ROUGE', 'WORLDWIDE'] } },
    { key: 'home.lilBoo', kicker: 'Your Right Hand On The Network', heading: 'Meet Lil Boo', body: "Boosie's own AI assistant. Ask him what to watch, what to listen to, what to buy in the Vault Store, how the membership tiers work, or what's going on across the culture. He meets you where you are — shopper, fan, or creator.", cta1Label: 'ASK LIL BOO', extra: { tags: 'FANS · CREATORS · SHOPPERS' } },
    { key: 'home.familyTier', kicker: 'The Family Tier', heading: 'Interact With Boosie Live and Direct', body: "Members of The Family don't just watch from the sidelines — they talk to Boosie himself. Send direct messages, get closer to the moves, and chop it up with the boss in real time.", cta1Label: 'JOIN THE FAMILY', cta1To: '/join', image: M(img('5cca87b44_greenboo.jpeg'), 'Boosie Badazz') },
    { key: 'home.shopperCta', heading: 'Just Want To Shop?', body: "Create a shopping-only account — sign in and all you see is what's for sale in the Vault Store.", cta1Label: 'CREATE SHOPPER ACCOUNT', cta1To: '/shop-signup' },
    { key: 'home.moreThanBoosie', kicker: 'More Than Boosie', heading: "The Culture's New Home", body: 'Come for the catalog — stay for the culture. Breaking news, the newest dopest songs, the artists breaking next, and every pillar of the movement, all under one roof and streamed through Badazz Radio.' },
    { key: 'home.insideNetwork', kicker: 'More To Explore', heading: 'Inside The Network', body: 'One destination for the news, the music, the artists and everything else — not just a Boosie fan page. Unlock the whole thing with a membership.' },
    { key: 'home.batonRouge', kicker: 'Baton Rouge Legend', heading: 'Built Different. Owned Outright.', body: 'No label. No middleman. No handouts. Boosie Badazz built his name from the ground up — and the Network is where the whole thing lives. Every stream, every drop, every dollar routes straight back to the culture.', cta1Label: 'CLAIM YOUR SPOT', cta1To: '/join', cta2Label: 'HEAR THE CATALOG', cta2To: '/listen', image: M(img('08d4dbae5_boostar.jpeg'), 'Boosie Badazz') },
    { key: 'home.tiers', kicker: 'Choose Your Lane', heading: 'Membership Tiers', body: 'What each subscription unlocks. Pick a tier and hit Join — checkout takes a minute, then we email your sign-in invite to open the full Network. Just here to shop? Create a shopper account instead.', image: M(img('251ed9e01_boocup.jpeg'), 'Boosie Badazz') },
    { key: 'home.howAccess', heading: 'How Access Works', cta1Label: 'JOIN — PICK YOUR PLAN', cta1To: '/join' },
    { key: 'home.workWithUs', kicker: 'An Economy, Not Just Content', heading: 'Want To Work With The Network?', body: "Boosie Network isn't just something people consume — it's an economy people participate in. Bring a deal, book a show, pitch a film, advertise a brand, join the crew.", cta1Label: 'WORK WITH US', cta1To: '/work-with-us' },
    { key: 'home.joinFamily', heading: 'Join The Family', body: "Sign in to stream, shop, go live, and build with the culture's new home.", cta1Label: 'VIEW MEMBERSHIP PLANS', cta1To: '/join', cta2Label: 'SIGN IN', cta2To: '/login' },
  ]);

  out.promotion = withOrder([
    { type: 'strip', slot: 'freeTrial', heading: 'GET YOUR FIRST 30 DAYS FREE', ctaTo: '/join', icon: 'gift' },
    { type: 'banner', slot: 'insiderTrial', kicker: 'First 30 Days Free', heading: 'Try The Insider Tier Free', body: 'Put a card on file and get a full month of Insider access — early drops, members-only posts, Badazz Radio, and exclusive livestream chat badges — on the house. Your first charge happens automatically on day 31. Cancel anytime before then and pay nothing.', ctaLabel: 'CLAIM 30 DAYS FREE', ctaTo: '/join', icon: 'gift' },
    { type: 'banner', slot: 'moviesIncluded', kicker: 'The Family Tier · $9.99/mo', heading: 'Movies Included', body: 'The Family tier comes with full BoosieTV on demand — every movie, series, documentary, and Boosie exclusive, streamed straight to you. Plus direct messages to Boosie, exclusive drops, gold Family badges in live streams, and early ticket access.', ctaLabel: 'JOIN THE FAMILY', ctaTo: '/join', icon: 'tv', image: M(unsplash('1489599849927-2ee91cede3ba')) },
  ]);

  const cards = (group: string, items: { icon: string; title: string; text: string; to?: string; stepNumber?: string }[]) => items.map((c) => ({ group, ...c }));
  out.featureCard = withOrder([
    ...cards('moreThanBoosie', [
      { icon: 'newspaper', title: 'CULTURE', text: 'Breaking stories, editorial & real talk from the movement.' },
      { icon: 'film', title: 'WATCH', text: 'Movies, series, docs & Boosie exclusives on demand.' },
      { icon: 'music', title: 'LISTEN', text: "Boosie's full catalog plus featured artists and the newest dopest songs dropping on the Network." },
      { icon: 'video', title: 'LIVE STREAM', text: 'Real-time streams, catalog battles & premieres.' },
      { icon: 'radio', title: 'BADAZZ RADIO', text: '24/7 curated stations & hosted shows.' },
      { icon: 'shopping-bag', title: 'SHOP', text: 'Apparel, limited drops & collectibles.' },
      { icon: 'users', title: 'COMMUNITY', text: 'Feed, posts, polls & the Boosie faithful.' },
      { icon: 'calendar', title: 'EVENTS', text: 'Every show & appearance on one calendar.' },
    ]),
    ...cards('insideNetwork', [
      { icon: 'radio', title: 'BADAZZ RADIO', text: '24/7 curated stations & hosted shows — free to stream, paid rotation for artists.' },
      { icon: 'video', title: 'LIVE STREAM & BATTLES', text: 'Real-time streams, catalog battles, and premieres — members get chat badges.' },
      { icon: 'store', title: 'THE VAULT STORE', text: 'Apparel, limited drops, collectibles & artist merch shipped worldwide.' },
      { icon: 'calendar', title: 'EVENTS', text: 'Every show, appearance & live stream on one network calendar.' },
    ]),
    ...cards('howAccess', [
      { icon: 'check', stepNumber: '01', title: 'PICK YOUR LANE', text: 'Fan or creator — choose the subscription that fits.' },
      { icon: 'check', stepNumber: '02', title: 'GET ACTIVATED', text: "Boosie's team sets up your membership & sends an email invite." },
      { icon: 'check', stepNumber: '03', title: 'SIGN IN & ENTER', text: 'Use the email you were invited with to unlock the full Network.' },
    ]),
    ...cards('workLane', [
      { icon: ICON.megaphone!, title: 'DO BUSINESS', text: 'Advertising • Sponsorships • Partnerships • Licensing' },
      { icon: ICON.mic!, title: 'BOOK / CREATE', text: 'Bookings • Events • Film • Production • Music' },
      { icon: ICON.heart!, title: 'JOIN THE MOVEMENT', text: 'Artists • Talent • Careers • Vendors • Community' },
    ]),
  ]);

  out.pillar = withOrder(
    PILLARS.map((p) => ({
      kicker: p.kicker, title: p.title, description: p.description, to: p.to,
      ...(p.image ? { image: M(p.image) } : {}),
      ...(p.sprite ? { spriteImage: M(p.sprite.src), spriteX: p.sprite.x, spriteY: p.sprite.y } : {}),
    })),
  );

  // ───────── Videos ─────────
  const KIND: Record<string, string> = { FILM: 'film', SERIES: 'series', VLOG: 'vlog', VIDEO: 'video', INTERVIEW: 'interview', DOCUMENTARY: 'documentary' };
  const ACCESS: Record<string, string> = { FREE: 'free', OWN: 'own', MEMBERS: 'members' };
  const PRICES: Record<string, number> = { 'Birthday X': 24.99, 'No Country for Old Crooks': 19.99, 'Easy Town 4': 9.99, Heartless: 14.99, 'New Raq City': 14.99, "Boosie's CM/NL Tour Vlog — Atlanta": 1.99, "Boosie's CM/NL Tour Vlog — Baton Rouge": 1.99 };
  const NEW_THIS_WEEK_RENT: Record<string, number> = { "Boosie's CM/NL Tour Vlog — Atlanta": 1.99, "Boosie's CM/NL Tour Vlog — Baton Rouge": 1.99, 'Sexy on Wheels — EP 9': 1.99, 'Sexy on Wheels — EP 8': 1.99, 'Sexy on Wheels — EP 7': 1.99 };
  const featured = new Map(FEATURED_ITEMS.filter((f) => f.badge === 'WATCH').map((f, i) => [f.title, FEATURED_ITEMS.indexOf(f) * 10]));
  const justDropped = new Set(['Birthday X', "Boosie's CM/NL Tour Vlog — Atlanta", "Boosie's CM/NL Tour Vlog — Baton Rouge", 'Sexy on Wheels — EP 9', 'Sexy on Wheels — EP 8', 'Sexy on Wheels — EP 7']);
  out.video = withOrder(
    WATCH_TITLES.map((t) => {
      const year = Number(t.meta.match(/^(\d{4})/)?.[1]) || undefined;
      const runtime = Number(t.meta.match(/(\d+)m/)?.[1]) || undefined;
      const ep = t.title.match(/EP (\d+)/)?.[1];
      const doc: Doc = {
        title: t.title, kind: KIND[t.kind] ?? 'video', access: ACCESS[t.access] ?? 'free', metaText: t.meta,
        poster: M(`/assets/images/${t.image}`, t.title), year, runtimeMinutes: runtime,
        ...(PRICES[t.title] ? { price: cents(PRICES[t.title]!) } : {}),
        // "New This Week" on the shopper page shows the watch/rental price of each title.
        ...(NEW_THIS_WEEK_RENT[t.title] ? { rentPrice: cents(NEW_THIS_WEEK_RENT[t.title]!) } : {}),
        ...(t.title.startsWith('Sexy on Wheels') ? { series: 'Sexy on Wheels', episode: ep ? Number(ep) : undefined } : {}),
        featuredOnLanding: featured.has(t.title), ...(featured.has(t.title) ? { featuredOrder: featured.get(t.title) } : {}), justDropped: justDropped.has(t.title),
        shelves: WATCH_SECTIONS.filter((s) => s.titles.includes(t.title)).map((s) => s.name),
      };
      if (t.title === 'Birthday X') {
        Object.assign(doc, {
          year: BIRTHDAY_X.year, runtimeMinutes: BIRTHDAY_X.runtimeMinutes, rating: BIRTHDAY_X.rating, genre: BIRTHDAY_X.genre, synopsis: BIRTHDAY_X.description,
          director: BIRTHDAY_X.director, presentedBy: BIRTHDAY_X.presentedBy, starring: [...BIRTHDAY_X.starring],
          cast: BIRTHDAY_X.cast.map((c) => ({ role: c.role, actor: c.actor })), crew: BIRTHDAY_X.crew.map((c) => ({ role: c.role, name: c.name })),
          rentPrice: cents(9.99), memberPrice: cents(19.99), comingSoon: false, trailer: R('video', { title: 'Birthday X — Official Trailer' }),
        });
      }
      return doc;
    }),
  );

  out.premiere = withOrder([
    {
      video: R('video', { title: 'Birthday X' }), badge: 'OFFICIAL PREMIERE · NOW STREAMING', heading: 'Birthday X', subtitle: 'STARRING OG DRE & BOOSIE BADAZZ',
      description: 'The premiere is here. Own it outright and it stays in your library forever, or rent it for 48 hours and press play tonight. Streaming exclusively on Boosie Network.',
      poster: M(img('1b2d61bac_birthday-x-poster.png'), 'Birthday X'), backdrop: M(img('1b2d61bac_birthday-x-poster.png')),
      tiers: [
        { label: 'MEMBERS', price: cents(19.99), note: 'Buy & keep forever', highlight: true },
        { label: 'EVERYONE', price: cents(24.99), note: 'Buy & keep forever', highlight: false },
        { label: 'RENTAL', price: cents(9.99), note: '48 hours of playback', highlight: false },
      ],
      ctaLabel: 'OWN IT', ctaPrice: cents(24.99), trailerLabel: 'WATCH THE TRAILER', trailerTo: '/watch/birthday-x-trailer',
      priceNote: 'Members pay $19.99 and can also rent · join to save $5.00', isActive: true,
    },
  ]);

  // ───────── Music ─────────
  out.artist = [{ name: 'Boosie Badazz', bio: '', ...published }];
  const durations = new Map<string, string>(VAULT_TRACKS.map((t) => [t.title, t.duration]));
  [['Sticks and Stones', '1:39'], ['That River', '4:45']].forEach(([t, d]) => durations.set(t!, d!));
  const featuredTitles = new Set(VAULT_TRACKS.map((t) => t.title));
  const radioTitles = new Set(RADIO_ROTATION.map((t) => t.title));
  const trackMap = new Map<string, Doc>();
  [...LISTEN_SINGLES, ...RADIO_ROTATION].forEach((s) => {
    const existing = trackMap.get(s.title);
    if (existing) return;
    trackMap.set(s.title, {
      title: s.title, artistName: s.artist, artist: R('artist', { name: 'Boosie Badazz' }), cover: M(`/assets/images/${s.cover}`, s.title),
      duration: durations.get(s.title) ?? '', price: cents(s.price), isSingle: true, inRadioRotation: radioTitles.has(s.title), featuredOnLanding: featuredTitles.has(s.title),
    });
  });
  out.track = withOrder([...trackMap.values()]);

  // ───────── Live ─────────
  const afterDark = FEATURED_ITEMS.find((f) => f.title === 'Boosie After Dark');
  out.liveStream = afterDark ? withOrder([{ title: 'Boosie After Dark', description: 'Boosie Badazz', state: 'scheduled', thumbnail: M(afterDark.image, afterDark.title), accessLevel: 'free', featuredOnLanding: true, featuredOrder: FEATURED_ITEMS.indexOf(afterDark) * 10 }]) : [];

  // ───────── Tour ─────────
  out.tour = [{}];
  out.tourDate = withOrder([{ date: new Date('2026-11-15T02:00:00.000Z'), city: 'Cincinnati', state: 'OH', venue: 'Heritage Bank Center', doorsTime: '8:00 PM', ticketUrl: 'https://www.ticketmaster.com/cash-money-no-limit-tour-cincinnati-11-14-2026/event/160064C8924453D4', lineup: ['Master P', 'Birdman', 'Juvenile', 'Mannie Fresh + more'], specialGuest: 'BOOSIE BADAZZ', phase: 'upcoming' }]);

  // ───────── Culture ─────────
  out.article = withOrder(
    CULTURE_ARTICLES.map((a, i) => ({ title: a.title, category: a.category, tag: a.tag ?? '', excerpt: a.excerpt, body: '', image: M(a.image, a.title), author: a.author, readMinutes: a.readMinutes, featured: i === 0, publishAt: new Date(now.getTime() - (i + 1) * 86400000) })),
  );

  // ───────── Shop ─────────
  const CATEGORY_LABELS = ["Boosie's Closet", 'Official Merch', 'Apparel', 'Accessories', 'Physical Music', 'Digital Music', 'Collectibles', 'Limited Drops', 'Artist Merch', 'Bundles', 'Books'];
  out.productCategory = withOrder(CATEGORY_LABELS.map((label) => ({ label, isClosetLink: label === "Boosie's Closet" })));
  out.product = withOrder(MERCH.map((m) => ({ name: m.name, fromPrice: cents(m.price), images: [M(`/assets/images/merch/${m.image}`, m.name)], fulfilmentBadge: m.badge, category: R('productCategory', { label: 'Official Merch' }), featured: false })));
  out.closetItem = withOrder(
    CLOSET_ITEMS.map((c) => ({
      lot: c.image.match(/LOT_(\d+)/)?.[1] ?? '', title: c.title, images: [M(c.image, c.title)], startingBid: cents(c.startingAt), bidCount: c.bids,
      phase: c.status === 'LIVE' ? 'live' : 'upcoming', ...(c.endsInSeconds ? { endsAt: new Date(now.getTime() + c.endsInSeconds * 1000) } : {}),
    })),
  );
  out.book = [];

  // ───────── Shoutouts ─────────
  out.shoutoutConfig = [{ heroImage: M(TALENT[0]!.image, 'Boosie Badazz — book a shoutout'), captionLines: ['Dap Up', 'The Camera'] }];
  out.shoutoutTalent = withOrder(TALENT.map((t) => ({ name: t.name, slug: t.slug, title: t.title, photo: M(t.image, t.name), fromPrice: cents(t.from), deliveryDays: Number.parseInt(t.delivery, 10) || 7, featured: t.featured, available: t.available })));

  // ───────── Membership ─────────
  out.membershipPlan = withOrder([
    { name: 'Insider', monthlyPrice: cents(4.99), tagline: 'First look at everything Boosie drops.', perks: ['Early access to new music & videos', 'Members-only Community posts', 'Insider news & exclusives', 'Full 24/7 Badazz Radio stream', 'Exclusive livestream chat badges'], freeTrialDays: 30, popular: false, icon: 'star', audienceLabel: 'FAN' },
    { name: 'The Family', monthlyPrice: cents(9.99), tagline: 'Join the family — closer to Boosie, bigger perks, real access.', highlight: 'MOVIES INCLUDED — FULL BOOSIETV ON DEMAND', perks: ['Everything in Insider', 'Movies included — full BoosieTV on demand', 'Send direct messages to Boosie', 'Exclusive content & drops you can’t get anywhere else', 'Exclusive Family-only merch', 'Bigger Vault Store discounts', 'Special gold FAMILY badge in live streams', 'Early concert & event ticket access'], freeTrialDays: 0, popular: true, icon: 'crown', audienceLabel: 'FAN' },
  ]);

  // ───────── Work with us ─────────
  out.workPage = [{ heroImage: M(img('7c7dfc24f_hustleboo.jpeg'), 'Boosie Badazz'), heroBody: "Boosie Network is more than entertainment. We're building an independent ecosystem across music, film, live entertainment, culture, media, advertising, commerce, artists, partnerships and community. If you've got something real to bring to the table, tell us what you're working with.", intakeBody: "Pick what you're here for, tell us about you, and answer a few targeted questions. Then it routes straight into the Boosie Network operating system — no lost emails, no mystery ownership." }];
  out.workDoor = withOrder(DOOR_GROUPS.flatMap((g) => g.doors.map((d) => ({ group: g.name, title: d.title, text: d.text, cta: d.cta }))));

  // ───────── Legal ─────────
  const ICONS_BY_CATEGORY: Record<string, string> = { Core: 'shield-check', Creators: 'users', 'Community & IP': 'scale', 'Commerce & Events': 'shopping-bag', Business: 'briefcase' };
  out.legalCategory = withOrder(LEGAL_CATEGORIES.map((label) => ({ label, icon: ICONS_BY_CATEGORY[label] })));
  out.legalDocument = withOrder(
    LEGAL_DOCS.map((d) => {
      const file = path.join(here, 'legal', `${d.slug}.md`);
      return { title: d.title, slug: d.slug, category: R('legalCategory', { label: d.category }), bodyMarkdown: fs.readFileSync(file, 'utf8'), effectiveDate: 'AUGUST 29, 2026', showDraftNote: false, version: '1' };
    }),
  );

  // ───────── Comments ─────────
  out.comment = BIRTHDAY_X.comments.map((c) => ({ video: R('video', { title: 'Birthday X' }), author: c.user, tier: c.tier, text: c.text, likes: 0, commentStatus: 'visible', createdAt: new Date(now.getTime() - (Number.parseInt(c.when, 10) || 0) * 86_400_000) }));

  return out;
}

/** Order resources must be inserted in so references resolve (a resource only references earlier ones, except video.trailer which is patched). */
export const SEED_ORDER = [
  'siteSettings', 'siteText', 'navItem', 'tickerItem', 'contentBlock', 'promotion', 'featureCard', 'pillar',
  'video', 'premiere', 'artist', 'track', 'liveStream', 'tour', 'tourDate', 'article', 'productCategory', 'product', 'closetItem', 'book',
  'shoutoutConfig', 'shoutoutTalent', 'membershipPlan', 'workPage', 'workDoor', 'legalCategory', 'legalDocument', 'comment',
];
