import { startFromWorker } from "polkadot-api/smoldot/from-worker";
import SmWorker from "polkadot-api/smoldot/worker?worker";

export const smoldot = startFromWorker(new SmWorker(), {
  logCallback: (level, target, message) => {
    console.debug("smoldot[%s(%s)] %s", target, level, message);
  },
  forbidWs: true,
});

export const smoldotChains: Record<
  string,
  () => Promise<{ chainSpec: string }>
> = {
  polkadot: async () => import("polkadot-api/chains/polkadot"),
  kusama: async () => import("polkadot-api/chains/kusama"),
  westend: async () => import("polkadot-api/chains/westend"),
  paseo: async () => import("polkadot-api/chains/paseo"),
};
