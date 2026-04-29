import { Binary } from "polkadot-api";

export const stringify = (value: unknown) =>
  JSON.stringify(
    value,
    (_, v) =>
      typeof v === "bigint"
        ? `${v}n`
        : v instanceof Uint8Array
        ? bytesToString(v)
        : v,
    2
  );

const textDecoder = new TextDecoder("utf-8", { fatal: true });
const bytesToString = (value: Uint8Array) => {
  try {
    if (value.slice(0, 5).every((b) => b < 32)) throw null;
    return textDecoder.decode(value);
  } catch (_) {
    return Binary.toHex(value);
  }
};
