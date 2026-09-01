import { AccountPicker } from "@/components/AccountSelector";
import {
  availableExtensions$,
  extensionAccounts$,
  onToggleExtension,
  selectedExtensions$,
} from "@/components/AccountSelector/accounts.state";
import { genericSS58 } from "@/lib/ss58";
import { dot } from "@polkadot-api/descriptors";
import { getProxyTxCreator } from "@polkadot-api/meta-signers";
import {
  createLinkedAccountsSdk,
  NestedLinkedAccountsResult,
} from "@polkadot-api/sdk-accounts";
import { state, useStateObservable, withDefault } from "@react-rxjs/core";
import { createSignal } from "@react-rxjs/utils";
import { SignerTxCreator } from "polkadot-api/tx-creator";
import {
  catchError,
  combineLatest,
  concatWith,
  defer,
  lastValueFrom,
  map,
  NEVER,
  of,
  shareReplay,
  startWith,
  switchMap,
} from "rxjs";
import { client$ } from "./SelectChain";
import { multisigAccount$ } from "./SelectMultisig";

const linkedAccountsSdk$ = client$.pipeState(
  map((client) =>
    client
      ? createLinkedAccountsSdk(
          client.getTypedApi(dot) as any,
          async () => null
        )
      : null
  ),
  withDefault(null)
);

const [valueSelectedChange$, selectValue] = createSignal<string>();
const selectedValue$ = state(valueSelectedChange$, null);

const selectedAccount$ = selectedValue$.pipeState(
  switchMap((value) => {
    if (!value) return of(null);
    const [address, ...extensionParts] = value.split("-");
    const extension = extensionParts.join("-");
    return extensionAccounts$(extension).pipe(
      map(
        (accounts) =>
          accounts.find((account) => account.address === address) ?? null
      )
    );
  }),
  withDefault(null)
);

const linkedAccounts$ = combineLatest([
  linkedAccountsSdk$,
  multisigAccount$,
]).pipe(
  switchMap(async ([linkedAccountsSdk, multisigAccount]) => {
    if (!linkedAccountsSdk || !multisigAccount) return null;

    return {
      type: "multisig" as const,
      value: {
        threshold: multisigAccount.threshold,
        accounts: await Promise.all(
          multisigAccount.addresses.map(async (address) => ({
            address,
            linkedAccounts: await lastValueFrom(
              linkedAccountsSdk.getNestedLinkedAccounts$(address)
            ),
          }))
        ),
      },
    };
  }),
  catchError((err) => {
    console.log(err);
    return of(null);
  }),
  concatWith(NEVER),
  shareReplay(1)
);

type IdentifiedCreeator = SignerTxCreator & {
  publicKey: Uint8Array;
};
type NestedSigner = (signer: IdentifiedCreeator) => IdentifiedCreeator;
type AccountSigners = Array<{
  address: string;
  signerFn: NestedSigner;
}>;
const identity = (signer: IdentifiedCreeator) => signer;

const accountSigners$ = state(
  linkedAccounts$.pipe(
    switchMap((multisigLinkedAccounts) =>
      defer(async () => {
        if (!multisigLinkedAccounts) return null;

        if (multisigLinkedAccounts.type !== "multisig") {
          throw new Error("Expected multisig account");
        }

        const findSigners = (
          address: string,
          result: NestedLinkedAccountsResult | null
        ): AccountSigners => {
          const baseSigner = { address, signerFn: identity };

          if (result?.type === "proxy") {
            const innerSigners = result.value.accounts.flatMap((v) =>
              findSigners(genericSS58(v.address), v.linkedAccounts)
            );

            return [
              baseSigner,
              ...innerSigners.map(({ address, signerFn }) => ({
                address,
                signerFn: (signer: IdentifiedCreeator) =>
                  getProxyTxCreator(
                    {
                      real: address,
                    },
                    signerFn(signer)
                  ),
              })),
            ];
          }

          return [baseSigner];
        };

        return Object.fromEntries(
          multisigLinkedAccounts.value.accounts
            .flatMap((account) =>
              findSigners(genericSS58(account.address), account.linkedAccounts)
            )
            .map((v) => [v.address, v.signerFn])
        );
      }).pipe(startWith(null))
    )
  ),
  null
);

export const selectedSigner$ = state(
  combineLatest([accountSigners$, selectedAccount$]).pipe(
    switchMap(async ([signers, selectedAccount]) => {
      if (!signers || !selectedAccount) return null;

      const nestedSigner = signers[genericSS58(selectedAccount.address)];
      return nestedSigner ? nestedSigner(selectedAccount.txCreator) : null;
    })
  ),
  null
);

export const SelectAccount = () => {
  const availableExtensions = useStateObservable(availableExtensions$);
  const selectedExtensions = useStateObservable(selectedExtensions$);
  const value = useStateObservable(selectedValue$);
  const accountSigners = useStateObservable(accountSigners$);

  const allowedAddresses = accountSigners ? Object.keys(accountSigners) : [];

  return (
    <div className="p-2 space-y-2">
      <div>
        <div className="text-muted-foreground text-sm">Select extension</div>
        {availableExtensions.length ? (
          <ul className="flex items-center flex-wrap gap-2">
            {availableExtensions.map((ext) => (
              <li key={ext}>
                <label className="py-1 px-2 border rounded flex items-center gap-1">
                  <input
                    type="checkbox"
                    value={ext}
                    checked={selectedExtensions.has(ext)}
                    onChange={(evt) => onToggleExtension(evt.target.value)}
                  />
                  {ext}
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground">
            No Polkadot extensions available
          </div>
        )}
      </div>
      <div>
        <div className="text-muted-foreground text-sm">Select account</div>
        <AccountPicker
          value={value}
          selectValue={selectValue}
          allowedAddresses={allowedAddresses}
        />{" "}
      </div>
    </div>
  );
};
