import { genericSS58 } from "@/lib/ss58";
import { cn } from "@/lib/utils";
import { smoldot, smoldotChains } from "@/smoldot";
import { client$ } from "@/steps/SelectChain";
import {
  dot,
  IdentityData,
  IdentityJudgement,
  polkadot_people,
} from "@polkadot-api/descriptors";
import { PolkadotIdenticon } from "@polkadot-api/react-components";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { CheckCircle } from "lucide-react";
import {
  AccountId,
  Binary,
  createClient,
  getSs58AddressInfo,
  SS58String,
} from "polkadot-api";
import { getSmProvider } from "polkadot-api/sm-provider";
import { FC } from "react";
import {
  catchError,
  combineLatest,
  from,
  map,
  of,
  startWith,
  switchMap,
  tap,
} from "rxjs";
import { CopyText } from "../CopyText";
import { accountsByExtension$ } from "./accounts.state";

const peopleChainSpec = import("polkadot-api/chains/polkadot_people");

const client = createClient(
  getSmProvider(() =>
    Promise.all([smoldotChains.polkadot.createChain(), peopleChainSpec])
      .then(([relayChain, { chainSpec }]) =>
        smoldot.addChain({
          chainSpec,
          potentialRelayChains: [relayChain],
        })
      )
      .catch((e) => {
        console.error(e);
        // TODO Currently PAPI will freeze up if an error happens here. Avoiding the freeze until 2.1.2 is released
        return new Promise(() => {});
      })
  )
);
const typedApi = client.getTypedApi(polkadot_people);

const CACHE_KEY = "identity-cache";
const cache: Record<SS58String, Identity | undefined> = JSON.parse(
  localStorage.getItem(CACHE_KEY) ?? "{}"
);

export interface Identity {
  displayName: string;
  judgments: Array<{
    registrar: number;
    judgement: IdentityJudgement["type"];
  }>;
}
export const isVerified = (identity: Identity | null) =>
  identity?.judgments.some((j) => j.judgement === "Reasonable");

const onChainIdentity$ = (address: SS58String) =>
  from(typedApi.query.Identity.IdentityOf.getValue(address)).pipe(
    map((res): Identity | null => {
      const displayName = res && readIdentityData(res.info.display);
      return displayName
        ? {
            displayName: Binary.toText(displayName),
            judgments: res.judgements.map(([registrar, judgement]) => ({
              registrar,
              judgement: judgement.type,
            })),
          }
        : null;
    }),
    tap((v) => {
      if (v != null) {
        cache[address] = v;
      } else {
        delete cache[address];
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    }),
    catchError(() => of(null))
  );
const extensionIdentity$ = (address: SS58String) =>
  accountsByExtension$.pipe(
    map((extensions): Identity | null => {
      const genericAddr = genericSS58(address);
      const filteredAccounts = Array.from(extensions.values()).flatMap(
        (accounts) =>
          accounts.filter(
            (acc) => acc.name && genericSS58(acc.address) === genericAddr
          )
      );

      return filteredAccounts.length
        ? {
            displayName: filteredAccounts[0].name!,
            judgments: [],
          }
        : null;
    })
  );

const identity$ = state(
  (address: SS58String) =>
    combineLatest([
      onChainIdentity$(address).pipe(startWith(cache[address] ?? null)),
      extensionIdentity$(address),
    ]).pipe(map(([onChain, extension]) => onChain ?? extension)),
  (address) => cache[address] ?? null
);

const format$ = client$.pipeState(
  switchMap((client) =>
    client
      ? client.getUnsafeApi<typeof dot>().constants.System.SS58Prefix()
      : of(undefined)
  ),
  withDefault(undefined)
);

export const OnChainIdentity: FC<{
  value: SS58String;
  name?: string;
  className?: string;
  copyable?: boolean;
}> = ({ value, name: inputName, className, copyable = true }) => {
  const format = useStateObservable(format$);
  const pk = getPublicKey(value);
  const valueFormatted = pk ? AccountId(format).dec(pk) : value;

  const identity = useStateObservable(identity$(value));
  const name = identity?.displayName ?? inputName;

  const identicon = (
    <PolkadotIdenticon className="shrink-0" publicKey={pk} size={28} />
  );
  return (
    <div className={cn("flex items-center gap-1 overflow-hidden", className)}>
      {copyable ? (
        <CopyText
          text={valueFormatted}
          className="w-7 h-7 flex justify-center items-center"
        >
          {identicon}
        </CopyText>
      ) : (
        identicon
      )}
      <div className="flex flex-col justify-center text-foreground leading-tight overflow-hidden">
        {name && (
          <span className="inline-flex items-center gap-1">
            {name}
            {isVerified(identity) && (
              <CheckCircle
                size={16}
                className="text-green-500 dark:text-green-400"
              />
            )}
          </span>
        )}
        {!name || !isVerified(identity) ? (
          <span className="text-foreground/70 text-ellipsis overflow-hidden">
            {sliceMiddleAddr(value)}
          </span>
        ) : null}
      </div>
    </div>
  );
};

const readIdentityData = (identityData: IdentityData): Uint8Array | null => {
  if (identityData.type === "None" || identityData.type === "Raw0") return null;
  if (identityData.type === "Raw1") return new Uint8Array([identityData.value]);
  return Binary.fromHex(identityData.value);
};
const getPublicKey = (address: string) => {
  const info = getSs58AddressInfo(address);
  return info.isValid ? info.publicKey : null;
};

const sliceMiddleAddr = (s: string) => s.slice(0, 10) + "…" + s.slice(-10);
