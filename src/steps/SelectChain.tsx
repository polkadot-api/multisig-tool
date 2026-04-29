import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHashParam } from "@/lib/hashParams";
import { smoldotChains } from "@/smoldot";
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
  value: "polkadot_asset_hub",
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
    smoldotChains[selectedChain.value].createChain().catch((e) => {
      console.error(e);
      // TODO Currently PAPI will freeze up if an error happens here. Avoiding the freeze until 2.1.2 is released
      return new Promise(() => {});
    })
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
    <div className="p-2 space-y-2">
      <label className="flex items-center gap-2">
        <input
          type="radio"
          checked={selectedChain.type === "sm"}
          onChange={() =>
            setSelectedChain({
              type: "sm",
              value: "",
            })
          }
        />
        <Select
          value={selectedChain.type === "sm" ? selectedChain.value : ""}
          onValueChange={(v) =>
            setSelectedChain({
              type: "sm",
              value: v,
            })
          }
        >
          <SelectTrigger className="w-full max-w-48">
            <SelectValue placeholder="Smoldot chain" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Chains</SelectLabel>
              {Object.entries(smoldotChains).map(([id, { name }]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </label>
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
