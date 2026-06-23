LOCAL_SUSPECTS = {
    "phone_number": {
        "919876543210": {
            "confidence": 90,
            "source": "Local demo suspect list",
            "notes": "Reported in demo data for digital arrest payment threats.",
        },
        "918888777766": {
            "confidence": 82,
            "source": "Local demo suspect list",
            "notes": "Linked to repeated fake KYC messages in demo data.",
        },
    },
    "upi_id": {
        "verifyfast@upi": {
            "confidence": 88,
            "source": "Local demo suspect list",
            "notes": "Demo UPI ID used in fake verification payment requests.",
        },
        "safe-kyc@ybl": {
            "confidence": 84,
            "source": "Local demo suspect list",
            "notes": "Demo UPI ID associated with fake bank account freeze messages.",
        },
    },
    "domain": {
        "kyc-update-alert.in": {
            "confidence": 86,
            "source": "Local demo suspect list",
            "notes": "Demo domain imitating KYC update workflows.",
        },
        "rbi-verify-payment.com": {
            "confidence": 91,
            "source": "Local demo suspect list",
            "notes": "Demo domain impersonating a financial regulator.",
        },
    },
    "email": {
        "support@kyc-update-alert.in": {
            "confidence": 80,
            "source": "Local demo suspect list",
            "notes": "Demo email used in fake KYC support messages.",
        },
        "notice@rbi-verify-payment.com": {
            "confidence": 92,
            "source": "Local demo suspect list",
            "notes": "Demo email impersonating official payment verification.",
        },
    },
}


def check_entity(entity_type: str, value: str) -> dict:
    normalized_value = value.strip().lower()
    if entity_type == "phone_number":
        normalized_value = "".join(char for char in normalized_value if char.isdigit())

    suspect = LOCAL_SUSPECTS.get(entity_type, {}).get(normalized_value)
    if suspect:
        return {
            "is_known_suspect": True,
            "confidence": suspect["confidence"],
            "source": suspect["source"],
            "notes": suspect["notes"],
        }

    return {
        "is_known_suspect": False,
        "confidence": 0,
        "source": "Local demo suspect list",
        "notes": "No local suspect match found.",
    }
