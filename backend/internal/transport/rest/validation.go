package rest

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/bayesmarket/bayesmarket/internal/amm"
	"github.com/shopspring/decimal"
)

// ParseOutcome validates and normalizes an outcome string to amm.Outcome ("YES" | "NO").
func ParseOutcome(raw string) (amm.Outcome, *AppError) {
	trimmed := strings.ToUpper(strings.TrimSpace(raw))
	if trimmed != string(amm.OutcomeYES) && trimmed != string(amm.OutcomeNO) {
		return "", &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "invalid_outcome",
			Message:    "Outcome must be 'YES' or 'NO'",
		}
	}
	return amm.Outcome(trimmed), nil
}

// ParsePositiveDecimal parses a string into a strictly positive decimal.Decimal.
func ParsePositiveDecimal(raw string, fieldName string) (decimal.Decimal, *AppError) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return decimal.Zero, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "invalid_" + fieldName,
			Message:    fmt.Sprintf("%s is required", fieldName),
		}
	}

	val, err := decimal.NewFromString(trimmed)
	if err != nil || val.LessThanOrEqual(decimal.Zero) {
		return decimal.Zero, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "invalid_" + fieldName,
			Message:    fmt.Sprintf("%s must be a positive decimal string", fieldName),
		}
	}
	return val, nil
}

// ParseSlippagePct parses a slippage percentage string or returns the default value.
func ParseSlippagePct(raw string, defaultPct decimal.Decimal) (decimal.Decimal, *AppError) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return defaultPct, nil
	}

	val, err := decimal.NewFromString(trimmed)
	if err != nil || val.IsNegative() {
		return decimal.Zero, &AppError{
			StatusCode: http.StatusBadRequest,
			ErrorCode:  "invalid_slippage",
			Message:    "max_slippage_pct must be non-negative",
		}
	}
	return val, nil
}
