package main

import (
	"fmt"
	"gopkg.in/yaml.v3"
)

var input = `kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
name: dev-cluster
nodes:
- role: control-plane
  image: kindest/node:v1.35.0
  kubeadmConfigPatches:
  - |
    kind: InitConfiguration
    nodeRegistration:
      kubeletExtraArgs:
        node-labels: "ingress-ready=true"
  extraPortMappings:
  - containerPort: 80
    hostPort: 80
    protocol: TCP
  - containerPort: 443
    hostPort: 443
    protocol: TCP`

func main() {
	var out map[string]interface{}
	err := yaml.Unmarshal([]byte(input), &out)
	if err != nil {
		fmt.Printf("Error: %v\n", err)
	} else {
		fmt.Println("Success")
	}
}
