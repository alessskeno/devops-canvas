package translator

import (
    "strings"
)

// SanitizeMemoryForCompose converts Kubernetes-style memory units (e.g. 128Mi, 1Gi)
// to Docker Compose compatible format (e.g. 128M, 1G).
// Docker Compose expects: b, k, m, g (or kb, mb, gb).
// It does NOT support 'Mi', 'Gi' natively in all versions or parser might be strict.
// Based on the error "invalid suffix: 'mi'", it seems pure byte count or standard suffixes are needed.
func SanitizeMemoryForCompose(memory string) string {
    if memory == "" || memory == "0" {
        return ""
    }

    // Lowercase for checking
    lower := strings.ToLower(memory)

    // Handle Mi -> M (128Mi -> 128M)
    // Note: 128Mi (Mebibytes) is technically 128 * 1024 * 1024 bytes.
    // Docker 'M' is Megabytes (10^6) usually, OR it might handle binary prefixes if documented?
    // Docker docs say: "50M", "1G".
    // Usually these are treated as 1024 multipliers in system contexts, but let's just strip 'i'.
    if strings.HasSuffix(lower, "mi") {
        return memory[:len(memory)-2] + "M"
    }
    if strings.HasSuffix(lower, "gi") {
        return memory[:len(memory)-2] + "G"
    }
    if strings.HasSuffix(lower, "ki") {
        return memory[:len(memory)-2] + "k" // docker uses lower k? 'k' or 'kb'
    }

    // If it already ends in M or G (without i), ensure it is upper case if needed?
    // Docker seems to accept M, G, m, g.
    
    // Just returning sanitized string
    return memory
}
