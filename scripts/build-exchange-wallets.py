import csv
import json
from pathlib import Path

SOURCE_DIR = Path(
    r"C:\Users\kajal\wallet-attribution-source\data"
)

PROJECT_DIR = Path(
    r"C:\Users\kajal\coinlytx"
)

OUTPUT_DIR = (
    PROJECT_DIR
    / "lib"
    / "trading"
    / "data"
)

OUTPUT_FILE = (
    OUTPUT_DIR
    / "exchange-wallets.json"
)

NETWORK_FILES = {
    "ethereum": "ethereum.csv",
    "bitcoin": "bitcoin.csv",
}

NETWORK_NAMES = {
    "ethereum": "ETH",
    "bitcoin": "BTC",
}


def normalize_address(
    address: str,
    network: str,
) -> str:
    address = (
        address
        .strip()
    )

    if network == "ethereum":
        return address.lower()

    return address


def clean_text(
    value: str | None
) -> str:
    if value is None:
        return ""

    return value.strip()


def load_exchange_wallets():
    wallets = {
        "ethereum": {},
        "bitcoin": {},
    }

    stats = {
        "ethereum": {
            "total": 0,
            "highConfidence": 0,
            "mediumConfidence": 0,
            "entities": {},
        },
        "bitcoin": {
            "total": 0,
            "highConfidence": 0,
            "mediumConfidence": 0,
            "entities": {},
        },
    }

    for (
        network,
        filename,
    ) in NETWORK_FILES.items():

        source_file = (
            SOURCE_DIR
            / filename
        )

        if not source_file.exists():
            print(
                f"WARNING: Missing {source_file}"
            )
            continue

        print(
            f"Reading {source_file}..."
        )

        with source_file.open(
            "r",
            encoding="utf-8-sig",
            newline="",
        ) as file:

            reader = csv.DictReader(
                file
            )

            for row in reader:
                category = (
                    clean_text(
                        row.get(
                            "category"
                        )
                    )
                    .lower()
                )

                if (
                    category
                    != "exchange"
                ):
                    continue

                raw_address = (
                    clean_text(
                        row.get(
                            "address"
                        )
                    )
                )

                if not raw_address:
                    continue

                address = (
                    normalize_address(
                        raw_address,
                        network,
                    )
                )

                entity = (
                    clean_text(
                        row.get(
                            "entity"
                        )
                    )
                    or "Unknown Exchange"
                )

                label = (
                    clean_text(
                        row.get(
                            "label"
                        )
                    )
                    or entity
                )

                confidence = (
                    clean_text(
                        row.get(
                            "confidence"
                        )
                    )
                    .lower()
                    or "medium"
                )

                source = (
                    clean_text(
                        row.get(
                            "source"
                        )
                    )
                )

                source_url = (
                    clean_text(
                        row.get(
                            "source_url"
                        )
                    )
                )

                last_updated = (
                    clean_text(
                        row.get(
                            "last_updated"
                        )
                    )
                )

                wallets[
                    network
                ][address] = {
                    "entity": entity,
                    "label": label,
                    "confidence": confidence,
                    "source": source,
                    "sourceUrl": source_url,
                    "lastUpdated": last_updated,
                }

    for (
        network,
        network_wallets,
    ) in wallets.items():

        entity_counts = {}

        high_confidence = 0
        medium_confidence = 0

        for wallet in (
            network_wallets
            .values()
        ):
            entity = wallet[
                "entity"
            ]

            entity_counts[
                entity
            ] = (
                entity_counts
                .get(
                    entity,
                    0,
                )
                + 1
            )

            confidence = (
                wallet[
                    "confidence"
                ]
            )

            if (
                confidence
                == "high"
            ):
                high_confidence += 1
            else:
                medium_confidence += 1

        stats[
            network
        ] = {
            "total": len(
                network_wallets
            ),
            "highConfidence":
                high_confidence,
            "mediumConfidence":
                medium_confidence,
            "entities":
                dict(
                    sorted(
                        entity_counts.items(),
                        key=lambda item:
                            item[1],
                        reverse=True,
                    )
                ),
        }

    return wallets, stats


def main():
    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    (
        wallets,
        stats,
    ) = load_exchange_wallets()

    output = {
        "generatedAt":
            __import__(
                "datetime"
            )
            .datetime
            .now(
                __import__(
                    "datetime"
                )
                .timezone.utc
            )
            .isoformat(),

        "networks": {
            "ethereum": {
                "symbol": "ETH",
                "walletCount":
                    len(
                        wallets[
                            "ethereum"
                        ]
                    ),
                "wallets":
                    wallets[
                        "ethereum"
                    ],
            },

            "bitcoin": {
                "symbol": "BTC",
                "walletCount":
                    len(
                        wallets[
                            "bitcoin"
                        ]
                    ),
                "wallets":
                    wallets[
                        "bitcoin"
                    ],
            },
        },

        "stats": stats,
    }

    with OUTPUT_FILE.open(
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            output,
            file,
            ensure_ascii=False,
            separators=(
                ",",
                ":",
            ),
        )

    print()
    print(
        "================================"
    )
    print(
        "Coinlytx exchange wallet database"
    )
    print(
        "================================"
    )

    print(
        "Ethereum exchange wallets:",
        len(
            wallets[
                "ethereum"
            ]
        ),
    )

    print(
        "Bitcoin exchange wallets:",
        len(
            wallets[
                "bitcoin"
            ]
        ),
    )

    print()

    print(
        "Output:",
        OUTPUT_FILE,
    )

    print()

    print(
        "Top Ethereum exchanges:"
    )

    eth_entities = (
        list(
            stats[
                "ethereum"
            ][
                "entities"
            ].items()
        )[:15]
    )

    for (
        entity,
        count,
    ) in eth_entities:
        print(
            f"  {entity}: {count}"
        )

    print()

    print(
        "Top Bitcoin exchanges:"
    )

    btc_entities = (
        list(
            stats[
                "bitcoin"
            ][
                "entities"
            ].items()
        )[:15]
    )

    for (
        entity,
        count,
    ) in btc_entities:
        print(
            f"  {entity}: {count}"
        )


if __name__ == "__main__":
    main()