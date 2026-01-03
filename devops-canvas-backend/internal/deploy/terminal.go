package deploy

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"strings"

	"github.com/docker/docker/api/types/container"
    "github.com/docker/docker/api/types/filters"
)

// ExecShell attaches to a container shell and streams input/output
// It blocks until the session ends.
func (s *Service) ExecShell(ctx context.Context, workspaceID, componentID, cmdStr string, in io.Reader, out io.Writer) error {
    targetServiceName := ""
    isKind := false
    
    // 1. Resolve Component ID to Service Name / Pod Name
    // Note: We duplicate logic from GetLogs a bit here. 
    // Ideally we extract "FindComponentTarget" to a helper.
    // Check if Kind config exists implies Kind mode? Or use canvas check?
    // Using simple file check for now as per Service.DeployWorkspace
    
    // Actually, let's fetch Canvas to be sure about component mapping
    canvas, err := s.workspaceRepo.GetCanvas(ctx, workspaceID)
    if err == nil {
        for _, node := range canvas.Nodes {
            if node.ID == componentID {
                targetServiceName = fmt.Sprintf("%s-%s", node.Type, node.ID[:4])
                break
            }
        }
    }
    
    // If componentID is "docker-compose" or "kind-cluster", we can't shell into "all".
    // We should pick one? Or fail?
    // For now, fail if no specific component.
    if targetServiceName == "" {
        return fmt.Errorf("invalid component ID for shell execution")
    }

    // Determine Mode via file check (same as GetLogs)
    // Check for Kind Config
    // Actually, `service.go` checks `configs/kind-config.yaml`
    _, err = exec.Command("ls", fmt.Sprintf("/tmp/workspaces/%s/configs/kind-config.yaml", workspaceID)).Output()
    if err == nil {
        isKind = true
    }
    
    if isKind {
        return s.execKind(ctx, workspaceID, targetServiceName, cmdStr, in, out)
    } else {
        return s.execDocker(ctx, workspaceID, targetServiceName, cmdStr, in, out)
    }
}

func (s *Service) execDocker(ctx context.Context, workspaceID, targetServiceName, cmdStr string, in io.Reader, out io.Writer) error {
    if s.dockerClient == nil {
        return fmt.Errorf("docker client not initialized")
    }

    // 1. Find Container ID
    filterArgs := filters.NewArgs()
    filterArgs.Add("label", fmt.Sprintf("com.docker.compose.project=%s", workspaceID))
    
    containers, err := s.dockerClient.ContainerList(ctx, container.ListOptions{Filters: filterArgs})
    if err != nil {
        return fmt.Errorf("list containers failed: %w", err)
    }

    var targetContainerID string
    for _, c := range containers {
        name := ""
        if len(c.Names) > 0 {
            name = c.Names[0] // e.g. /project-service-1
        }
        if strings.Contains(name, targetServiceName) {
            targetContainerID = c.ID
            break
        }
    }

    if targetContainerID == "" {
        return fmt.Errorf("container not found for service %s", targetServiceName)
    }

    // 2. Create Exec
    execConfig := container.ExecOptions{
        Cmd:          []string{cmdStr}, // e.g. "/bin/sh"
        AttachStdin:  true,
        AttachStdout: true,
        AttachStderr: true,
        Tty:          true,
        Env:          []string{"TERM=xterm"},
    }

    execIDResp, err := s.dockerClient.ContainerExecCreate(ctx, targetContainerID, execConfig)
    if err != nil {
        return fmt.Errorf("exec create failed: %w", err)
    }

    // 3. Attach and Stream
    attachConfig := container.ExecStartOptions{
        Tty: true,
        ConsoleSize: &[2]uint{24, 80}, // Optional default
    }
    
    resp, err := s.dockerClient.ContainerExecAttach(ctx, execIDResp.ID, attachConfig)
    if err != nil {
        return fmt.Errorf("exec attach failed: %w", err)
    }
    defer resp.Close()

    // Stream IO
    // resp.Conn is the raw connection usually, or Reader/Writer
    // If Tty=true, we get raw stream. If false, we get multiplexed stream.
    // We used Tty=true.
    
    outputDone := make(chan error)
    go func() {
        _, err := io.Copy(out, resp.Reader)
        outputDone <- err
    }()
    
    go func() {
        io.Copy(resp.Conn, in)
    }()

    select {
    case err := <-outputDone:
        return err
    case <-ctx.Done():
        return ctx.Err()
    }
}

func (s *Service) execKind(ctx context.Context, workspaceID, targetServiceName, cmdStr string, in io.Reader, out io.Writer) error {
    namespace := fmt.Sprintf("ws-%s", workspaceID)
    // contextName := fmt.Sprintf("kind-ws-%s", workspaceID) // We can pass context via kubectl flags
    
    // 1. Find Pod
    // kubectl get pods -n ns -o name | grep targetServiceName
    // This is a bit rough, but suffices for MVP.
    // targetServiceName matches part of the pod name.
    
    podListCmd := exec.CommandContext(ctx, "kubectl", "get", "pods", 
        "-n", namespace, 
        "--context", fmt.Sprintf("kind-ws-%s", workspaceID),
        "-o", "jsonpath={.items[*].metadata.name}")
        
    output, err := podListCmd.Output()
    if err != nil {
        return fmt.Errorf("failed to list pods: %w", err)
    }
    
    pods := strings.Fields(string(output))
    var targetPod string
    for _, p := range pods {
        if strings.Contains(p, targetServiceName) {
            targetPod = p
            break
        }
    }
    
    if targetPod == "" {
        return fmt.Errorf("pod not found for %s", targetServiceName)
    }

    // 2. Exec via kubectl
    // "kubectl exec -it POD -n NS -- /bin/sh"
    // exec.Command connects Stdin/Stdout directly
    
    kubectlCmd := exec.CommandContext(ctx, "kubectl", "exec", 
        "-i", // Interactive but maybe not Tty (-t) if we rely on xterm to handle formatting? 
               // Actually for TTY behavior we usually want -t.
               // However, Go's exec.Command with passed Stdin/Stdout might not handle TTY PTY allocation easily without `creack/pty` or similar.
               // Docker Exec API handles it internally. Kubectl CLI handles it if run in a terminal.
               // Since we are piping IO, `kubectl` might complain "stdin is not a terminal".
               // But let's try `-i`.
        "-n", namespace,
        "--context", fmt.Sprintf("kind-ws-%s", workspaceID),
        targetPod,
        "--",
        cmdStr,
    )
    
    kubectlCmd.Stdin = in
    kubectlCmd.Stdout = out
    kubectlCmd.Stderr = out // Merge stderr
    
    return kubectlCmd.Run()
}
