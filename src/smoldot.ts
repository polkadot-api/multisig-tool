import type { Chain } from "polkadot-api/smoldot";
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
  {
    name: string;
    createChain: () => Promise<Chain>;
  }
> = {
  polkadot: {
    name: "Polkadot",
    createChain: async () => {
      const { chainSpec } = await import("polkadot-api/chains/polkadot");
      return smoldot.addChain({
        chainSpec,
      });
    },
  },
  polkadot_asset_hub: {
    name: "Polkadot Asset Hub",
    createChain: async () => {
      const { chainSpec } = await import(
        "polkadot-api/chains/polkadot_asset_hub"
      );
      return smoldot.addChain({
        chainSpec,
        potentialRelayChains: [await smoldotChains.polkadot.createChain()],
      });
    },
  },
  kusama: {
    name: "Kusama",
    createChain: async () => {
      const { chainSpec } = await import("polkadot-api/chains/kusama");
      return smoldot.addChain({
        chainSpec,
      });
    },
  },
  kusama_asset_hub: {
    name: "Kusama Asset Hub",
    createChain: async () => {
      const { chainSpec } = await import(
        "polkadot-api/chains/kusama_asset_hub"
      );
      return smoldot.addChain({
        chainSpec,
        potentialRelayChains: [await smoldotChains.kusama.createChain()],
      });
    },
  },
  westend: {
    name: "Westend",
    createChain: async () => {
      const { chainSpec } = await import("polkadot-api/chains/westend");
      return smoldot.addChain({
        chainSpec,
      });
    },
  },
  westend_asset_hub: {
    name: "Westend Asset Hub",
    createChain: async () => {
      const { chainSpec } = await import(
        "polkadot-api/chains/westend_asset_hub"
      );
      return smoldot.addChain({
        chainSpec,
        potentialRelayChains: [await smoldotChains.westend.createChain()],
      });
    },
  },
  paseo: {
    name: "Paseo",
    createChain: async () => {
      const { chainSpec } = await import("polkadot-api/chains/paseo");
      return smoldot.addChain({
        chainSpec,
      });
    },
  },
  paseo_asset_hub: {
    name: "Paseo Asset Hub",
    createChain: async () => {
      const { chainSpec } = await import("polkadot-api/chains/paseo_asset_hub");
      return smoldot.addChain({
        chainSpec,
        potentialRelayChains: [await smoldotChains.paseo.createChain()],
      });
    },
  },
};
