import { Input } from "@/components/ui/input";
import { getHashParam } from "@/lib/hashParams";
import { smoldot, smoldotChains } from "@/smoldot";
import { state, useStateObservable } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { Dot } from "lucide-react";
import { createClient } from "polkadot-api";
import { getSmProvider } from "polkadot-api/sm-provider";
import { getWsProvider } from "polkadot-api/ws";
import { concat, finalize, from, map, NEVER, startWith, switchMap } from "rxjs";

interface SelectedChain {
  type: "sm" | "ws";
  value: string;
}

const [selectedChainChange$, setSelectedChain] = createSignal<SelectedChain>();

const initialChainParam = getHashParam("chain");
export const initialHasChain = !!initialChainParam;

let initialChain: SelectedChain = {
  type: "sm",
  value: "polkadot",
};
if (initialChainParam) {
  const [type, ...value] = initialChainParam.split("-");
  initialChain = {
    type,
    value: value.join("-"),
  } as SelectedChain;
}

export const selectedChain$ = state<SelectedChain>(
  selectedChainChange$,
  initialChain
);

const getProvider = (selectedChain: SelectedChain) => {
  if (selectedChain.type === "ws") {
    return getWsProvider(selectedChain.value);
  }
  return getSmProvider(() =>
    smoldotChains[selectedChain.value]().then(({ chainSpec }) =>
      smoldot.addChain({
        chainSpec,
      })
    )
  );
};

export const client$ = state(
  selectedChain$.pipe(
    switchMap((selectedChain) => {
      const provider = getProvider(selectedChain);
      const client = createClient(provider);

      const client$ = from(client.getUnsafeApi().getStaticApis()).pipe(
        map(() => client),
        startWith(null)
      );
      return concat(client$, NEVER).pipe(
        finalize(() =>
          setTimeout(() => {
            client.destroy();
          })
        )
      );
    })
  ),
  null
);

export const SelectChain = () => {
  const selectedChain = useStateObservable(selectedChain$);
  const client = useStateObservable(client$);

  return (
    <div className="p-2">
      <ul className="flex gap-4 flex-wrap">
        {Object.keys(smoldotChains).map((chain) => (
          <li key={chain}>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                checked={selectedChain.value === chain}
                onChange={() =>
                  setSelectedChain({
                    type: "sm",
                    value: chain,
                  })
                }
              />
              <div className="py-1 capitalize">{chain}</div>
            </label>
          </li>
        ))}
      </ul>
      <label className="flex items-center gap-2">
        <input
          type="radio"
          checked={selectedChain.type === "ws"}
          onChange={() =>
            setSelectedChain({
              type: "ws",
              value: "",
            })
          }
        />
        <Input
          type="text"
          placeholder="RPC Endpoint URL"
          value={selectedChain.type === "ws" ? selectedChain.value : ""}
          onChange={(evt) =>
            setSelectedChain({
              type: "ws",
              value: evt.currentTarget.value,
            })
          }
        />
      </label>
      <div className="flex items-center mt-2 text-foreground/80">
        <div>Connection status:</div>
        <Dot className={client ? "text-green-500" : "text-orange-300"} />
        <div>{client ? "Connected" : "Connecting…"}</div>
      </div>
    </div>
  );
};
