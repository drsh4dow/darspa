import { NodeCrypto } from "@effect/platform-node";
import { ConfigProvider, Layer } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import type { ApplicationEnv } from "../infra/application";
import { Auth } from "./auth";
import { Database } from "./db/database";
import { DocumentAssets } from "./documents/assets";
import { ExamLimitsLive } from "./examOrders/limits";
import { ExamOrders } from "./examOrders/workflow";
import { Operations } from "./operations";
import { PaymentProcessing } from "./purchasing/processing";
import { Purchases } from "./purchasing/purchases";
import { Webpay } from "./purchasing/webpay";
import { VoucherDeliveries } from "./vouchers/deliveries";
import { DocumentBucket, VoucherDocuments } from "./vouchers/documents";
import { Vouchers } from "./vouchers/vouchers";

const domain = Layer.mergeAll(
  Auth.layer,
  Vouchers.layer,
  Purchases.layer,
  Operations.layer,
  ExamLimitsLive,
);

const documents = Layer.mergeAll(VoucherDocuments.layer, ExamOrders.layer).pipe(
  Layer.provideMerge(domain),
);

export const ApplicationLive = Layer.mergeAll(
  PaymentProcessing.layer,
  VoucherDeliveries.layer,
).pipe(Layer.provideMerge(documents));

export function applicationLayer(env: ApplicationEnv) {
  const platform = Layer.mergeAll(
    Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(env)),
    Database.layer(env.DB),
    DocumentAssets.layer(env.ASSETS),
    Layer.succeed(DocumentBucket, env.DOCUMENTS),
    FetchHttpClient.layer,
    NodeCrypto.layer,
  );

  return ApplicationLive.pipe(Layer.provideMerge(Webpay.layer.pipe(Layer.provideMerge(platform))));
}
