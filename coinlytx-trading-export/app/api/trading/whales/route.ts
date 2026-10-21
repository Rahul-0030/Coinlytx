import {
  NextRequest,
  NextResponse,
} from "next/server";

import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMPOOL_BASE =
  "https://mempool.space/api";

const ETH_RPC =
  "https://ethereum-rpc.publicnode.com";

const BINANCE_BASE =
  "https://data-api.binance.vision";

type WalletLabel = {
  entity: string;
  label: string;
  confidence: string;
  source: string;
  sourceUrl?: string;
  lastUpdated?: string;
};

type ExchangeWalletDatabase = {
  networks: {
    ethereum: {
      symbol: string;
      walletCount: number;
      wallets: Record<
        string,
        WalletLabel
      >;
    };

    bitcoin: {
      symbol: string;
      walletCount: number;
      wallets: Record<
        string,
        WalletLabel
      >;
    };
  };
};

type BtcRecent = {
  txid: string;
  fee: number;
  vsize: number;
  value: number;
};

type BtcTxDetail = {
  txid: string;

  vin: {
    prevout?: {
      scriptpubkey_address?: string;
      value?: number;
    } | null;
  }[];

  vout: {
    scriptpubkey_address?: string;
    value: number;
  }[];

  status: {
    confirmed: boolean;
    block_time?: number;
  };
};

type EthTransaction = {
  hash: string;
  from: string;
  to: string | null;
  value: string;
};

type EthBlock = {
  number: string;
  timestamp: string;
  transactions: EthTransaction[];
};

type FlowType =
  | "EXCHANGE_INFLOW"
  | "EXCHANGE_OUTFLOW"
  | "EXCHANGE_TO_EXCHANGE"
  | "UNCLASSIFIED";

type DirectionalImpact =
  | "BULLISH"
  | "BEARISH"
  | "NEUTRAL"
  | "UNKNOWN";

type WhaleEvent = {
  chain: "BTC" | "ETH";

  asset: "BTC" | "ETH";

  txHash: string;

  amount: number;

  usdValue: number;

  from: string | null;

  to: string | null;

  fromEntity: string | null;

  fromLabel: string | null;

  toEntity: string | null;

  toLabel: string | null;

  flowType: FlowType;

  directionalImpact:
    DirectionalImpact;

  flowConfidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  category:
    | "LARGE_TRANSFER"
    | "WHALE"
    | "MEGA_WHALE";

  timestamp: string;

  source: string;

  scoreImpact: number;

  note: string;
};

let walletDatabaseCache:
  | ExchangeWalletDatabase
  | null = null;

function safeNumber(
  value: unknown
) {
  const num =
    Number(value);

  return Number.isFinite(num)
    ? num
    : 0;
}

function round(
  value: number,
  decimals = 4
) {
  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value * multiplier
    ) / multiplier
  );
}

function clamp(
  value: number,
  min: number,
  max: number
) {
  return Math.max(
    min,
    Math.min(
      max,
      value
    )
  );
}

function getCategory(
  usdValue: number
):
  | "LARGE_TRANSFER"
  | "WHALE"
  | "MEGA_WHALE" {
  if (
    usdValue >=
    10_000_000
  ) {
    return "MEGA_WHALE";
  }

  if (
    usdValue >=
    1_000_000
  ) {
    return "WHALE";
  }

  return "LARGE_TRANSFER";
}

function getValueWeight(
  usdValue: number
) {
  if (
    usdValue >=
    100_000_000
  ) {
    return 25;
  }

  if (
    usdValue >=
    50_000_000
  ) {
    return 20;
  }

  if (
    usdValue >=
    20_000_000
  ) {
    return 16;
  }

  if (
    usdValue >=
    10_000_000
  ) {
    return 12;
  }

  if (
    usdValue >=
    5_000_000
  ) {
    return 9;
  }

  if (
    usdValue >=
    1_000_000
  ) {
    return 6;
  }

  return 3;
}

function confidenceMultiplier(
  confidence?: string
) {
  if (
    confidence === "high"
  ) {
    return 1;
  }

  if (
    confidence ===
    "medium"
  ) {
    return 0.65;
  }

  return 0.5;
}

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response =
    await fetch(url, {
      cache: "no-store",

      headers: {
        Accept:
          "application/json",
      },
    });

  if (!response.ok) {
    throw new Error(
      `${response.status} ${response.statusText}`
    );
  }

  return (
    await response.json()
  ) as T;
}

async function loadWalletDatabase() {
  if (
    walletDatabaseCache
  ) {
    return walletDatabaseCache;
  }

  const filePath =
    path.join(
      process.cwd(),
      "lib",
      "trading",
      "data",
      "exchange-wallets.json"
    );

  const raw =
    await fs.readFile(
      filePath,
      "utf8"
    );

  walletDatabaseCache =
    JSON.parse(
      raw
    ) as ExchangeWalletDatabase;

  return walletDatabaseCache;
}

async function getBinancePrice(
  symbol: string
) {
  const data =
    await fetchJson<{
      symbol: string;
      price: string;
    }>(
      `${BINANCE_BASE}/api/v3/ticker/price?symbol=${symbol}`
    );

  return safeNumber(
    data.price
  );
}

async function ethereumRpc<T>(
  method: string,
  params: unknown[]
): Promise<T> {
  const response =
    await fetch(
      ETH_RPC,
      {
        method: "POST",

        cache: "no-store",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            jsonrpc:
              "2.0",

            id: 1,

            method,

            params,
          }),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Ethereum RPC HTTP ${response.status}`
    );
  }

  const data =
    (await response.json()) as {
      result?: T;

      error?: {
        code: number;
        message: string;
      };
    };

  if (
    data.error
  ) {
    throw new Error(
      data.error.message
    );
  }

  if (
    data.result ===
    undefined
  ) {
    throw new Error(
      "Ethereum RPC returned no result."
    );
  }

  return data.result;
}

function weiToEth(
  value: string
) {
  try {
    return (
      Number(
        BigInt(value)
      ) / 1e18
    );
  } catch {
    return 0;
  }
}

function hexToNumber(
  value: string
) {
  try {
    return Number(
      BigInt(value)
    );
  } catch {
    return 0;
  }
}

function lookupEthereumWallet(
  address:
    | string
    | null,
  database: ExchangeWalletDatabase
): WalletLabel | null {
  if (!address) {
    return null;
  }

  return (
    database.networks
      .ethereum.wallets[
      address.toLowerCase()
    ] || null
  );
}

function lookupBitcoinWallet(
  address:
    | string
    | null,
  database: ExchangeWalletDatabase
): WalletLabel | null {
  if (!address) {
    return null;
  }

  return (
    database.networks
      .bitcoin.wallets[
      address
    ] || null
  );
}

function classifyEthereumFlow({
  fromLabel,
  toLabel,
  usdValue,
}: {
  fromLabel:
    | WalletLabel
    | null;

  toLabel:
    | WalletLabel
    | null;

  usdValue: number;
}) {
  const baseWeight =
    getValueWeight(
      usdValue
    );

  if (
    !fromLabel &&
    toLabel
  ) {
    const multiplier =
      confidenceMultiplier(
        toLabel.confidence
      );

    return {
      flowType:
        "EXCHANGE_INFLOW" as const,

      directionalImpact:
        "BEARISH" as const,

      flowConfidence:
        toLabel.confidence ===
        "high"
          ? ("HIGH" as const)
          : ("MEDIUM" as const),

      scoreImpact:
        -round(
          baseWeight *
            multiplier,
          2
        ),

      note:
        `Large transfer into ${toLabel.entity}. Exchange inflow may increase potential selling pressure.`,
    };
  }

  if (
    fromLabel &&
    !toLabel
  ) {
    const multiplier =
      confidenceMultiplier(
        fromLabel.confidence
      );

    return {
      flowType:
        "EXCHANGE_OUTFLOW" as const,

      directionalImpact:
        "BULLISH" as const,

      flowConfidence:
        fromLabel.confidence ===
        "high"
          ? ("HIGH" as const)
          : ("MEDIUM" as const),

      scoreImpact:
        round(
          baseWeight *
            multiplier,
          2
        ),

      note:
        `Large transfer out of ${fromLabel.entity}. Exchange outflow may indicate withdrawal or accumulation.`,
    };
  }

  if (
    fromLabel &&
    toLabel
  ) {
    return {
      flowType:
        "EXCHANGE_TO_EXCHANGE" as const,

      directionalImpact:
        "NEUTRAL" as const,

      flowConfidence:
        "HIGH" as const,

      scoreImpact: 0,

      note:
        `${fromLabel.entity} → ${toLabel.entity}. Exchange-to-exchange movement is not scored directionally.`,
    };
  }

  return {
    flowType:
      "UNCLASSIFIED" as const,

    directionalImpact:
      "UNKNOWN" as const,

    flowConfidence:
      "LOW" as const,

    scoreImpact: 0,

    note:
      "Large transfer detected, but neither wallet is identified as an exchange.",
  };
}

async function loadEthereumEvents(
  minUsd: number,
  database: ExchangeWalletDatabase
): Promise<WhaleEvent[]> {
  const ethPrice =
    await getBinancePrice(
      "ETHUSDT"
    );

  const latest =
    await ethereumRpc<EthBlock>(
      "eth_getBlockByNumber",
      [
        "latest",
        true,
      ]
    );

  const latestNumber =
    hexToNumber(
      latest.number
    );

  const blockNumbers = [
    latestNumber,
    latestNumber - 1,
    latestNumber - 2,
    latestNumber - 3,
    latestNumber - 4,
  ].filter(
    (number) =>
      number > 0
  );

  const blocks =
    await Promise.all(
      blockNumbers.map(
        async (
          blockNumber
        ) => {
          if (
            blockNumber ===
            latestNumber
          ) {
            return latest;
          }

          return ethereumRpc<EthBlock>(
            "eth_getBlockByNumber",
            [
              `0x${blockNumber.toString(
                16
              )}`,

              true,
            ]
          );
        }
      )
    );

  const events:
    WhaleEvent[] = [];

  for (
    const block of blocks
  ) {
    const timestamp =
      new Date(
        hexToNumber(
          block.timestamp
        ) * 1000
      ).toISOString();

    for (
      const transaction of
      block.transactions
    ) {
      const amount =
        weiToEth(
          transaction.value
        );

      if (
        amount <= 0
      ) {
        continue;
      }

      const usdValue =
        amount *
        ethPrice;

      if (
        usdValue <
        minUsd
      ) {
        continue;
      }

      const from =
        transaction.from ||
        null;

      const to =
        transaction.to ||
        null;

      const fromLabel =
        lookupEthereumWallet(
          from,
          database
        );

      const toLabel =
        lookupEthereumWallet(
          to,
          database
        );

      const classification =
        classifyEthereumFlow({
          fromLabel,
          toLabel,
          usdValue,
        });

      events.push({
        chain: "ETH",

        asset: "ETH",

        txHash:
          transaction.hash,

        amount:
          round(
            amount,
            6
          ),

        usdValue:
          round(
            usdValue,
            2
          ),

        from,

        to,

        fromEntity:
          fromLabel?.entity ||
          null,

        fromLabel:
          fromLabel?.label ||
          null,

        toEntity:
          toLabel?.entity ||
          null,

        toLabel:
          toLabel?.label ||
          null,

        flowType:
          classification.flowType,

        directionalImpact:
          classification.directionalImpact,

        flowConfidence:
          classification.flowConfidence,

        category:
          getCategory(
            usdValue
          ),

        timestamp,

        source:
          "Ethereum PublicNode",

        scoreImpact:
          classification.scoreImpact,

        note:
          classification.note,
      });
    }
  }

  return events;
}

async function loadBitcoinEvents(
  minUsd: number,
  database: ExchangeWalletDatabase
): Promise<WhaleEvent[]> {
  const [
    btcPrice,
    recent,
  ] =
    await Promise.all([
      getBinancePrice(
        "BTCUSDT"
      ),

      fetchJson<BtcRecent[]>(
        `${MEMPOOL_BASE}/mempool/recent`
      ),
    ]);

  const candidates =
    recent
      .map((tx) => {
        const btc =
          safeNumber(
            tx.value
          ) /
          100_000_000;

        return {
          tx,

          btc,

          usdValue:
            btc *
            btcPrice,
        };
      })
      .filter(
        (item) =>
          item.usdValue >=
          minUsd
      )
      .sort(
        (a, b) =>
          b.usdValue -
          a.usdValue
      )
      .slice(
        0,
        8
      );

  const events:
    WhaleEvent[] = [];

  for (
    const candidate of
    candidates
  ) {
    let detail:
      | BtcTxDetail
      | null = null;

    try {
      detail =
        await fetchJson<BtcTxDetail>(
          `${MEMPOOL_BASE}/tx/${candidate.tx.txid}`
        );
    } catch {
      detail = null;
    }

    const inputAddresses =
      detail?.vin
        ?.map(
          (input) =>
            input.prevout
              ?.scriptpubkey_address
        )
        .filter(
          (
            address
          ): address is string =>
            Boolean(address)
        ) || [];

    const outputAddresses =
      detail?.vout
        ?.map(
          (output) =>
            output
              .scriptpubkey_address
        )
        .filter(
          (
            address
          ): address is string =>
            Boolean(address)
        ) || [];

    const exchangeInputs =
      inputAddresses
        .map(
          (address) => ({
            address,

            label:
              lookupBitcoinWallet(
                address,
                database
              ),
          })
        )
        .filter(
          (item) =>
            item.label !==
            null
        );

    const exchangeOutputs =
      outputAddresses
        .map(
          (address) => ({
            address,

            label:
              lookupBitcoinWallet(
                address,
                database
              ),
          })
        )
        .filter(
          (item) =>
            item.label !==
            null
        );

    const largestOutput =
      [...(
        detail?.vout ||
        []
      )].sort(
        (a, b) =>
          b.value -
          a.value
      )[0];

    const from =
      inputAddresses[0] ||
      null;

    const to =
      largestOutput
        ?.scriptpubkey_address ||
      null;

    /*
     * BTC is intentionally not
     * directionally scored yet.
     *
     * UTXO change outputs can
     * make naive exchange-flow
     * classification misleading.
     */

    const fromExchange =
      exchangeInputs[0]
        ?.label ||
      null;

    const toExchange =
      exchangeOutputs[0]
        ?.label ||
      null;

    events.push({
      chain: "BTC",

      asset: "BTC",

      txHash:
        candidate.tx.txid,

      amount:
        round(
          candidate.btc,
          8
        ),

      usdValue:
        round(
          candidate.usdValue,
          2
        ),

      from,

      to,

      fromEntity:
        fromExchange
          ?.entity ||
        null,

      fromLabel:
        fromExchange
          ?.label ||
        null,

      toEntity:
        toExchange
          ?.entity ||
        null,

      toLabel:
        toExchange
          ?.label ||
        null,

      flowType:
        "UNCLASSIFIED",

      directionalImpact:
        "UNKNOWN",

      flowConfidence:
        "LOW",

      category:
        getCategory(
          candidate.usdValue
        ),

      timestamp:
        detail?.status
          ?.block_time
          ? new Date(
              detail.status
                .block_time *
                1000
            ).toISOString()
          : new Date().toISOString(),

      source:
        "mempool.space",

      scoreImpact: 0,

      note:
        exchangeInputs.length ||
        exchangeOutputs.length
          ? "Known Bitcoin exchange wallet detected, but directional scoring is disabled because UTXO change outputs require deeper transaction analysis."
          : "Bitcoin whale transfer detected. No reliable exchange-direction classification available.",
    });
  }

  return events;
}

function calculateWhaleSummary(
  events: WhaleEvent[]
) {
  const ethEvents =
    events.filter(
      (event) =>
        event.chain ===
        "ETH"
    );

  const btcEvents =
    events.filter(
      (event) =>
        event.chain ===
        "BTC"
    );

  const inflows =
    ethEvents.filter(
      (event) =>
        event.flowType ===
        "EXCHANGE_INFLOW"
    );

  const outflows =
    ethEvents.filter(
      (event) =>
        event.flowType ===
        "EXCHANGE_OUTFLOW"
    );

  const exchangeToExchange =
    ethEvents.filter(
      (event) =>
        event.flowType ===
        "EXCHANGE_TO_EXCHANGE"
    );

  const inflowUsd =
    inflows.reduce(
      (sum, event) =>
        sum +
        event.usdValue,
      0
    );

  const outflowUsd =
    outflows.reduce(
      (sum, event) =>
        sum +
        event.usdValue,
      0
    );

  const rawScore =
    ethEvents.reduce(
      (sum, event) =>
        sum +
        event.scoreImpact,
      0
    );

  const whaleScore =
    round(
      clamp(
        rawScore,
        -100,
        100
      ),
      1
    );

  let directionalBias:
    | "BULLISH"
    | "BEARISH"
    | "NEUTRAL" =
    "NEUTRAL";

  if (
    whaleScore >= 8
  ) {
    directionalBias =
      "BULLISH";
  }

  if (
    whaleScore <= -8
  ) {
    directionalBias =
      "BEARISH";
  }

  const totalObservedUsd =
    events.reduce(
      (sum, event) =>
        sum +
        event.usdValue,
      0
    );

  const largest =
    [...events].sort(
      (a, b) =>
        b.usdValue -
        a.usdValue
    )[0];

  return {
    totalEvents:
      events.length,

    ethEvents:
      ethEvents.length,

    btcEvents:
      btcEvents.length,

    exchangeInflows:
      inflows.length,

    exchangeOutflows:
      outflows.length,

    exchangeToExchange:
      exchangeToExchange.length,

    exchangeInflowUsd:
      round(
        inflowUsd,
        2
      ),

    exchangeOutflowUsd:
      round(
        outflowUsd,
        2
      ),

    netExchangeFlowUsd:
      round(
        inflowUsd -
          outflowUsd,
        2
      ),

    totalObservedUsd:
      round(
        totalObservedUsd,
        2
      ),

    largestTransferUsd:
      largest
        ? largest.usdValue
        : 0,

    whaleScore,

    directionalBias,
  };
}

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(
        request.url
      );

    const requestedMinUsd =
      safeNumber(
        searchParams.get(
          "minUsd"
        ) ||
          500000
      );

    const minUsd =
      clamp(
        requestedMinUsd,
        100_000,
        50_000_000
      );

    const database =
      await loadWalletDatabase();

    const errors: {
      bitcoin?: string;
      ethereum?: string;
    } = {};

    const [
      btcResult,
      ethResult,
    ] =
      await Promise.allSettled([
        loadBitcoinEvents(
          minUsd,
          database
        ),

        loadEthereumEvents(
          minUsd,
          database
        ),
      ]);

    let btcEvents:
      WhaleEvent[] = [];

    let ethEvents:
      WhaleEvent[] = [];

    if (
      btcResult.status ===
      "fulfilled"
    ) {
      btcEvents =
        btcResult.value;
    } else {
      errors.bitcoin =
        btcResult.reason instanceof
        Error
          ? btcResult.reason
              .message
          : "Bitcoin scanner failed.";
    }

    if (
      ethResult.status ===
      "fulfilled"
    ) {
      ethEvents =
        ethResult.value;
    } else {
      errors.ethereum =
        ethResult.reason instanceof
        Error
          ? ethResult.reason
              .message
          : "Ethereum scanner failed.";
    }

    const events = [
      ...btcEvents,
      ...ethEvents,
    ].sort(
      (a, b) =>
        b.usdValue -
        a.usdValue
    );

    const summary =
      calculateWhaleSummary(
        events
      );

    return NextResponse.json({
      success: true,

      thresholdUsd:
        minUsd,

      summary,

      walletDatabase: {
        ethereumExchangeWallets:
          database.networks
            .ethereum
            .walletCount,

        bitcoinExchangeWallets:
          database.networks
            .bitcoin
            .walletCount,
      },

      events,

      sourceStatus: {
        bitcoin:
          errors.bitcoin
            ? "ERROR"
            : "OK",

        ethereum:
          errors.ethereum
            ? "ERROR"
            : "OK",

        walletLabels:
          "OK",
      },

      sourceErrors:
        errors,

      methodology: {
        ethExchangeInflow:
          "Potential bearish pressure",

        ethExchangeOutflow:
          "Potential bullish accumulation/withdrawal signal",

        exchangeToExchange:
          "Neutral",

        unknownTransfer:
          "Not directionally scored",

        bitcoinDirectionalScoring:
          false,
      },

      modules: {
        nativeEthWhales:
          true,

        bitcoinWhales:
          true,

        exchangeWalletLabels:
          true,

        ethExchangeFlow:
          true,

        bitcoinExchangeFlow:
          false,

        erc20Transfers:
          false,

        stablecoinFlows:
          false,

        solanaWhales:
          false,
      },

      updatedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    console.error(
      "Whale scanner error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze whale activity.",
      },
      {
        status: 500,
      }
    );
  }
}