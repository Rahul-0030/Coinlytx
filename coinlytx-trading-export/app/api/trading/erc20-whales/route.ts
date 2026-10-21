import {
  NextRequest,
  NextResponse,
} from "next/server";

import fs from "fs";
import path from "path";

import {
  normalizeTradingSymbol,
} from "@/lib/trading/symbol";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const ETH_RPC =
  "https://ethereum-rpc.publicnode.com";

const BINANCE_SPOT =
  "https://data-api.binance.vision";

const TRANSFER_TOPIC =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000";

type TokenConfig = {
  symbol: string;

  tradingSymbol: string;

  name: string;

  contract: string;

  decimals: number;
};

const TOKENS: Record<
  string,
  TokenConfig
> = {
  LINKUSDT: {
    symbol:
      "LINK",

    tradingSymbol:
      "LINKUSDT",

    name:
      "Chainlink",

    contract:
      "0x514910771af9ca656af840dff83e8264ecf986ca",

    decimals:
      18,
  },

  UNIUSDT: {
    symbol:
      "UNI",

    tradingSymbol:
      "UNIUSDT",

    name:
      "Uniswap",

    contract:
      "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984",

    decimals:
      18,
  },

  AAVEUSDT: {
    symbol:
      "AAVE",

    tradingSymbol:
      "AAVEUSDT",

    name:
      "Aave",

    contract:
      "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9",

    decimals:
      18,
  },

  SHIBUSDT: {
    symbol:
      "SHIB",

    tradingSymbol:
      "SHIBUSDT",

    name:
      "Shiba Inu",

    contract:
      "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce",

    decimals:
      18,
  },

  PEPEUSDT: {
    symbol:
      "PEPE",

    tradingSymbol:
      "PEPEUSDT",

    name:
      "Pepe",

    contract:
      "0x6982508145454ce325ddbe47a25d4ec3d2311933",

    decimals:
      18,
  },
};

type RpcResponse<T> = {
  jsonrpc: string;

  id: number;

  result?: T;

  error?: {
    code: number;

    message: string;
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

type BinanceTicker = {
  symbol: string;

  lastPrice: string;

  quoteVolume: string;

  priceChangePercent: string;
};

type FlowType =
  | "EXCHANGE_INFLOW"
  | "EXCHANGE_OUTFLOW"
  | "EXCHANGE_TO_EXCHANGE"
  | "WALLET_TO_WALLET"
  | "MINT"
  | "BURN";

type FlowBias =
  | "BEARISH"
  | "BULLISH"
  | "NEUTRAL"
  | "UNCLASSIFIED";

type RawTransfer = {
  token: string;

  tradingSymbol: string;

  transactionHash: string;

  blockNumber: number;

  logIndex: number;

  from: string;

  to: string;

  tokenAmount: number;

  tokenPriceUsd: number;

  usdValue: number;
};

type CollapsedTransfer = {
  token: string;

  tradingSymbol: string;

  transactionHash: string;

  blockNumber: number;

  firstLogIndex: number;

  lastLogIndex: number;

  from: string;

  to: string;

  tokenAmount: number;

  tokenPriceUsd: number;

  usdValue: number;

  routeHops: number;

  rawTransferCount: number;

  routed: boolean;
};

type WhaleEvent = {
  token: string;

  tradingSymbol: string;

  transactionHash: string;

  blockNumber: number;

  timestamp:
    | number
    | null;

  from: string;

  to: string;

  fromExchange:
    | string
    | null;

  toExchange:
    | string
    | null;

  tokenAmount: number;

  tokenPriceUsd: number;

  usdValue: number;

  flowType:
    FlowType;

  bias:
    FlowBias;

  score: number;

  routeHops: number;

  rawTransferCount: number;

  routed: boolean;
};

let exchangeWalletCache:
  Map<
    string,
    string
  > | null = null;

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

  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      value *
        multiplier
    ) /
    multiplier
  );
}

function normalizeAddress(
  address:
    | string
    | null
    | undefined
) {
  if (
    !address
  ) {
    return "";
  }

  return address
    .trim()
    .toLowerCase();
}

function isEthereumAddress(
  value: unknown
) {
  return (
    typeof value ===
      "string" &&
    /^0x[a-fA-F0-9]{40}$/.test(
      value
    )
  );
}

function topicToAddress(
  topic: string
) {
  if (
    !topic ||
    topic.length <
      42
  ) {
    return "";
  }

  return (
    "0x" +
    topic
      .slice(-40)
      .toLowerCase()
  );
}

function hexToNumber(
  value: string
) {
  const parsed =
    Number.parseInt(
      value,
      16
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return parsed;
}

/*
 * No BigInt literals are used
 * because this project currently
 * targets below ES2020.
 *
 * Number precision is adequate
 * for whale-value estimation,
 * threshold filtering and
 * approximate routing detection.
 */
function decodeTokenAmount(
  hexValue: string,
  decimals: number
) {
  try {
    if (
      !hexValue ||
      hexValue ===
        "0x"
    ) {
      return 0;
    }

    const raw =
      Number.parseInt(
        hexValue,
        16
      );

    if (
      !Number.isFinite(
        raw
      ) ||
      raw <=
        0
    ) {
      return 0;
    }

    const divisor =
      10 **
      decimals;

    const amount =
      raw /
      divisor;

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <=
        0
    ) {
      return 0;
    }

    return amount;
  } catch {
    return 0;
  }
}

/*
 * Used only for identifying
 * probable routing legs inside
 * one Ethereum transaction.
 *
 * This is deliberately strict:
 * if amounts differ materially,
 * we do NOT collapse them.
 */
function approximatelySameAmount(
  a: number,
  b: number
) {
  if (
    !Number.isFinite(
      a
    ) ||
    !Number.isFinite(
      b
    )
  ) {
    return false;
  }

  if (
    a <=
      0 ||
    b <=
      0
  ) {
    return false;
  }

  const difference =
    Math.abs(
      a -
        b
    );

  const largest =
    Math.max(
      Math.abs(
        a
      ),
      Math.abs(
        b
      )
    );

  const absoluteTolerance =
    0.00000001;

  const relativeTolerance =
    largest *
    0.00000001;

  return (
    difference <=
    Math.max(
      absoluteTolerance,
      relativeTolerance
    )
  );
}

function extractExchangeWallets(
  value: unknown,
  result: Map<
    string,
    string
  >,
  parentLabel =
    "Exchange"
) {
  if (
    value === null ||
    value === undefined
  ) {
    return;
  }

  if (
    Array.isArray(
      value
    )
  ) {
    for (
      const item of value
    ) {
      if (
        typeof item ===
          "object" &&
        item !==
          null
      ) {
        const record =
          item as Record<
            string,
            unknown
          >;

        const possibleAddress =
          record.address ||
          record.wallet ||
          record.walletAddress;

        const possibleLabel =
          record.exchange ||
          record.label ||
          record.name ||
          record.entity ||
          parentLabel;

        if (
          typeof possibleAddress ===
            "string" &&
          isEthereumAddress(
            possibleAddress
          )
        ) {
          result.set(
            normalizeAddress(
              possibleAddress
            ),

            typeof possibleLabel ===
              "string"
              ? possibleLabel
              : parentLabel
          );
        }
      }

      extractExchangeWallets(
        item,
        result,
        parentLabel
      );
    }

    return;
  }

  if (
    typeof value !==
      "object"
  ) {
    return;
  }

  const record =
    value as Record<
      string,
      unknown
    >;

  for (
    const [
      key,
      child,
    ] of Object.entries(
      record
    )
  ) {
    if (
      isEthereumAddress(
        key
      )
    ) {
      let label =
        parentLabel;

      if (
        typeof child ===
        "string"
      ) {
        label =
          child;
      } else if (
        typeof child ===
          "object" &&
        child !==
          null
      ) {
        const childRecord =
          child as Record<
            string,
            unknown
          >;

        const candidate =
          childRecord.exchange ||
          childRecord.label ||
          childRecord.name ||
          childRecord.entity;

        if (
          typeof candidate ===
          "string"
        ) {
          label =
            candidate;
        }
      }

      result.set(
        normalizeAddress(
          key
        ),
        label
      );

      continue;
    }

    const lowerKey =
      String(
        key
      ).toLowerCase();

    let nextLabel =
      parentLabel;

    if (
      lowerKey &&
      ![
        "ethereum",
        "wallets",
        "addresses",
        "data",
        "exchanges",
      ].includes(
        lowerKey
      )
    ) {
      nextLabel =
        key;
    }

    extractExchangeWallets(
      child,
      result,
      nextLabel
    );
  }
}

function loadExchangeWallets() {
  if (
    exchangeWalletCache
  ) {
    return exchangeWalletCache;
  }

  const walletMap =
    new Map<
      string,
      string
    >();

  try {
    const filePath =
      path.join(
        process.cwd(),
        "lib",
        "trading",
        "data",
        "exchange-wallets.json"
      );

    if (
      !fs.existsSync(
        filePath
      )
    ) {
      console.warn(
        "Exchange wallet attribution file not found:",
        filePath
      );

      exchangeWalletCache =
        walletMap;

      return walletMap;
    }

    const raw =
      fs.readFileSync(
        filePath,
        "utf8"
      );

    const json =
      JSON.parse(
        raw
      ) as unknown;

    extractExchangeWallets(
      json,
      walletMap
    );

    exchangeWalletCache =
      walletMap;

    return walletMap;
  } catch (
    error
  ) {
    console.error(
      "Unable to load exchange wallet attribution:",
      error
    );

    exchangeWalletCache =
      walletMap;

    return walletMap;
  }
}

async function rpc<T>(
  method: string,
  params: unknown[]
): Promise<T> {
  const response =
    await fetch(
      ETH_RPC,
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            {
              jsonrpc:
                "2.0",

              id:
                1,

              method,

              params,
            }
          ),

        cache:
          "no-store",
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Ethereum RPC request failed: ${response.status}`
    );
  }

  const json =
    (await response.json()) as
      RpcResponse<T>;

  if (
    json.error
  ) {
    throw new Error(
      `Ethereum RPC error: ${json.error.message}`
    );
  }

  if (
    json.result ===
    undefined
  ) {
    throw new Error(
      `Ethereum RPC returned no result for ${method}.`
    );
  }

  return json.result;
}

async function getLatestBlockNumber() {
  const result =
    await rpc<string>(
      "eth_blockNumber",
      []
    );

  return hexToNumber(
    result
  );
}

async function getTokenPrice(
  symbol: string
) {
  const response =
    await fetch(
      `${BINANCE_SPOT}/api/v3/ticker/24hr?symbol=${encodeURIComponent(
        symbol
      )}`,
      {
        cache:
          "no-store",
      }
    );

  if (
    !response.ok
  ) {
    throw new Error(
      `Unable to get ${symbol} price from Binance.`
    );
  }

  const ticker =
    (await response.json()) as
      BinanceTicker;

  const price =
    Number(
      ticker.lastPrice
    );

  if (
    !Number.isFinite(
      price
    ) ||
    price <=
      0
  ) {
    throw new Error(
      `Invalid Binance price returned for ${symbol}.`
    );
  }

  return {
    price,

    change24h:
      Number(
        ticker.priceChangePercent
      ),

    quoteVolume24h:
      Number(
        ticker.quoteVolume
      ),
  };
}

async function getTransferLogs(
  contract: string,
  fromBlock: number,
  toBlock: number
) {
  return rpc<
    EthLog[]
  >(
    "eth_getLogs",
    [
      {
        address:
          contract,

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
  blockNumber: number
) {
  try {
    const block =
      await rpc<{
        timestamp: string;
      }>(
        "eth_getBlockByNumber",
        [
          `0x${blockNumber.toString(
            16
          )}`,

          false,
        ]
      );

    return hexToNumber(
      block.timestamp
    );
  } catch {
    return null;
  }
}

function calculateEventScore(
  usdValue: number
) {
  if (
    usdValue >=
    20_000_000
  ) {
    return 20;
  }

  if (
    usdValue >=
    10_000_000
  ) {
    return 16;
  }

  if (
    usdValue >=
    5_000_000
  ) {
    return 12;
  }

  if (
    usdValue >=
    2_000_000
  ) {
    return 9;
  }

  if (
    usdValue >=
    1_000_000
  ) {
    return 7;
  }

  if (
    usdValue >=
    500_000
  ) {
    return 5;
  }

  return 3;
}

function classifyTransfer(
  from: string,
  to: string,
  exchangeWallets: Map<
    string,
    string
  >
) {
  const normalizedFrom =
    normalizeAddress(
      from
    );

  const normalizedTo =
    normalizeAddress(
      to
    );

  const fromExchange =
    exchangeWallets.get(
      normalizedFrom
    ) ||
    null;

  const toExchange =
    exchangeWallets.get(
      normalizedTo
    ) ||
    null;

  if (
    normalizedFrom ===
    ZERO_ADDRESS
  ) {
    return {
      flowType:
        "MINT" as FlowType,

      bias:
        "NEUTRAL" as FlowBias,

      fromExchange,

      toExchange,
    };
  }

  if (
    normalizedTo ===
    ZERO_ADDRESS
  ) {
    return {
      flowType:
        "BURN" as FlowType,

      bias:
        "NEUTRAL" as FlowBias,

      fromExchange,

      toExchange,
    };
  }

  if (
    fromExchange &&
    toExchange
  ) {
    return {
      flowType:
        "EXCHANGE_TO_EXCHANGE" as FlowType,

      bias:
        "NEUTRAL" as FlowBias,

      fromExchange,

      toExchange,
    };
  }

  if (
    !fromExchange &&
    toExchange
  ) {
    return {
      flowType:
        "EXCHANGE_INFLOW" as FlowType,

      bias:
        "BEARISH" as FlowBias,

      fromExchange,

      toExchange,
    };
  }

  if (
    fromExchange &&
    !toExchange
  ) {
    return {
      flowType:
        "EXCHANGE_OUTFLOW" as FlowType,

      bias:
        "BULLISH" as FlowBias,

      fromExchange,

      toExchange,
    };
  }

  return {
    flowType:
      "WALLET_TO_WALLET" as FlowType,

    bias:
      "UNCLASSIFIED" as FlowBias,

    fromExchange,

    toExchange,
  };
}

/*
 * True when a transfer has an
 * earlier transfer in the same
 * transaction with:
 *
 * earlier.to === current.from
 *
 * and approximately the same
 * token amount.
 *
 * Such a transfer is probably
 * an intermediate routing leg.
 */
function hasPredecessor(
  transfers: RawTransfer[],
  currentIndex: number
) {
  const current =
    transfers[
      currentIndex
    ];

  for (
    let i = 0;
    i <
    currentIndex;
    i +=
      1
  ) {
    const candidate =
      transfers[
        i
      ];

    if (
      normalizeAddress(
        candidate.to
      ) !==
      normalizeAddress(
        current.from
      )
    ) {
      continue;
    }

    if (
      approximatelySameAmount(
        candidate.tokenAmount,
        current.tokenAmount
      )
    ) {
      return true;
    }
  }

  return false;
}

function findNextRouteLeg(
  transfers: RawTransfer[],
  used: Set<number>,
  currentIndex: number,
  destination: string,
  amount: number
) {
  const matches:
    number[] = [];

  for (
    let i =
      currentIndex +
      1;
    i <
    transfers.length;
    i +=
      1
  ) {
    if (
      used.has(
        i
      )
    ) {
      continue;
    }

    const candidate =
      transfers[
        i
      ];

    if (
      normalizeAddress(
        candidate.from
      ) !==
      normalizeAddress(
        destination
      )
    ) {
      continue;
    }

    if (
      !approximatelySameAmount(
        candidate.tokenAmount,
        amount
      )
    ) {
      continue;
    }

    matches.push(
      i
    );
  }

  /*
   * Only collapse when the route
   * is unambiguous.
   *
   * If an intermediary sends the
   * same amount to multiple
   * destinations, we keep the raw
   * legs instead of guessing.
   */
  if (
    matches.length !==
    1
  ) {
    return null;
  }

  return matches[0];
}

function buildRouteFromStart(
  transfers: RawTransfer[],
  startIndex: number,
  used: Set<number>
): CollapsedTransfer {
  const first =
    transfers[
      startIndex
    ];

  used.add(
    startIndex
  );

  let currentIndex =
    startIndex;

  let finalTo =
    first.to;

  let conservativeAmount =
    first.tokenAmount;

  let lastLogIndex =
    first.logIndex;

  let rawTransferCount =
    1;

  while (
    true
  ) {
    const nextIndex =
      findNextRouteLeg(
        transfers,
        used,
        currentIndex,
        finalTo,
        conservativeAmount
      );

    if (
      nextIndex ===
      null
    ) {
      break;
    }

    const next =
      transfers[
        nextIndex
      ];

    used.add(
      nextIndex
    );

    finalTo =
      next.to;

    /*
     * When amounts differ by a
     * tiny amount, use the smaller
     * amount. This prevents route
     * collapsing from inflating
     * economic value.
     */
    conservativeAmount =
      Math.min(
        conservativeAmount,
        next.tokenAmount
      );

    lastLogIndex =
      next.logIndex;

    rawTransferCount +=
      1;

    currentIndex =
      nextIndex;
  }

  return {
    token:
      first.token,

    tradingSymbol:
      first.tradingSymbol,

    transactionHash:
      first.transactionHash,

    blockNumber:
      first.blockNumber,

    firstLogIndex:
      first.logIndex,

    lastLogIndex,

    from:
      first.from,

    to:
      finalTo,

    tokenAmount:
      conservativeAmount,

    tokenPriceUsd:
      first.tokenPriceUsd,

    usdValue:
      conservativeAmount *
      first.tokenPriceUsd,

    routeHops:
      rawTransferCount,

    rawTransferCount,

    routed:
      rawTransferCount >
      1,
  };
}

function collapseTransactionTransfers(
  transactionTransfers: RawTransfer[]
) {
  const transfers =
    [
      ...transactionTransfers,
    ].sort(
      (
        a,
        b
      ) =>
        a.logIndex -
        b.logIndex
    );

  const used =
    new Set<number>();

  const collapsed:
    CollapsedTransfer[] = [];

  /*
   * First build routes from
   * transfers that do not have
   * an earlier same-amount
   * predecessor.
   */
  for (
    let i = 0;
    i <
    transfers.length;
    i +=
      1
  ) {
    if (
      used.has(
        i
      )
    ) {
      continue;
    }

    if (
      hasPredecessor(
        transfers,
        i
      )
    ) {
      continue;
    }

    collapsed.push(
      buildRouteFromStart(
        transfers,
        i,
        used
      )
    );
  }

  /*
   * Any transfer not consumed by
   * the conservative route logic
   * is kept separately.
   *
   * We prefer a possible duplicate
   * over incorrectly merging
   * unrelated transfers.
   */
  for (
    let i = 0;
    i <
    transfers.length;
    i +=
      1
  ) {
    if (
      used.has(
        i
      )
    ) {
      continue;
    }

    collapsed.push(
      buildRouteFromStart(
        transfers,
        i,
        used
      )
    );
  }

  return collapsed;
}

function collapseRoutedTransfers(
  transfers: RawTransfer[]
) {
  const byTransaction =
    new Map<
      string,
      RawTransfer[]
    >();

  for (
    const transfer of transfers
  ) {
    const current =
      byTransaction.get(
        transfer.transactionHash
      ) ||
      [];

    current.push(
      transfer
    );

    byTransaction.set(
      transfer.transactionHash,
      current
    );
  }

  const collapsed:
    CollapsedTransfer[] = [];

  for (
    const transactionTransfers of
    byTransaction.values()
  ) {
    collapsed.push(
      ...collapseTransactionTransfers(
        transactionTransfers
      )
    );
  }

  collapsed.sort(
    (
      a,
      b
    ) => {
      if (
        b.usdValue !==
        a.usdValue
      ) {
        return (
          b.usdValue -
          a.usdValue
        );
      }

      return (
        a.firstLogIndex -
        b.firstLogIndex
      );
    }
  );

  return collapsed;
}

export async function GET(
  request: NextRequest
) {
  try {
    const searchParams =
      request.nextUrl
        .searchParams;

    const symbol =
      normalizeTradingSymbol(
        searchParams.get(
          "symbol"
        ),
        "LINKUSDT"
      );

    const token =
      TOKENS[
        symbol
      ];

    if (
      !token
    ) {
      return NextResponse.json(
        {
          success:
            true,

          supported:
            false,

          symbol,

          bias:
            "NOT_SUPPORTED",

          whaleScore:
            0,

          message:
            `${symbol} is not yet mapped to a verified Ethereum ERC-20 contract.`,

          supportedSymbols:
            Object.keys(
              TOKENS
            ),

          updatedAt:
            new Date()
              .toISOString(),
        }
      );
    }

    const requestedMinUsd =
      Number(
        searchParams.get(
          "minUsd"
        ) ||
          250000
      );

    const minUsd =
      clamp(
        Number.isFinite(
          requestedMinUsd
        )
          ? requestedMinUsd
          : 250000,

        100000,

        50_000_000
      );

    const requestedLookback =
      Number(
        searchParams.get(
          "lookback"
        ) ||
          250
      );

    const lookback =
      Math.round(
        clamp(
          Number.isFinite(
            requestedLookback
          )
            ? requestedLookback
            : 250,

          50,

          500
        )
      );

    const [
      latestBlock,
      market,
    ] =
      await Promise.all([
        getLatestBlockNumber(),

        getTokenPrice(
          token.tradingSymbol
        ),
      ]);

    const fromBlock =
      Math.max(
        0,

        latestBlock -
          lookback
      );

    const logs =
      await getTransferLogs(
        token.contract,

        fromBlock,

        latestBlock
      );

    const exchangeWallets =
      loadExchangeWallets();

    const rawTransfers:
      RawTransfer[] = [];

    for (
      const log of logs
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

      const tokenAmount =
        decodeTokenAmount(
          log.data,

          token.decimals
        );

      if (
        !Number.isFinite(
          tokenAmount
        ) ||
        tokenAmount <=
          0
      ) {
        continue;
      }

      const usdValue =
        tokenAmount *
        market.price;

      if (
        !Number.isFinite(
          usdValue
        ) ||
        usdValue <
          minUsd
      ) {
        continue;
      }

      rawTransfers.push({
        token:
          token.symbol,

        tradingSymbol:
          token.tradingSymbol,

        transactionHash:
          log.transactionHash,

        blockNumber:
          hexToNumber(
            log.blockNumber
          ),

        logIndex:
          hexToNumber(
            log.logIndex
          ),

        from,

        to,

        tokenAmount,

        tokenPriceUsd:
          market.price,

        usdValue,
      });
    }

    /*
     * Collapse same-token routing
     * legs before classification
     * and before whale scoring.
     */
    const collapsedTransfers =
      collapseRoutedTransfers(
        rawTransfers
      );

    const events:
      WhaleEvent[] = [];

    for (
      const transfer of
      collapsedTransfers
    ) {
      const classification =
        classifyTransfer(
          transfer.from,

          transfer.to,

          exchangeWallets
        );

      const baseScore =
        calculateEventScore(
          transfer.usdValue
        );

      let eventScore =
        0;

      if (
        classification.bias ===
        "BULLISH"
      ) {
        eventScore =
          baseScore;
      }

      if (
        classification.bias ===
        "BEARISH"
      ) {
        eventScore =
          -baseScore;
      }

      events.push({
        token:
          transfer.token,

        tradingSymbol:
          transfer.tradingSymbol,

        transactionHash:
          transfer.transactionHash,

        blockNumber:
          transfer.blockNumber,

        timestamp:
          null,

        from:
          transfer.from,

        to:
          transfer.to,

        fromExchange:
          classification
            .fromExchange,

        toExchange:
          classification
            .toExchange,

        tokenAmount:
          round(
            transfer.tokenAmount,
            4
          ),

        tokenPriceUsd:
          round(
            transfer.tokenPriceUsd,
            8
          ),

        usdValue:
          round(
            transfer.usdValue,
            2
          ),

        flowType:
          classification
            .flowType,

        bias:
          classification
            .bias,

        score:
          eventScore,

        routeHops:
          transfer.routeHops,

        rawTransferCount:
          transfer.rawTransferCount,

        routed:
          transfer.routed,
      });
    }

    events.sort(
      (
        a,
        b
      ) =>
        b.usdValue -
        a.usdValue
    );

    const topEvents =
      events.slice(
        0,
        40
      );

    const uniqueBlocks =
      [
        ...new Set(
          topEvents.map(
            (
              event
            ) =>
              event.blockNumber
          )
        ),
      ];

    const timestampEntries =
      await Promise.all(
        uniqueBlocks.map(
          async (
            blockNumber
          ) => {
            const timestamp =
              await getBlockTimestamp(
                blockNumber
              );

            return [
              blockNumber,
              timestamp,
            ] as const;
          }
        )
      );

    const timestampMap =
      new Map(
        timestampEntries
      );

    for (
      const event of topEvents
    ) {
      event.timestamp =
        timestampMap.get(
          event.blockNumber
        ) ??
        null;
    }

    const exchangeInflows =
      topEvents.filter(
        (
          event
        ) =>
          event.flowType ===
          "EXCHANGE_INFLOW"
      );

    const exchangeOutflows =
      topEvents.filter(
        (
          event
        ) =>
          event.flowType ===
          "EXCHANGE_OUTFLOW"
      );

    const exchangeToExchange =
      topEvents.filter(
        (
          event
        ) =>
          event.flowType ===
          "EXCHANGE_TO_EXCHANGE"
      );

    const walletToWallet =
      topEvents.filter(
        (
          event
        ) =>
          event.flowType ===
          "WALLET_TO_WALLET"
      );

    const mintEvents =
      topEvents.filter(
        (
          event
        ) =>
          event.flowType ===
          "MINT"
      );

    const burnEvents =
      topEvents.filter(
        (
          event
        ) =>
          event.flowType ===
          "BURN"
      );

    const routedEvents =
      topEvents.filter(
        (
          event
        ) =>
          event.routed
      );

    const exchangeInflowUsd =
      exchangeInflows.reduce(
        (
          total,
          event
        ) =>
          total +
          event.usdValue,
        0
      );

    const exchangeOutflowUsd =
      exchangeOutflows.reduce(
        (
          total,
          event
        ) =>
          total +
          event.usdValue,
        0
      );

    /*
     * Positive:
     * more token value left
     * attributed exchanges.
     *
     * Negative:
     * more token value entered
     * attributed exchanges.
     */
    const netExchangeFlowUsd =
      exchangeOutflowUsd -
      exchangeInflowUsd;

    const rawScore =
      topEvents.reduce(
        (
          total,
          event
        ) =>
          total +
          event.score,
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

    let bias:
      | "BULLISH"
      | "BEARISH"
      | "NEUTRAL" =
      "NEUTRAL";

    if (
      whaleScore >=
      8
    ) {
      bias =
        "BULLISH";
    }

    if (
      whaleScore <=
      -8
    ) {
      bias =
        "BEARISH";
    }

    const directionalEvents =
      exchangeInflows.length +
      exchangeOutflows.length;

    const classifiedEvents =
      directionalEvents +
      exchangeToExchange.length;

    const classificationCoveragePercent =
      topEvents.length >
      0
        ? round(
            (
              classifiedEvents /
              topEvents.length
            ) *
              100,
            1
          )
        : 0;

    const meaningfulFlow =
      directionalEvents >=
        1 &&
      Math.abs(
        whaleScore
      ) >=
        8;

    const totalObservedUsd =
      topEvents.reduce(
        (
          total,
          event
        ) =>
          total +
          event.usdValue,
        0
      );

    const rawObservedUsd =
      rawTransfers.reduce(
        (
          total,
          transfer
        ) =>
          total +
          transfer.usdValue,
        0
      );

    const routeAdjustedObservedUsd =
      collapsedTransfers.reduce(
        (
          total,
          transfer
        ) =>
          total +
          transfer.usdValue,
        0
      );

    const routingValueRemovedUsd =
      Math.max(
        0,

        rawObservedUsd -
          routeAdjustedObservedUsd
      );

    const largestTransferUsd =
      topEvents.length >
      0
        ? topEvents[0]
            .usdValue
        : 0;

    const rawTransfersCollapsed =
      Math.max(
        0,

        rawTransfers.length -
          collapsedTransfers.length
      );

    return NextResponse.json({
      success:
        true,

      supported:
        true,

      symbol,

      token: {
        name:
          token.name,

        symbol:
          token.symbol,

        contract:
          token.contract,

        decimals:
          token.decimals,

        network:
          "Ethereum Mainnet",
      },

      market: {
        price:
          round(
            market.price,
            8
          ),

        change24h:
          round(
            market.change24h,
            2
          ),

        quoteVolume24h:
          round(
            market.quoteVolume24h,
            2
          ),
      },

      scanner: {
        fromBlock,

        toBlock:
          latestBlock,

        blocksScanned:
          latestBlock -
          fromBlock +
          1,

        minUsd,

        logsFound:
          logs.length,

        rawQualifyingTransfers:
          rawTransfers.length,

        deduplicatedEvents:
          collapsedTransfers.length,

        rawTransfersCollapsed,

        routedEvents:
          routedEvents.length,

        returnedEvents:
          topEvents.length,

        exchangeWalletsLoaded:
          exchangeWallets.size,

        routeDeduplication:
          true,
      },

      bias,

      whaleScore,

      rawScore:
        round(
          rawScore,
          1
        ),

      meaningfulFlow,

      summary: {
        totalEvents:
          topEvents.length,

        directionalEvents,

        classifiedEvents,

        unclassifiedEvents:
          walletToWallet.length,

        classificationCoveragePercent,

        exchangeInflows:
          exchangeInflows.length,

        exchangeOutflows:
          exchangeOutflows.length,

        exchangeToExchange:
          exchangeToExchange.length,

        walletToWallet:
          walletToWallet.length,

        mints:
          mintEvents.length,

        burns:
          burnEvents.length,

        routedEvents:
          routedEvents.length,

        exchangeInflowUsd:
          round(
            exchangeInflowUsd,
            2
          ),

        exchangeOutflowUsd:
          round(
            exchangeOutflowUsd,
            2
          ),

        netExchangeFlowUsd:
          round(
            netExchangeFlowUsd,
            2
          ),

        /*
         * This is the value used
         * for the actual displayed
         * deduplicated events.
         */
        totalObservedUsd:
          round(
            totalObservedUsd,
            2
          ),

        rawObservedUsd:
          round(
            rawObservedUsd,
            2
          ),

        routeAdjustedObservedUsd:
          round(
            routeAdjustedObservedUsd,
            2
          ),

        routingValueRemovedUsd:
          round(
            routingValueRemovedUsd,
            2
          ),

        largestTransferUsd:
          round(
            largestTransferUsd,
            2
          ),
      },

      interpretation: {
        exchangeInflow:
          "Large token transfers from unknown wallets to attributed exchange wallets may indicate potential selling pressure.",

        exchangeOutflow:
          "Large token transfers from attributed exchange wallets to unknown wallets may indicate potential accumulation or reduced immediate exchange supply.",

        routing:
          "Multiple same-token transfer legs inside one transaction are conservatively collapsed only when the route is unambiguous and the transferred amounts are approximately equal.",

        warning:
          "Exchange flow and wallet routing are market signals, not proof that a whale will buy or sell.",
      },

      events:
        topEvents,

      dataSources: {
        blockchain:
          "Ethereum PublicNode RPC",

        price:
          "Binance Spot",

        exchangeAttribution:
          "Local Coinlytx exchange-wallet attribution dataset",
      },

      updatedAt:
        new Date()
          .toISOString(),
    });
  } catch (
    error
  ) {
    console.error(
      "ERC20 whale scanner error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unable to scan ERC-20 whale activity.",
      },
      {
        status:
          500,
      }
    );
  }
}