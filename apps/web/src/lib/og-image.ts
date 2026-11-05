// The social share card as the root metadata declares it. The PNG itself is rendered at
// build by scripts/render-og.ts into public/og.png and served by Workers Static Assets, so
// no route (and none of next/og) lives in the Worker. The URL carries no content hash, so
// a changed card reaches social sites when their cache of /og.png expires.

import { SHARE_CARD_ALT, SHARE_CARD_SIZE } from "@dirework/overlay-kit/share-card";

/** The card's path under public/, and so its URL path (resolved against `metadataBase`). */
export const OG_IMAGE_PATH = "/og.png";

/** og:image / twitter:image with the size and alt crawlers read before fetching it. */
export const OG_IMAGE = {
  url: OG_IMAGE_PATH,
  width: SHARE_CARD_SIZE.width,
  height: SHARE_CARD_SIZE.height,
  alt: SHARE_CARD_ALT,
  type: "image/png",
};
