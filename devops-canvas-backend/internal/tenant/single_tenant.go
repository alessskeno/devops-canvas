package tenant

import (
	"context"
    "log"
)

// SingleTenantProvisioner is for OSS - assumes shared local cluster or Docker
type SingleTenantProvisioner struct {}

func NewSingleTenantProvisioner() *SingleTenantProvisioner {
    return &SingleTenantProvisioner{}
}

func (p *SingleTenantProvisioner) Provision(ctx context.Context, tenantID string) error {
    log.Println("SingleTenant: Provisioning skipped (Using shared context)")
    return nil
}

func (p *SingleTenantProvisioner) GetKubeConfig(ctx context.Context, tenantID string) ([]byte, error) {
    // In OSS, we might just return the local kubeconfig or empty if using in-cluster config
    return nil, nil // Return nil to signal "Use Default/In-Cluster Config"
}

func (p *SingleTenantProvisioner) Deprovision(ctx context.Context, tenantID string) error {
     log.Println("SingleTenant: Deprovisioning skipped")
     return nil
}
