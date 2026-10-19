//! Estimate module — static catalog types.

use serde::Serialize;

/// Id of the system used when a project does not specify one.
pub const DEFAULT_SYSTEM_ID: &str = "fibonacci";

/// One allowed estimate value and its display label.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct EstimateValue {
    pub value: i32,
    pub label: &'static str,
}

/// An estimate system: the allowed values plus display metadata.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct EstimateSystem {
    pub id: &'static str,
    pub label: &'static str,
    pub unit: &'static str,
    pub description: &'static str,
    pub values: &'static [EstimateValue],
}

const fn v(value: i32, label: &'static str) -> EstimateValue {
    EstimateValue { value, label }
}

const FIBONACCI_VALUES: &[EstimateValue] = &[
    v(1, "1"),
    v(2, "2"),
    v(3, "3"),
    v(5, "5"),
    v(8, "8"),
    v(13, "13"),
    v(21, "21"),
];

const LINEAR_VALUES: &[EstimateValue] = &[
    v(1, "1"),
    v(2, "2"),
    v(3, "3"),
    v(4, "4"),
    v(5, "5"),
    v(6, "6"),
    v(7, "7"),
    v(8, "8"),
    v(9, "9"),
    v(10, "10"),
];

const TSHIRT_VALUES: &[EstimateValue] = &[
    v(1, "XS"),
    v(2, "S"),
    v(3, "M"),
    v(5, "L"),
    v(8, "XL"),
];

const HOURS_VALUES: &[EstimateValue] = &[
    v(1, "1h"),
    v(2, "2h"),
    v(3, "3h"),
    v(4, "4h"),
    v(6, "6h"),
    v(8, "8h"),
    v(12, "12h"),
    v(16, "16h"),
    v(24, "24h"),
    v(40, "40h"),
];

/// Every estimate system the API exposes, in display order.
pub const SYSTEMS: &[EstimateSystem] = &[
    EstimateSystem {
        id: "fibonacci",
        label: "Fibonacci",
        unit: "pts",
        description: "Story points on the Fibonacci scale (1 to 21).",
        values: FIBONACCI_VALUES,
    },
    EstimateSystem {
        id: "linear",
        label: "Linear",
        unit: "pts",
        description: "Story points on a linear scale (1 to 10).",
        values: LINEAR_VALUES,
    },
    EstimateSystem {
        id: "tshirt",
        label: "T-shirt",
        unit: "size",
        description: "Relative sizes from XS to XL.",
        values: TSHIRT_VALUES,
    },
    EstimateSystem {
        id: "hours",
        label: "Hours",
        unit: "h",
        description: "Estimated effort in hours (1 to 40).",
        values: HOURS_VALUES,
    },
    EstimateSystem {
        id: "none",
        label: "Disabled",
        unit: "–",
        description: "Estimates are hidden. Existing values can only be cleared.",
        values: &[],
    },
];
