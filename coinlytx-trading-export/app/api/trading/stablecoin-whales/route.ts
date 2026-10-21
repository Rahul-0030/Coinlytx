import {
  NextRequest,
  NextResponse,
} from "next/server";

import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ETH_RPC =
  "https://ethereum-rpc.publicnode.com";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

/*
 * Ethereum mainnet contracts.
 *
 * Both USDT and USDC use
 * 6 decimals.
 */

const TOKENS = {
  USDT: {
    symbol: "USDT",

    name: "Tether USD",

    address:
      "0xdac17f958d2ee523a2206206994597c13d831ec7",

    decimals: 6,
  },

  USDC: {
    symbol: "USDC",

    name: "USD Coin",

    address:
      "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",

    decimals: 6,
  },
} as const;

type TokenSymbol =
  keyof typeof TOKENS;

type WalletLabel = {
  entity: string;

  label: string;

  confidence: string;

  source: string;

  sourceUrl?: string;

  lastUpdated?: string;
};

type WalletDatabase = {
  networks: {
    ethereum: {
      symbol: string;

      walletCount: number;

      wallets: Record<
        string,
        WalletLabel
      >;
    };
  };
};

type EthLog = {
  address: string;

  topics: string[];

  data: string;

  blockNumber: string;

  transactionHash: string;

  transactionIndex: string;

  blockHash: string;

  logIndex: string;

  removed: boolean;
};

type EthBlock = {
  number: string;

  timestamp: string;
};

type StablecoinFlowType =
  | "EXCHANGE_INFLOW"
  | "EXCHANGE_OUTFLOW"
  | "EXCHANGE_TO_EXCHANGE"
  | "UNCLASSIFIED";

type LiquidityImpact =
  | "BULLISH_LIQUIDITY"
  | "BEARISH_LIQUIDITY"
  | "NEUTRAL"
  | "UNKNOWN";

type StablecoinEvent = {
  token: TokenSymbol;

  txHash: string;

  blockNumber: number;

  timestamp: string | null;

  amount: number;

  usdValue: number;

  from: string;

  to: string;

  fromEntity: string | null;

  fromLabel: string | null;

  toEntity: string | null;

  toLabel: string | null;

  flowType:
    StablecoinFlowType;

  liquidityImpact:
    LiquidityImpact;

  scoreImpact: number;

  attributionConfidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  note: string;
};

let walletDatabaseCache:
  | WalletDatabase
  | null = null;

function safeNumber(
  value: unknown,
  fallback = 0
) {
  const result =
    Number(value);

  return Number.isFinite(
    result
  )
    ? result
    : fallback;
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

function round(
  value: number,
  decimals = 2
) {
  if (
    !Number.isFinite(
      value
    )
  ) {
    return 0;
  }

  const factor =
    10 ** decimals;

  return (
    Math.round(
      value *
        factor
    ) /
    factor
  );
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

function topicToAddress(
  topic: string
) {
  /*
   * ERC-20 indexed addresses
   * are left padded to 32 bytes.
   */

  if (
    !topic ||
    topic.length <
      42
  ) {
    return "";
  }

  return (
    "0x" +
    topic.slice(
      -40
    )
  ).toLowerCase();
}

function decodeTokenAmount(
  data: string,
  decimals: number
) {
  try {
    const raw =
      BigInt(data);

    const divisor =
      10 ** decimals;

    return (
      Number(raw) /
      divisor
    );
  } catch {
    return 0;
  }
}

async function ethereumRpc<T>(
  method: string,
  params: unknown[]
): Promise<T> {
  const response =
    await fetch(
      ETH_RPC,
      {
        method:
          "POST",

        cache:
          "no-store",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify({
            jsonrpc:
              "2.0",

            id:
              Date.now(),

            method,

            params,
          }),
      }
    );

  if (
    !response.ok
  ) {
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
      `${method} returned no result.`
    );
  }

  return data.result;
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
    ) as WalletDatabase;

  return walletDatabaseCache;
}

function lookupWallet(
  database: WalletDatabase,
  address: string
) {
  return (
    database.networks
      .ethereum
      .wallets[
      address.toLowerCase()
    ] ||
    null
  );
}

function confidenceMultiplier(
  confidence:
    string | undefined
) {
  const normalized =
    (
      confidence ||
      ""
    ).toLowerCase();

  if (
    normalized ===
    "high"
  ) {
    return 1;
  }

  if (
    normalized ===
    "medium"
  ) {
    return 0.7;
  }

  return 0.5;
}

function getAttributionConfidence(
  label:
    WalletLabel | null
):
  | "HIGH"
  | "MEDIUM"
  | "LOW" {
  if (!label) {
    return "LOW";
  }

  const confidence =
    (
      label.confidence ||
      ""
    ).toLowerCase();

  if (
    confidence ===
    "high"
  ) {
    return "HIGH";
  }

  if (
    confidence ===
    "medium"
  ) {
    return "MEDIUM";
  }

  return "LOW";
}

function valueWeight(
  usdValue: number
) {
  if (
    usdValue >=
    100_000_000
  ) {
    return 20;
  }

  if (
    usdValue >=
    50_000_000
  ) {
    return 16;
  }

  if (
    usdValue >=
    20_000_000
  ) {
    return 12;
  }

  if (
    usdValue >=
    10_000_000
  ) {
    return 9;
  }

  if (
    usdValue >=
    5_000_000
  ) {
    return 7;
  }

  if (
    usdValue >=
    1_000_000
  ) {
    return 5;
  }

  return 2;
}

function classifyFlow({
  fromLabel,
  toLabel,
  usdValue,
}: {
  fromLabel:
    WalletLabel | null;

  toLabel:
    WalletLabel | null;

  usdValue:
    number;
}) {
  const baseWeight =
    valueWeight(
      usdValue
    );

  /*
   * Stablecoin entering an
   * exchange can represent
   * potential buying liquidity.
   */

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

      liquidityImpact:
        "BULLISH_LIQUIDITY" as const,

      scoreImpact:
        round(
          baseWeight *
            multiplier,
          2
        ),

      confidence:
        getAttributionConfidence(
          toLabel
        ),

      note:
        `Large stablecoin deposit into ${toLabel.entity}. This may increase deployable exchange liquidity, but it does not prove immediate crypto buying.`,
    };
  }

  /*
   * Stablecoin leaving an
   * exchange removes immediately
   * available exchange liquidity.
   */

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

      liquidityImpact:
        "BEARISH_LIQUIDITY" as const,

      scoreImpact:
        -round(
          baseWeight *
            multiplier,
          2
        ),

      confidence:
        getAttributionConfidence(
          fromLabel
        ),

      note:
        `Large stablecoin withdrawal from ${fromLabel.entity}. Exchange liquidity is leaving, although the destination and intent are unknown.`,
    };
  }

  if (
    fromLabel &&
    toLabel
  ) {
    return {
      flowType:
        "EXCHANGE_TO_EXCHANGE" as const,

      liquidityImpact:
        "NEUTRAL" as const,

      scoreImpact:
        0,

      confidence:
        "HIGH" as const,

      note:
        `${fromLabel.entity} → ${toLabel.entity}. Exchange-to-exchange stablecoin movement is not scored directionally.`,
    };
  }

  return {
    flowType:
      "UNCLASSIFIED" as const,

    liquidityImpact:
      "UNKNOWN" as const,

    scoreImpact:
      0,

    confidence:
      "LOW" as const,

    note:
      "Large stablecoin transfer detected, but neither wallet is identified as an exchange.",
  };
}

async function getTokenLogs(
  token:
    TokenSymbol,
  fromBlock: number,
  toBlock: number
) {
  const config =
    TOKENS[token];

  return ethereumRpc<
    EthLog[]
  >(
    "eth_getLogs",
    [
      {
        address:
          config.address,

        fromBlock:
          `0x${fromBlock.toString(
            16
          )}`,

        toBlock:
          `0x${toBlock.toString(
            16
          )}`,

        topics: [
          TRANSFER_TOPIC,
        ],
      },
    ]
  );
}

async function getBlockTimestamp(
  blockNumber:
    number
) {
  const block =
    await ethereumRpc<
      EthBlock | null
    >(
      "eth_getBlockByNumber",
      [
        `0x${blockNumber.toString(
          16
        )}`,

        false,
      ]
    );

  if (
    !block
  ) {
    return null;
  }

  const seconds =
    hexToNumber(
      block.timestamp
    );

  if (
    seconds <=
    0
  ) {
    return null;
  }

  return new Date(
    seconds *
      1000
  ).toISOString();
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;

    /*
     * Default:
     * $250,000 whale threshold.
     */

    const requestedThreshold =
      safeNumber(
        searchParams.get(
          "minUsd"
        ),
        250_000
      );

    const minUsd =
      clamp(
        requestedThreshold,
        100_000,
        50_000_000
      );

    /*
     * About ~50 minutes of
     * Ethereum blocks at roughly
     * 12 seconds/block.
     */

    const requestedBlocks =
      safeNumber(
        searchParams.get(
          "blocks"
        ),
        250
      );

    const blockLookback =
      Math.floor(
        clamp(
          requestedBlocks,
          50,
          500
        )
      );

    const database =
      await loadWalletDatabase();

    const latestHex =
      await ethereumRpc<string>(
        "eth_blockNumber",
        []
      );

    const latestBlock =
      hexToNumber(
        latestHex
      );

    if (
      latestBlock <=
      0
    ) {
      throw new Error(
        "Unable to determine latest Ethereum block."
      );
    }

    const fromBlock =
      Math.max(
        1,
        latestBlock -
          blockLookback
      );

    /*
     * Fetch USDT and USDC
     * transfers in parallel.
     */

    const [
      usdtResult,
      usdcResult,
    ] =
      await Promise.allSettled([
        getTokenLogs(
          "USDT",
          fromBlock,
          latestBlock
        ),

        getTokenLogs(
          "USDC",
          fromBlock,
          latestBlock
        ),
      ]);

    const sourceErrors: {
      USDT?: string;

      USDC?: string;
    } = {};

    const tokenLogs: {
      token:
        TokenSymbol;

      logs:
        EthLog[];
    }[] = [];

    if (
      usdtResult.status ===
      "fulfilled"
    ) {
      tokenLogs.push({
        token:
          "USDT",

        logs:
          usdtResult.value,
      });
    } else {
      sourceErrors.USDT =
        usdtResult.reason instanceof
        Error
          ? usdtResult.reason
              .message
          : "USDT log request failed.";
    }

    if (
      usdcResult.status ===
      "fulfilled"
    ) {
      tokenLogs.push({
        token:
          "USDC",

        logs:
          usdcResult.value,
      });
    } else {
      sourceErrors.USDC =
        usdcResult.reason instanceof
        Error
          ? usdcResult.reason
              .message
          : "USDC log request failed.";
    }

    const candidates: {
      token:
        TokenSymbol;

      txHash:
        string;

      blockNumber:
        number;

      amount:
        number;

      usdValue:
        number;

      from:
        string;

      to:
        string;
    }[] = [];

    for (
      const source of
      tokenLogs
    ) {
      const config =
        TOKENS[
          source.token
        ];

      for (
        const log of
        source.logs
      ) {
        if (
          log.removed
        ) {
          continue;
        }

        if (
          log.topics.length <
          3
        ) {
          continue;
        }

        const from =
          topicToAddress(
            log.topics[1]
          );

        const to =
          topicToAddress(
            log.topics[2]
          );

        if (
          !from ||
          !to
        ) {
          continue;
        }

        const amount =
          decodeTokenAmount(
            log.data,
            config.decimals
          );

        /*
         * Stablecoins are treated
         * approximately as $1 for
         * this liquidity scanner.
         */

        const usdValue =
          amount;

        if (
          usdValue <
          minUsd
        ) {
          continue;
        }

        candidates.push({
          token:
            source.token,

          txHash:
            log.transactionHash,

          blockNumber:
            hexToNumber(
              log.blockNumber
            ),

          amount,

          usdValue,

          from,

          to,
        });
      }
    }

    /*
     * Largest transfers first.
     *
     * Limit the number of
     * follow-up block lookups.
     */

    candidates.sort(
      (
        a,
        b
      ) =>
        b.usdValue -
        a.usdValue
    );

    const selected =
      candidates.slice(
        0,
        40
      );

    const uniqueBlocks =
      [
        ...new Set(
          selected.map(
            (
              item
            ) =>
              item.blockNumber
          )
        ),
      ];

    const timestampEntries =
      await Promise.all(
        uniqueBlocks.map(
          async (
            blockNumber
          ) => {
            try {
              const timestamp =
                await getBlockTimestamp(
                  blockNumber
                );

              return [
                blockNumber,
                timestamp,
              ] as const;
            } catch {
              return [
                blockNumber,
                null,
              ] as const;
            }
          }
        )
      );

    const timestampMap =
      new Map(
        timestampEntries
      );

    const events:
      StablecoinEvent[] =
      selected.map(
        (
          item
        ) => {
          const fromLabel =
            lookupWallet(
              database,
              item.from
            );

          const toLabel =
            lookupWallet(
              database,
              item.to
            );

          const classification =
            classifyFlow({
              fromLabel,

              toLabel,

              usdValue:
                item.usdValue,
            });

          return {
            token:
              item.token,

            txHash:
              item.txHash,

            blockNumber:
              item.blockNumber,

            timestamp:
              timestampMap.get(
                item.blockNumber
              ) ||
              null,

            amount:
              round(
                item.amount,
                2
              ),

            usdValue:
              round(
                item.usdValue,
                2
              ),

            from:
              item.from,

            to:
              item.to,

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

            liquidityImpact:
              classification.liquidityImpact,

            scoreImpact:
              classification.scoreImpact,

            attributionConfidence:
              classification.confidence,

            note:
              classification.note,
          };
        }
      );

    /*
     * Summary
     */

    const inflows =
      events.filter(
        (
          event
        ) =>
          event.flowType ===
          "EXCHANGE_INFLOW"
      );

    const outflows =
      events.filter(
        (
          event
        ) =>
          event.flowType ===
          "EXCHANGE_OUTFLOW"
      );

    const exchangeTransfers =
      events.filter(
        (
          event
        ) =>
          event.flowType ===
          "EXCHANGE_TO_EXCHANGE"
      );

    const unclassified =
      events.filter(
        (
          event
        ) =>
          event.flowType ===
          "UNCLASSIFIED"
      );

    const inflowUsd =
      inflows.reduce(
        (
          total,
          event
        ) =>
          total +
          event.usdValue,
        0
      );

    const outflowUsd =
      outflows.reduce(
        (
          total,
          event
        ) =>
          total +
          event.usdValue,
        0
      );

    const stablecoinScore =
      clamp(
        events.reduce(
          (
            total,
            event
          ) =>
            total +
            event.scoreImpact,
          0
        ),
        -100,
        100
      );

    let liquidityBias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL" =
      "NEUTRAL";

    if (
      stablecoinScore >=
      8
    ) {
      liquidityBias =
        "BULLISH";
    }

    if (
      stablecoinScore <=
      -8
    ) {
      liquidityBias =
        "BEARISH";
    }

    const usdtEvents =
      events.filter(
        (
          event
        ) =>
          event.token ===
          "USDT"
      );

    const usdcEvents =
      events.filter(
        (
          event
        ) =>
          event.token ===
          "USDC"
      );

    const totalObservedUsd =
      events.reduce(
        (
          total,
          event
        ) =>
          total +
          event.usdValue,
        0
      );

    return NextResponse.json({
      success:
        true,

      thresholdUsd:
        minUsd,

      blockRange: {
        from:
          fromBlock,

        to:
          latestBlock,

        blocks:
          latestBlock -
          fromBlock +
          1,
      },

      summary: {
        totalEvents:
          events.length,

        usdtEvents:
          usdtEvents.length,

        usdcEvents:
          usdcEvents.length,

        exchangeInflows:
          inflows.length,

        exchangeOutflows:
          outflows.length,

        exchangeToExchange:
          exchangeTransfers.length,

        unclassified:
          unclassified.length,

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

        /*
         * Positive =
         * more stablecoins
         * entering exchanges.
         */

        netExchangeLiquidityUsd:
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

        stablecoinScore:
          round(
            stablecoinScore,
            1
          ),

        liquidityBias,
      },

      events,

      walletDatabase: {
        ethereumExchangeWallets:
          database.networks
            .ethereum
            .walletCount,
      },

      sourceStatus: {
        USDT:
          sourceErrors.USDT
            ? "ERROR"
            : "OK",

        USDC:
          sourceErrors.USDC
            ? "ERROR"
            : "OK",

        walletLabels:
          "OK",
      },

      sourceErrors,

      methodology: {
        exchangeInflow:
          "Potential increase in deployable exchange buying liquidity.",

        exchangeOutflow:
          "Potential decrease in immediately available exchange stablecoin liquidity.",

        exchangeToExchange:
          "Neutral.",

        unclassified:
          "Detected but not directionally scored.",

        important:
          "Stablecoin exchange flows are liquidity signals, not proof that traders will buy or sell crypto.",
      },

      modules: {
        usdt:
          true,

        usdc:
          true,

        ethereum:
          true,

        exchangeAttribution:
          true,

        stablecoinLiquidityScore:
          true,

        otherErc20Tokens:
          false,

        solanaStablecoins:
          false,
      },

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "Stablecoin whale scanner error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to analyze stablecoin whale activity.",
      },
      {
        status:
          500,
      }
    );
  }
}