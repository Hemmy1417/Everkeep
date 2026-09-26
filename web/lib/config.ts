/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/everkeep.py; an
 * environment override points a checkout at another deployment, and the app
 * says so on every page it renders.
 */
export const RECORD_ADDRESS = "0x3B144fEf76B942c3DE967c257cc56fde8AEBB79c";

const override = process.env.NEXT_PUBLIC_EVERKEEP_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "9fbea60d6ca74143a2f4d78230ca9907e07cd048575c53f36164e88c0ad4103f";

export const REPO_URL = "https://github.com/Hemmy1417/Everkeep";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/everkeep.py`;
