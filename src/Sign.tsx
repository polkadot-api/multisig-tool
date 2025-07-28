import { useStateObservable } from "@react-rxjs/core";
import { Dot, Edit, FileCode, Info, PenTool, Users } from "lucide-react";
import { OnChainIdentity } from "./components/AccountSelector/OnChainIdentity";
import { Step } from "./components/Step";
import { Textarea } from "./components/ui/textarea";
import { stringify } from "./lib/json";
import { genericSS58 } from "./lib/ss58";
import { cn } from "./lib/utils";
import { decodedCallData$ } from "./steps/CallData";
import { SelectAccount } from "./steps/SelectAccount";
import { client$, selectedChain$ } from "./steps/SelectChain";
import { multisigAccount$, multisigCall$ } from "./steps/SelectMultisig";
import { Submit } from "./steps/Submit";
import { twMerge } from "tailwind-merge";
import { Button } from "./components/ui/button";
import { setMode } from "./mode";

export const Sign = () => {
  const client = useStateObservable(client$);

  return (
    <div className="p-2 space-y-4">
      <div className="py-2">
        <h1 className="font-bold text-3xl">Review & Sign Transaction</h1>
        <h3 className="text-muted-foreground">
          A multisig transaction is ready for your approval.
        </h3>
      </div>
      <div className="rounded-lg shadow bg-background">
        <div className="bg-accent/20 p-4 flex items-cente border-b">
          <div className="grow-1">
            <h2 className="font-bold text-2xl leading-none">
              Transaction Details
            </h2>
            <h3 className="text-muted-foreground text-sm">
              Review the information below before signing.
            </h3>
          </div>
          <Button onClick={() => setMode("edit")} variant="secondary">
            <Edit />
            Edit
          </Button>
        </div>
        <ChainStatus />
      </div>
      <MultisigStatus />
      <div
        className={twMerge(
          "space-y-4",
          client ? "" : "opacity-50 pointer-events-none"
        )}
      >
        <Step
          number={1}
          title="Select Account"
          subtitle="Connect your wallet and choose an account to sign the transaction."
        >
          <SelectAccount />
        </Step>
        <Step number={2} title="Submit" subtitle="Submit your signature">
          <Submit />
        </Step>
      </div>
    </div>
  );
};

const ChainStatus = () => {
  const chain = useStateObservable(selectedChain$);
  const client = useStateObservable(client$);
  const callData = useStateObservable(decodedCallData$);
  const multisig = useStateObservable(multisigAccount$)!;
  const multisigCall = useStateObservable(multisigCall$);

  const genericApprovals = multisigCall?.approvals.map(genericSS58) ?? [];

  return (
    <>
      <div className="p-4">
        <div className="text-muted-foreground text-sm font-medium">Chain</div>
        <div className="flex items-center">
          <div className={chain.type === "sm" ? "capitalize" : ""}>
            {chain.value}
          </div>
          <Dot className={client ? "text-green-500" : "text-orange-300"} />
          <div>{client ? "Connected" : "Connecting…"}</div>
        </div>
      </div>
      <div className="bg-accent/20 border-y p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Users size={20} />
          <h3 className="font-bold">Multisig Details</h3>
        </div>
        <div className="border-b py-2 pb-4">
          <div className="text-muted-foreground text-sm font-medium">
            Multisig Address
          </div>
          <OnChainIdentity value={multisig.multisigId} />
        </div>
        <div className="border-b py-2">
          <div className="text-muted-foreground text-sm font-medium">
            Signatories
          </div>
          <ul className="pl-2 space-y-2 py-2">
            {multisig.addresses.map((addr) => {
              const hasSigned = genericApprovals.includes(genericSS58(addr));
              return (
                <li key={addr} className="flex items-center gap-2">
                  <div
                    title={hasSigned ? "Approved" : "Pending"}
                    className="py-1 mt-1"
                  >
                    <PenTool
                      strokeWidth={1}
                      className={cn(
                        hasSigned
                          ? "text-green-600"
                          : "text-muted-foreground/50"
                      )}
                    />
                  </div>
                  <OnChainIdentity value={addr} />
                </li>
              );
            })}
          </ul>
        </div>
        <div className="py-2 space-y-2">
          <div className="text-muted-foreground text-sm font-medium">
            Threshold
          </div>
          <div className="inline-block bg-accent rounded-full text-sm font-bold py-1 px-2">
            {multisig.threshold} of {multisig.addresses.length}
          </div>
        </div>
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <FileCode size={20} />
          <h3 className="font-bold">Call Data</h3>
        </div>
        {callData ? (
          <Textarea
            className="border rounded font-mono p-2 text-sm text-foreground/80 max-h-96 overflow-auto"
            readOnly
            value={stringify(callData)}
          />
        ) : (
          <span className="text-muted-foreground">Loading…</span>
        )}
      </div>
    </>
  );
};

const MultisigStatus = () => {
  const multisig = useStateObservable(multisigAccount$)!;
  const multisigCall = useStateObservable(multisigCall$);

  return (
    <div className="border bg-blue-50 border-blue-200 text-blue-800 rounded-lg p-4 flex items-start gap-2 text-sm">
      <Info />
      {multisigCall ? (
        <div>
          This multisig call has already started,{" "}
          {multisigCall.approvals.length} out of {multisig.threshold} approvals
          so far.
        </div>
      ) : multisig.threshold === 1 ? (
        <div>
          Because this multisig has threshold 1, the call will be immediately
          executed with your signature.
        </div>
      ) : (
        <div>
          You will create this multisig call as it seems no one else from the
          group has started it yet.
        </div>
      )}
    </div>
  );
};
