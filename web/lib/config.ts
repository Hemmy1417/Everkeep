/**
 * The deployment this app reads and writes. The default is the deployment of
 * record, whose bytes were verified against contracts/everkeep.py; an
 * environment override points a checkout at another deployment, and the app
 * says so on every page it renders.
 */
export const RECORD_ADDRESS = "0x4418253D7332661BfdF917DfE6B554cD0399F97c";

const override = process.env.NEXT_PUBLIC_EVERKEEP_CONTRACT?.trim() ?? "";

export const CONTRACT_ADDRESS = (override || RECORD_ADDRESS) as `0x${string}`;
export const CONTRACT_CONFIGURED = /^0x[0-9a-fA-F]{40}$/.test(CONTRACT_ADDRESS);
export const IS_RECORD = CONTRACT_ADDRESS.toLowerCase() === RECORD_ADDRESS.toLowerCase();

/** The sha256 of the contract source these bytes were compiled from. */
export const SOURCE_SHA256 =
  "b9e2ed47e1c0136b8831d42435e4d75f670e2950da2b5e8f9c33a2767c87e75a";

export const REPO_URL = "https://github.com/Hemmy1417/Everkeep";
export const SOURCE_URL = `${REPO_URL}/blob/main/contracts/everkeep.py`;

/** The organisation the dashboard opens on. Every other organisation is one click away. */
export const FEATURED_ORG = process.env.NEXT_PUBLIC_EVERKEEP_ORG?.trim() || "org-00001";
