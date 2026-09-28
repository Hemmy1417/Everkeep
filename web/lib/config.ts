/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/everkeep.py; an
 * environment override points a checkout at another deployment, and the app
 * says so on every page it renders.
 */
export const RECORD_ADDRESS = "0xF71522A090BFDd32f3C5B0d87E518563B19fec4f";

/**
 * The organisation paths (motions, pause, revisions, dissolution) ran on a
 * second deployment of the same bytes, so a network stall in that long run
 * could never block the deployment the app writes to.
 */
export const PATHS_ADDRESS = "0xb4665b7c7189B4800bbCD1bbA6b9ecB4FD485d8A";

const override = process.env.NEXT_PUBLIC_EVERKEEP_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "17ad8ee63826f59388a0c52110d33860d362615a4fd0207adaaa0313ca521b90";

export const REPO_URL = "https://github.com/Hemmy1417/Everkeep";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/everkeep.py`;

/** The organisation the dashboard opens on. Every other organisation is one click away. */
export const FEATURED_ORG = process.env.NEXT_PUBLIC_EVERKEEP_ORG?.trim() || "org-00001";
