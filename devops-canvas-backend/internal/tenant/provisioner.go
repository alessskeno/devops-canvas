package tenant

import (
	"context"
)

// TenantProvisioner defines how a tenant's infrastructure is managed
type TenantProvisioner interface {
    // Provision ensures the tenant has a working namespace/cluster
    Provision(ctx context.Context, tenantID string) error
    
    // GetKubeConfig returns the kubeconfig for the tenant's isolated cluster
    GetKubeConfig(ctx context.Context, tenantID string) ([]byte, error)
    
    // Deprovision removes the tenant's resources (for TTL enforcement)
    Deprovision(ctx context.Context, tenantID string) error
}
