package translator

import (
	"strconv"
)

// defaultPort safely parses an unknown port value from JSON into an integer, using a fallback.
func defaultPort(val any, def int) int {
	if val == nil {
		return def
	}
	switch v := val.(type) {
	case float64:
		return int(v)
	case int:
		return v
	case string:
		if p, err := strconv.Atoi(v); err == nil {
			return p
		}
	}
	return def
}
