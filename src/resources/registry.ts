import { bool, date, json, md, media, mediaList, money, num, objList, ref, sel, str, strList, text } from './helpers.js';
import type { ResourceSpec, Role } from './types.js';

const CONTENT: Role[] = ['superadmin', 'admin', 'editor'];
const ADMINS: Role[] = ['superadmin', 'admin'];
const INBOX: Role[] = ['superadmin', 'admin', 'support'];
const ICONS = ['flame', 'megaphone', 'film', 'crown', 'gift', 'star', 'sparkles', 'tv', 'music', 'radio', 'video', 'calendar', 'users', 'shopping-bag', 'store', 'newspaper', 'briefcase', 'mic', 'heart', 'check'] as const;

/**
 * Every manageable content type on the Boosie Network site.
 * See ADMIN_CONTENT_INVENTORY.md §5/§6 for how each maps to pages and components.
 */
export const RESOURCES: ResourceSpec[] = [
  // ───────────────────────── Site chrome & settings ─────────────────────────
  {
    key: 'siteSettings', path: 'site-settings', label: 'Site Settings', singular: 'Site settings', module: 'Site',
    singleton: true, publishable: false, publicRead: true, writeRoles: ADMINS, titleField: 'siteName', searchFields: ['siteName'],
    description: 'Global identity, SEO, footer, assistant and radio-launcher settings.',
    fields: [
      str('siteName', 'Site name', { required: true, group: 'Identity', default: 'Boosie Network' }),
      str('tagline', 'Footer tagline', { group: 'Identity', default: "The Culture's Digital Headquarters. Owned & operated by Boosie Badazz." }),
      media('logo', 'Logo', { group: 'Identity' }),
      media('favicon', 'Favicon', { group: 'Identity' }),
      str('seoTitle', 'SEO title', { group: 'SEO', default: "Boosie Network — The Culture's New Home" }),
      text('seoDescription', 'SEO description', { group: 'SEO' }),
      media('ogImage', 'Social share image', { group: 'SEO' }),
      str('footerCopyright', 'Footer copyright line', { group: 'Footer', default: '© 2026 Boosie Network. Policies effective August 29, 2026. Drafts — not legal advice.' }),
      str('policiesEffectiveDate', 'Policies effective date', { group: 'Footer', default: 'August 29, 2026' }),
      str('contactEmail', 'Contact email', { group: 'Contact' }),
      str('timezone', 'Display timezone', { group: 'Contact', default: 'America/Chicago' }),
      strList('watchShelfOrder', 'Watch page rail order', { group: 'Watch', help: 'Rail names from top to bottom, e.g. All Media, Free, Films. Rails not listed follow in the order they first appear.' }),
      money('defaultSinglePrice', 'Default single-track price', { group: 'Music', default: 99 }),
      bool('lilBooEnabled', 'Lil Boo assistant enabled', { group: 'Lil Boo', default: true }),
      media('lilBooAvatar', 'Lil Boo avatar', { group: 'Lil Boo' }),
      text('lilBooGreeting', 'Lil Boo greeting', { group: 'Lil Boo', default: "What's good! I'm Lil Boo. Ask me what to watch, what to listen to, or what's dropping in the Vault Store." }),
      text('lilBooDemoReply', 'Lil Boo reply (until a real AI provider is connected)', { group: 'Lil Boo', default: 'Demo mode: Lil Boo is not connected to a live assistant in this frontend build.' }),
      bool('radioLauncherEnabled', 'Floating radio launcher enabled', { group: 'Radio launcher', default: true }),
      str('radioLauncherTarget', 'Radio launcher link', { group: 'Radio launcher', default: '/radio' }),
    ],
  },
  {
    key: 'siteText', path: 'site-texts', label: 'Site Text', singular: 'Text', module: 'Site',
    publishable: false, publicRead: true, writeRoles: CONTENT, titleField: 'key', searchFields: ['key', 'value', 'group'], defaultSort: 'group',
    description: 'Small editable strings (page headings, taglines, empty-state copy). Each key is used by one spot on the public site.',
    fields: [
      str('key', 'Key', { required: true, list: true, max: 120, help: 'e.g. radio.hero.title' }),
      text('value', 'Text', { required: true, list: true, max: 4000 }),
      str('group', 'Page / group', { list: true, filter: true }),
      str('description', 'Where it appears'),
    ],
  },
  {
    key: 'navItem', path: 'navigation', label: 'Navigation', singular: 'Link', module: 'Site',
    publishable: true, orderable: true, publicRead: true, writeRoles: ADMINS, titleField: 'label', searchFields: ['label', 'to'], defaultSort: 'location',
    description: 'Header, header pills, mobile tab bar, mobile menu, shopper menu and footer links.',
    fields: [
      sel('location', 'Location', ['main', 'pill', 'mobileTab', 'mobileMenu', 'shopper', 'footer'], { required: true, list: true, filter: true }),
      str('group', 'Footer column heading', { help: 'Only for footer links, e.g. LEGAL', list: true, filter: true }),
      str('label', 'Label', { required: true, list: true }),
      str('to', 'Link', { required: true, list: true, help: 'Site path (/watch) or full URL' }),
      bool('external', 'Opens in a new tab'),
      sel('icon', 'Icon', ['', 'home', 'newspaper', 'tv', 'music', 'shopping-bag', 'book-open', 'circle-play']),
      sel('style', 'Style', ['plain', 'gold', 'outline']),
    ],
  },
  {
    key: 'tickerItem', path: 'ticker', label: 'News Ticker', singular: 'Ticker item', module: 'Site',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'text', searchFields: ['text', 'label'],
    description: 'The scrolling "BOOSIE NEWS" bar at the top of every page.',
    fields: [
      str('label', 'Label', { required: true, list: true, default: 'BREAKING:' }),
      sel('icon', 'Icon', ['flame', 'megaphone', 'film'], { list: true }),
      str('text', 'Headline', { required: true, list: true }),
      str('to', 'Link (optional)'),
      date('startsAt', 'Show from'),
      date('endsAt', 'Hide after'),
    ],
  },

  // ───────────────────────── Homepage blocks ─────────────────────────
  {
    key: 'contentBlock', path: 'content-blocks', label: 'Homepage Blocks', singular: 'Block', module: 'Homepage',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'key', searchFields: ['key', 'heading'],
    description: 'Hero, banners and call-to-action sections on the homepage. Each block has a fixed key the site looks up.',
    fields: [
      str('key', 'Key', { required: true, list: true, help: 'home.welcome, home.familyTier, home.shopperCta, home.batonRouge, home.joinFamily, home.lilBoo…' }),
      str('kicker', 'Kicker'),
      str('heading', 'Heading', { list: true }),
      text('body', 'Body text'),
      str('cta1Label', 'Button 1 label'),
      str('cta1To', 'Button 1 link'),
      str('cta2Label', 'Button 2 label'),
      str('cta2To', 'Button 2 link'),
      media('image', 'Image'),
      json('extra', 'Extra data (advanced)'),
    ],
  },
  {
    key: 'promotion', path: 'promotions', label: 'Promotions', singular: 'Promotion', module: 'Homepage',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'heading', searchFields: ['heading', 'kicker'],
    description: 'The free-trial strip and the large promo banners.',
    fields: [
      sel('type', 'Type', ['strip', 'banner'], { required: true, list: true, filter: true }),
      str('slot', 'Slot key', { help: 'freeTrial, insiderTrial, moviesIncluded' }),
      str('kicker', 'Kicker'),
      str('heading', 'Heading', { required: true, list: true }),
      text('body', 'Body text'),
      str('ctaLabel', 'Button label'),
      str('ctaTo', 'Button link'),
      sel('icon', 'Icon', ICONS),
      media('image', 'Background image'),
      date('startsAt', 'Show from'),
      date('endsAt', 'Hide after'),
    ],
  },
  {
    key: 'featureCard', path: 'feature-cards', label: 'Feature Cards', singular: 'Card', module: 'Homepage',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'text'],
    description: '"More Than Boosie", "Inside The Network", "How Access Works" and the Work With Us lanes.',
    fields: [
      sel('group', 'Group', ['moreThanBoosie', 'insideNetwork', 'howAccess', 'workLane'], { required: true, list: true, filter: true }),
      sel('icon', 'Icon', ICONS),
      str('title', 'Title', { required: true, list: true }),
      text('text', 'Text', { list: true }),
      str('to', 'Link'),
      str('stepNumber', 'Step number', { help: 'Only for "How Access Works", e.g. 01' }),
    ],
  },
  {
    key: 'pillar', path: 'pillars', label: 'Pillars', singular: 'Pillar', module: 'Homepage',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'kicker'],
    description: 'The "Eight Pillars. One Empire." tiles.',
    fields: [
      str('kicker', 'Kicker', { required: true, list: true }),
      str('title', 'Title', { required: true, list: true }),
      text('description', 'Description', { required: true }),
      str('to', 'Link', { required: true, list: true }),
      media('image', 'Cover photo'),
      media('spriteImage', 'Sprite sheet (alternative to photo)'),
      num('spriteX', 'Sprite X %'),
      num('spriteY', 'Sprite Y %'),
    ],
  },
  {
    key: 'premiere', path: 'premieres', label: 'Premieres', singular: 'Premiere', module: 'Homepage',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'heading', searchFields: ['heading'],
    description: 'The big featured premiere at the top of the homepage. Only the active one shows.',
    fields: [
      ref('video', 'Linked video', 'video', { help: 'Used for the trailer and detail link' }),
      str('badge', 'Badge', { default: 'OFFICIAL PREMIERE · NOW STREAMING' }),
      str('heading', 'Title', { required: true, list: true }),
      str('subtitle', 'Subtitle'),
      text('description', 'Description'),
      media('poster', 'Poster'),
      media('backdrop', 'Backdrop (right-hand faded image)'),
      objList('tiers', 'Price tiers', [str('label', 'Label'), money('price', 'Price'), str('note', 'Note'), bool('highlight', 'Highlight')]),
      str('ctaLabel', 'Buy button label', { default: 'OWN IT' }),
      money('ctaPrice', 'Buy button price'),
      str('trailerLabel', 'Trailer button label', { default: 'WATCH THE TRAILER' }),
      str('trailerTo', 'Trailer link'),
      str('priceNote', 'Price note'),
      bool('isActive', 'Active on homepage', { list: true, default: true }),
    ],
  },

  // ───────────────────────── Watch ─────────────────────────
  {
    key: 'video', path: 'videos', label: 'Videos', singular: 'Video', module: 'Watch',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'title', writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'series', 'genre'],
    description: 'Films, series, vlogs, interviews and trailers on the Watch page and title pages.',
    fields: [
      str('title', 'Title', { required: true, list: true, group: 'Basics' }),
      sel('kind', 'Kind', ['film', 'series', 'vlog', 'video', 'interview', 'documentary'], { required: true, list: true, filter: true, group: 'Basics' }),
      sel('access', 'Access', ['free', 'members', 'own'], { required: true, list: true, filter: true, group: 'Basics' }),
      media('poster', 'Poster (tall)', { group: 'Basics' }),
      media('thumbnail', 'Thumbnail (optional)', { group: 'Basics' }),
      str('metaText', 'Card sub-line', { group: 'Basics', help: 'e.g. 2026 · 85m · NR. Leave empty to build it from year/runtime/rating.' }),
      num('year', 'Year', { group: 'Details', list: true }),
      num('runtimeMinutes', 'Runtime (minutes)', { group: 'Details' }),
      str('rating', 'Rating', { group: 'Details', default: 'NR' }),
      str('genre', 'Genre', { group: 'Details' }),
      text('synopsis', 'Synopsis', { group: 'Details' }),
      str('director', 'Directed by', { group: 'Credits' }),
      str('presentedBy', 'Presented by', { group: 'Credits' }),
      strList('starring', 'Starring', { group: 'Credits' }),
      objList('cast', 'Cast', [str('role', 'Role'), str('actor', 'Actor')], { group: 'Credits' }),
      objList('crew', 'Crew', [str('role', 'Role'), str('name', 'Name')], { group: 'Credits' }),
      str('series', 'Series name', { group: 'Series' }),
      num('episode', 'Episode number', { group: 'Series' }),
      money('price', 'Price to own', { group: 'Pricing', list: true }),
      money('rentPrice', 'Rental price', { group: 'Pricing' }),
      money('memberPrice', 'Member price to own', { group: 'Pricing' }),
      sel('playbackProvider', 'Playback provider', ['none', 'bunny', 'youtube', 'vimeo', 'url'], { group: 'Playback' }),
      str('playbackRef', 'Playback id / URL', { group: 'Playback' }),
      ref('trailer', 'Trailer video', 'video', { group: 'Playback' }),
      bool('comingSoon', 'Coming soon / next attraction', { group: 'Flags', list: true }),
      bool('featuredOnLanding', 'Featured on homepage', { group: 'Flags', list: true, filter: true }),
      num('featuredOrder', 'Order in "Featured on the Network"', { group: 'Flags', help: 'Lower numbers first; shared with Live Streams.' }),
      bool('justDropped', 'Show in "Just Dropped" (shopper page)', { group: 'Flags', filter: true }),
      strList('shelves', 'Watch page rails', { group: 'Listing', help: 'Rail names this title appears in on the Watch page, e.g. Films or Free. A title with no rail appears in "All Media".' }),
    ],
  },

  // ───────────────────────── Music & radio ─────────────────────────
  {
    key: 'artist', path: 'artists', label: 'Artists', singular: 'Artist', module: 'Music',
    publishable: true, publicRead: true, slugFrom: 'name', writeRoles: CONTENT, titleField: 'name', searchFields: ['name'],
    fields: [str('name', 'Name', { required: true, list: true }), text('bio', 'Bio'), media('photo', 'Photo')],
  },
  {
    key: 'album', path: 'albums', label: 'Albums', singular: 'Album', module: 'Music',
    publishable: true, publicRead: true, slugFrom: 'title', writeRoles: CONTENT, titleField: 'title', searchFields: ['title'],
    fields: [
      str('title', 'Title', { required: true, list: true }),
      ref('artist', 'Artist', 'artist', { list: true }),
      media('cover', 'Cover'),
      money('price', 'Price', { list: true }),
      date('releaseDate', 'Release date'),
      bool('featuredOnLanding', 'Featured on homepage', { filter: true }),
    ],
  },
  {
    key: 'track', path: 'tracks', label: 'Tracks', singular: 'Track', module: 'Music',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'title', writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'artistName'],
    description: 'Singles on the Listen page, the radio rotation pool and the homepage "Fresh From The Vault" list.',
    fields: [
      str('title', 'Title', { required: true, list: true }),
      str('artistName', 'Artist name', { list: true, default: 'Boosie Badazz' }),
      ref('artist', 'Artist record (optional)', 'artist'),
      ref('album', 'Album (optional)', 'album'),
      media('cover', 'Cover art'),
      media('audio', 'Audio file'),
      str('duration', 'Duration', { help: 'm:ss, e.g. 5:22' }),
      money('price', 'Price', { list: true, default: 99 }),
      bool('isSingle', 'Sold as a single', { list: true, filter: true, default: true }),
      bool('inRadioRotation', 'In radio rotation', { list: true, filter: true }),
      bool('featuredOnLanding', 'Featured on homepage', { list: true, filter: true }),
    ],
  },
  {
    key: 'radioShow', path: 'radio-shows', label: 'Radio Shows', singular: 'Show', module: 'Music',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'host'],
    description: 'Weekly schedule on the Radio page.',
    fields: [
      str('title', 'Show', { required: true, list: true }),
      str('host', 'Host', { list: true }),
      sel('day', 'Day', ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], { list: true, filter: true }),
      str('startTime', 'Start time', { list: true }),
      str('endTime', 'End time'),
      text('description', 'Description'),
      media('image', 'Image'),
    ],
  },
  {
    key: 'radioSubmission', path: 'radio-submissions', label: 'Radio Submissions', singular: 'Submission', module: 'Inbox',
    publishable: false, publicRead: false, writeRoles: INBOX, titleField: 'trackTitle', searchFields: ['artistName', 'trackTitle', 'email'], defaultSort: '-createdAt',
    publicSubmit: { rateLimitPerHour: 10, defaults: { inboxStatus: 'new' } },
    fields: [
      str('artistName', 'Artist', { required: true, list: true, submit: true }),
      str('email', 'Email', { required: true, list: true, submit: true }),
      str('trackTitle', 'Track', { required: true, list: true, submit: true }),
      str('link', 'Link', { submit: true }),
      text('notes', 'Notes', { submit: true }),
      sel('inboxStatus', 'Status', ['new', 'approved', 'rejected'], { list: true, filter: true }),
    ],
  },

  // ───────────────────────── Live ─────────────────────────
  {
    key: 'liveStream', path: 'live', label: 'Live Streams', singular: 'Stream', module: 'Live',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'title', searchFields: ['title'],
    fields: [
      str('title', 'Title', { required: true, list: true }),
      text('description', 'Description'),
      sel('state', 'State', ['scheduled', 'live', 'ended'], { list: true, filter: true }),
      date('scheduledFor', 'Scheduled for', { list: true }),
      media('thumbnail', 'Thumbnail'),
      sel('playbackProvider', 'Playback provider', ['none', 'bunny', 'youtube', 'vimeo', 'url']),
      str('playbackRef', 'Playback id / URL'),
      sel('accessLevel', 'Access', ['free', 'members']),
      bool('featuredOnLanding', 'Featured on homepage', { filter: true }),
      num('featuredOrder', 'Order in "Featured on the Network"', { help: 'Lower numbers first; shared with Videos.' }),
    ],
  },
  {
    key: 'liveSubscriber', path: 'live-subscribers', label: 'Live Subscribers', singular: 'Subscriber', module: 'Inbox',
    publishable: false, publicRead: false, writeRoles: INBOX, titleField: 'email', searchFields: ['email'], defaultSort: '-createdAt',
    publicSubmit: { rateLimitPerHour: 20 },
    description: 'People who tapped "Sign Up for Notifications" on the Live page.',
    fields: [str('email', 'Email', { required: true, list: true, submit: true }), ref('stream', 'Stream', 'liveStream', { submit: true })],
  },

  // ───────────────────────── Tour & events ─────────────────────────
  {
    key: 'tour', path: 'tour', label: 'Tour Page', singular: 'Tour page', module: 'Tour',
    singleton: true, publishable: false, publicRead: true, writeRoles: CONTENT, titleField: 'headline', searchFields: ['headline'],
    fields: [
      str('kicker', 'Kicker', { default: 'The Biggest Tour of 2026' }),
      str('headline', 'Headline', { required: true, default: 'Boosie Badazz' }),
      str('subheadline', 'Second line', { default: 'On Tour' }),
      str('pill', 'Tour name pill', { default: 'CASH MONEY × NO LIMIT TOUR' }),
      str('tagline', 'Tagline', { default: 'Two legendary empires. One massive tour. Boosie Badazz live.' }),
      str('tourName', 'Tour name (short)', { default: 'Cash Money & No Limit Tour' }),
      str('eventsExternalLabel', 'Events link label', { default: 'BROWSE BOOSIEEVENTS.COM' }),
      str('eventsExternalUrl', 'Events link URL', { default: 'https://boosieevents.com' }),
    ],
  },
  {
    key: 'tourDate', path: 'tour-dates', label: 'Tour Dates', singular: 'Tour date', module: 'Tour',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'city', searchFields: ['city', 'venue'], defaultSort: 'date',
    fields: [
      date('date', 'Date & time', { required: true, list: true }),
      str('city', 'City', { required: true, list: true }),
      str('state', 'State', { list: true }),
      str('venue', 'Venue', { list: true }),
      str('doorsTime', 'Time label', { help: 'e.g. 8:00 PM' }),
      str('ticketUrl', 'Ticket link'),
      strList('lineup', 'Lineup'),
      str('specialGuest', 'Special guest'),
      sel('phase', 'Phase', ['upcoming', 'past', 'cancelled'], { list: true, filter: true }),
    ],
  },
  {
    key: 'event', path: 'events', label: 'Events', singular: 'Event', module: 'Tour',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'title', writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'city'], defaultSort: 'date',
    fields: [
      str('title', 'Title', { required: true, list: true }),
      date('date', 'Date & time', { required: true, list: true }),
      str('city', 'City', { list: true }),
      str('venue', 'Venue'),
      media('image', 'Image'),
      str('ticketUrl', 'Ticket link'),
      text('description', 'Description'),
    ],
  },

  // ───────────────────────── Culture ─────────────────────────
  {
    key: 'article', path: 'articles', label: 'Articles', singular: 'Article', module: 'Culture',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'title', writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'author', 'category'], defaultSort: '-publishAt',
    fields: [
      str('title', 'Headline', { required: true, list: true }),
      str('category', 'Category', { list: true, filter: true }),
      str('tag', 'Tag'),
      text('excerpt', 'Excerpt'),
      md('body', 'Article body (markdown)'),
      media('image', 'Cover image'),
      str('author', 'Author', { list: true }),
      num('readMinutes', 'Read time (minutes)'),
      bool('featured', 'Lead story', { list: true, filter: true }),
    ],
  },

  // ───────────────────────── Shop ─────────────────────────
  {
    key: 'productCategory', path: 'product-categories', label: 'Product Categories', singular: 'Category', module: 'Shop',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'label', writeRoles: CONTENT, titleField: 'label', searchFields: ['label'],
    description: 'The filter chips on the Shop page.',
    fields: [str('label', 'Label', { required: true, list: true }), bool('isClosetLink', 'Links to the Closet instead of products')],
  },
  {
    key: 'product', path: 'products', label: 'Products', singular: 'Product', module: 'Shop',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'name', writeRoles: CONTENT, titleField: 'name', searchFields: ['name'], defaultSort: 'sortOrder',
    fields: [
      str('name', 'Name', { required: true, list: true }),
      ref('category', 'Category', 'productCategory', { list: true, filter: true }),
      money('fromPrice', 'From price', { required: true, list: true }),
      mediaList('images', 'Images (first is the main image)'),
      text('description', 'Description'),
      str('fulfilmentBadge', 'Badge', { default: '4W' }),
      str('externalUrl', 'Checkout / fulfilment link'),
      objList('variants', 'Variants', [str('label', 'Label'), money('price', 'Price')]),
      bool('featured', 'Featured', { list: true, filter: true }),
    ],
  },
  {
    key: 'closetItem', path: 'closet', label: 'Closet Auctions', singular: 'Lot', module: 'Shop',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'title', searchFields: ['title', 'lot'],
    description: "Boosie's Closet one-of-one auction lots.",
    fields: [
      str('lot', 'Lot number', { list: true }),
      str('title', 'Title', { required: true, list: true }),
      text('description', 'Description'),
      mediaList('images', 'Photos (first is the main photo)'),
      money('startingBid', 'Starting bid', { required: true, list: true }),
      money('bidIncrement', 'Bid increment'),
      num('bidCount', 'Bids so far'),
      date('startsAt', 'Opens'),
      date('endsAt', 'Closes', { list: true }),
      sel('phase', 'Status', ['upcoming', 'live', 'ended', 'won'], { required: true, list: true, filter: true }),
    ],
  },
  {
    key: 'book', path: 'books', label: 'Books', singular: 'Book', module: 'Shop',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'title', writeRoles: CONTENT, titleField: 'title', searchFields: ['title'],
    fields: [
      str('title', 'Title', { required: true, list: true }),
      sel('format', 'Format', ['paperback', 'kindle', 'audiobook'], { required: true, list: true, filter: true }),
      media('cover', 'Cover'),
      money('price', 'Price', { list: true }),
      str('kdpUrl', 'Amazon KDP link'),
      text('description', 'Description'),
    ],
  },

  // ───────────────────────── Shoutouts ─────────────────────────
  {
    key: 'shoutoutConfig', path: 'shoutout-config', label: 'Shoutouts Page', singular: 'Shoutouts page', module: 'Shoutouts',
    singleton: true, publishable: false, publicRead: true, writeRoles: CONTENT, titleField: 'headline', searchFields: ['headline'],
    fields: [
      str('kicker', 'Kicker', { default: 'Personalized Videos' }),
      str('headline', 'Headline', { required: true, default: 'Boosie Shoutouts' }),
      str('subhead', 'Subheading', { default: 'Personalized videos direct from Boosie and the family.' }),
      text('intro', 'Intro paragraph', { default: "Book a personal video direct from Boosie and approved talent. Tell them who it's for — they'll record it and send it back." }),
      media('heroImage', 'Hero photo'),
      strList('captionLines', 'Photo caption lines'),
      str('chooseHeading', 'Talent section heading', { default: 'Choose Talent' }),
    ],
  },
  {
    key: 'shoutoutTalent', path: 'shoutout-talent', label: 'Shoutout Talent', singular: 'Talent', module: 'Shoutouts',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'name', writeRoles: CONTENT, titleField: 'name', searchFields: ['name'],
    fields: [
      str('name', 'Name', { required: true, list: true }),
      str('title', 'Title / tagline', { list: true, default: 'RAPPER / LEGEND' }),
      media('photo', 'Photo'),
      money('fromPrice', 'From price', { required: true, list: true }),
      num('deliveryDays', 'Delivery (days)', { default: 7 }),
      bool('featured', 'Featured badge', { default: true }),
      bool('available', 'Accepting bookings', { list: true, default: true }),
    ],
  },
  {
    key: 'shoutoutOrder', path: 'shoutout-orders', label: 'Shoutout Orders', singular: 'Order', module: 'Inbox',
    publishable: false, publicRead: false, writeRoles: INBOX, titleField: 'recipient', searchFields: ['recipient', 'buyerEmail'], defaultSort: '-createdAt',
    publicSubmit: { rateLimitPerHour: 10, defaults: { orderStatus: 'new' } },
    fields: [
      ref('talent', 'Talent', 'shoutoutTalent', { required: true, list: true, submit: true }),
      str('recipient', 'Who is it for', { required: true, list: true, submit: true }),
      str('occasion', 'Occasion', { submit: true }),
      text('instructions', 'Instructions', { submit: true }),
      str('buyerEmail', 'Buyer email', { list: true, submit: true }),
      money('price', 'Price', { list: true }),
      sel('orderStatus', 'Status', ['new', 'in_progress', 'delivered', 'refunded'], { list: true, filter: true }),
      str('deliveredUrl', 'Delivered video link'),
    ],
  },

  // ───────────────────────── Membership ─────────────────────────
  {
    key: 'membershipPlan', path: 'membership-plans', label: 'Membership Plans', singular: 'Plan', module: 'Membership',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'name', writeRoles: ADMINS, titleField: 'name', searchFields: ['name'],
    description: 'Tier cards on the homepage and the Join page.',
    fields: [
      str('name', 'Name', { required: true, list: true }),
      money('monthlyPrice', 'Monthly price', { required: true, list: true }),
      num('yearlyDiscountPct', 'Yearly discount %', { default: 15 }),
      str('tagline', 'Tagline'),
      strList('perks', 'Perks'),
      num('freeTrialDays', 'Free trial days'),
      bool('popular', 'Show POPULAR badge', { list: true }),
      str('highlight', 'Highlight chip text'),
      sel('icon', 'Icon', ['star', 'crown', 'users', 'sparkles']),
      str('audienceLabel', 'Footer label', { default: 'FAN' }),
    ],
  },

  // ───────────────────────── Work with us ─────────────────────────
  {
    key: 'workPage', path: 'work-page', label: 'Work With Us Page', singular: 'Work With Us page', module: 'Work With Us',
    singleton: true, publishable: false, publicRead: true, writeRoles: CONTENT, titleField: 'heroTitle', searchFields: ['heroTitle'],
    fields: [
      str('heroBadge', 'Hero badge', { default: 'THE BUSINESS FRONT DOOR' }),
      str('heroTitle', 'Hero title', { required: true, default: 'Work With Us.' }),
      str('heroTagline', 'Hero tagline', { default: 'Big ideas. Real business. Direct access.' }),
      text('heroBody', 'Hero paragraph'),
      media('heroImage', 'Hero photo'),
      str('ctaPrimary', 'Primary button', { default: "LET'S DO BUSINESS" }),
      str('ctaSecondary', 'Secondary button', { default: 'EXPLORE OPPORTUNITIES' }),
      str('footnote', 'Footnote', { default: "Don't just contact the network. Do business with the network." }),
      str('lanesKicker', 'Lanes kicker', { default: 'Three Ways In' }),
      str('lanesHeading', 'Lanes heading', { default: 'Do Business. Book & Create. Join The Movement.' }),
      str('intakeKicker', 'Intake kicker', { default: 'The Intake Engine' }),
      str('intakeTitle', 'Intake title', { default: 'Start Your Opportunity' }),
      text('intakeBody', 'Intake paragraph'),
      str('doorsHeading', 'Doors heading', { default: 'What do you want to do with Boosie Network?' }),
      str('doorsSubheading', 'Doors subheading', { default: 'Pick a door. Each one leads somewhere different in the empire.' }),
      str('footerLine', 'Page footer line', { default: '© Boosie Network. The Business Front Door.' }),
    ],
  },
  {
    key: 'workDoor', path: 'work-doors', label: 'Work With Us Doors', singular: 'Door', module: 'Work With Us',
    publishable: true, orderable: true, publicRead: true, writeRoles: CONTENT, titleField: 'title', searchFields: ['title'],
    fields: [
      sel('group', 'Group', ['DO BUSINESS', 'BOOK / CREATE', 'JOIN THE MOVEMENT', 'GENERAL INQUIRY'], { required: true, list: true, filter: true }),
      str('title', 'Title', { required: true, list: true }),
      str('text', 'Description', { required: true, list: true }),
      str('cta', 'Button label', { required: true }),
      str('routeToEmail', 'Route submissions to (email)'),
    ],
  },
  {
    key: 'opportunity', path: 'opportunities', label: 'Work With Us Submissions', singular: 'Submission', module: 'Inbox',
    publishable: false, publicRead: false, writeRoles: INBOX, titleField: 'name', searchFields: ['name', 'email', 'company', 'doorTitle'], defaultSort: '-createdAt',
    publicSubmit: { rateLimitPerHour: 10, defaults: { oppStatus: 'new' } },
    fields: [
      str('doorTitle', 'Door', { required: true, list: true, submit: true }),
      str('name', 'Name', { required: true, list: true, submit: true }),
      str('email', 'Email', { required: true, list: true, submit: true }),
      str('company', 'Company / project', { submit: true }),
      text('message', 'Message', { required: true, submit: true, max: 8000 }),
      sel('oppStatus', 'Status', ['new', 'reviewing', 'replied', 'closed'], { list: true, filter: true }),
      text('notes', 'Internal notes'),
    ],
  },
  {
    key: 'contactMessage', path: 'contact-messages', label: 'Contact Messages', singular: 'Message', module: 'Inbox',
    publishable: false, publicRead: false, writeRoles: INBOX, titleField: 'name', searchFields: ['name', 'email', 'message'], defaultSort: '-createdAt',
    publicSubmit: { rateLimitPerHour: 10, defaults: { msgStatus: 'new' } },
    fields: [
      str('name', 'Name', { required: true, list: true, submit: true }),
      str('email', 'Email', { required: true, list: true, submit: true }),
      text('message', 'Message', { required: true, list: true, submit: true, max: 8000 }),
      sel('msgStatus', 'Status', ['new', 'handled'], { list: true, filter: true }),
    ],
  },

  // ───────────────────────── Legal ─────────────────────────
  {
    key: 'legalCategory', path: 'legal-categories', label: 'Legal Categories', singular: 'Category', module: 'Legal',
    publishable: true, orderable: true, publicRead: true, writeRoles: ADMINS, titleField: 'label', searchFields: ['label'],
    fields: [str('label', 'Label', { required: true, list: true }), sel('icon', 'Icon', ['shield-check', 'users', 'scale', 'shopping-bag', 'briefcase'])],
  },
  {
    key: 'legalDocument', path: 'legal-documents', label: 'Legal Policies', singular: 'Policy', module: 'Legal',
    publishable: true, orderable: true, publicRead: true, slugFrom: 'title', writeRoles: ADMINS, titleField: 'title', searchFields: ['title'],
    fields: [
      str('title', 'Title', { required: true, list: true }),
      ref('category', 'Category', 'legalCategory', { required: true, list: true, filter: true }),
      md('bodyMarkdown', 'Policy text (markdown)', { required: true }),
      str('effectiveDate', 'Effective date', { list: true, default: 'AUGUST 29, 2026' }),
      bool('showDraftNote', 'Show the drafting note'),
      str('version', 'Version', { default: '1' }),
    ],
  },

  // ───────────────────────── Engagement / orders ─────────────────────────
  {
    key: 'comment', path: 'comments', label: 'Comments', singular: 'Comment', module: 'Inbox',
    publishable: false, publicRead: true, publicFilter: { commentStatus: 'visible' }, writeRoles: INBOX, titleField: 'text', searchFields: ['author', 'text'], defaultSort: '-createdAt',
    publicSubmit: { rateLimitPerHour: 30, defaults: { commentStatus: 'visible', tier: 'GUEST', likes: 0 } },
    description: 'Viewer comments on title pages. Hide or delete to moderate.',
    fields: [
      ref('video', 'Video', 'video', { required: true, list: true, filter: true, submit: true }),
      str('author', 'Author', { required: true, list: true, submit: true, max: 60 }),
      str('tier', 'Badge', { list: true }),
      text('text', 'Comment', { required: true, list: true, submit: true, max: 1000 }),
      num('likes', 'Likes'),
      sel('commentStatus', 'Status', ['visible', 'hidden'], { list: true, filter: true }),
    ],
  },
  {
    key: 'order', path: 'orders', label: 'Orders', singular: 'Order', module: 'Inbox',
    publishable: false, publicRead: false, writeRoles: INBOX, titleField: 'number', searchFields: ['number', 'buyerEmail'], defaultSort: '-createdAt',
    description: 'Carts submitted from checkout. Prices are always recomputed on the server. No payment is captured until a payment provider is connected.',
    publicSubmit: { rateLimitPerHour: 20, defaults: { orderStatus: 'pending' } },
    fields: [
      str('number', 'Order number', { list: true, readOnly: true }),
      str('buyerEmail', 'Buyer email', { list: true, submit: true }),
      str('buyerName', 'Buyer name', { list: true, submit: true }),
      objList('lines', 'Items', [str('refType', 'Type'), str('refId', 'Item id'), str('title', 'Title'), money('price', 'Unit price'), num('qty', 'Qty')], { readOnly: true }),
      money('total', 'Total', { list: true, readOnly: true }),
      sel('orderStatus', 'Status', ['pending', 'paid', 'fulfilled', 'cancelled', 'refunded'], { list: true, filter: true }),
      text('notes', 'Internal notes'),
    ],
  },
];

export const RESOURCE_BY_KEY = new Map(RESOURCES.map((r) => [r.key, r]));
export const RESOURCE_BY_PATH = new Map(RESOURCES.map((r) => [r.path, r]));

/** Roles that may read a resource in the admin. */
export const readRolesOf = (r: ResourceSpec): Role[] => r.readRoles ?? Array.from(new Set<Role>([...r.writeRoles, 'support']));

/** Admin sidebar modules in display order. */
export const MODULE_ORDER = ['Site', 'Homepage', 'Watch', 'Music', 'Live', 'Tour', 'Culture', 'Shop', 'Shoutouts', 'Membership', 'Work With Us', 'Legal', 'Inbox'];
