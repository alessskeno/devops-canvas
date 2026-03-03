package deploy

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/docker/docker/api/types/container"
    "github.com/docker/docker/api/types/filters"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    
    "path/filepath"
    "os"

    corev1 "k8s.io/api/core/v1"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/tools/clientcmd"
    "k8s.io/client-go/tools/remotecommand"
    "k8s.io/kubectl/pkg/scheme"
)

// ExecShell attaches to a container shell and streams input/output
// It blocks until the session ends.
func (s *Service) ExecShell(ctx context.Context, workspaceID, componentID, cmdStr string, in io.Reader, out io.Writer, resizeChan <-chan remotecommand.TerminalSize) error {
    targetServiceName := ""
    isKind := false
    
    // ... (rest of logic same until we call exec functions)
    
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

    // Special Handling: Kind Control Plane Shell
    if strings.HasPrefix(targetServiceName, "kind-cluster-") {
         fmt.Printf("[ExecShell] Detected Kind Control Plane request. Target: %s\n", targetServiceName)
         controlPlaneContainer := fmt.Sprintf("ws-%s-control-plane", workspaceID)
         return s.execContainerDirect(ctx, controlPlaneContainer, cmdStr, in, out, resizeChan)
    }

    // Determine Mode via file checks (same as GetLogs)
    configPath := fmt.Sprintf("/tmp/workspaces/%s/configs/kind-config.yaml", workspaceID)
    internalKubeMsg := fmt.Sprintf("/tmp/workspaces/%s/kubeconfig.internal", workspaceID)
    chartPath := fmt.Sprintf("/tmp/workspaces/%s/Chart.yaml", workspaceID)

    if _, err := os.Stat(configPath); err == nil {
        fmt.Printf("[ExecShell] Found Kind config at %s\n", configPath)
        isKind = true
    } else {
        fmt.Printf("[ExecShell] No Kind config at %s: %v\n", configPath, err)
    }
    
    if !isKind {
        if _, err := os.Stat(internalKubeMsg); err == nil {
            fmt.Printf("[ExecShell] Found Internal Kubeconfig at %s\n", internalKubeMsg)
            isKind = true
        } else {
             fmt.Printf("[ExecShell] No Internal Kubeconfig at %s: %v\n", internalKubeMsg, err)
        }
    }
    
    if !isKind {
        if _, err := os.Stat(chartPath); err == nil {
             fmt.Printf("[ExecShell] Found Chart.yaml at %s\n", chartPath)
            isKind = true
        } else {
             fmt.Printf("[ExecShell] No Chart.yaml at %s: %v\n", chartPath, err)
        }
    }
    
    if isKind {
        fmt.Printf("[ExecShell] Detected Kind Mode. using execKind.\n")
        return s.execKind(ctx, workspaceID, targetServiceName, cmdStr, in, out, resizeChan)
    } else {
        fmt.Printf("[ExecShell] Detected Docker Mode. using execDocker.\n")
        return s.execDocker(ctx, workspaceID, targetServiceName, cmdStr, in, out, resizeChan)
    }
}

// execContainerDirect attaches to a specific docker container by name (bypassing project filters)
func (s *Service) execContainerDirect(ctx context.Context, containerName, cmdStr string, in io.Reader, out io.Writer, resizeChan <-chan remotecommand.TerminalSize) error {
    if s.dockerClient == nil {
        return fmt.Errorf("docker client not initialized")
    }

    // 1. Inspect container to get ID
    c, err := s.dockerClient.ContainerInspect(ctx, containerName)
    if err != nil {
        return fmt.Errorf("failed to find container %s: %w", containerName, err)
    }
    
    if !c.State.Running {
         return fmt.Errorf("container %s is not running", containerName)
    }

    // 2. Create Exec
    execConfig := container.ExecOptions{
        Cmd:          []string{cmdStr},
        AttachStdin:  true,
        AttachStdout: true,
        AttachStderr: true,
        Tty:          true,
        Env:          []string{"TERM=xterm", "KUBECONFIG=/etc/kubernetes/admin.conf"},
    }
    
    // Default to bash if available, or sh
    if cmdStr == "" {
        execConfig.Cmd = []string{"/bin/sh"}
    }

    execIDResp, err := s.dockerClient.ContainerExecCreate(ctx, c.ID, execConfig)
    if err != nil {
        return fmt.Errorf("exec create failed: %w", err)
    }

    // 3. Attach and Stream
    attachConfig := container.ExecStartOptions{
        Tty: true,
    }
    
    resp, err := s.dockerClient.ContainerExecAttach(ctx, execIDResp.ID, attachConfig)
    if err != nil {
        return fmt.Errorf("exec attach failed: %w", err)
    }
    defer resp.Close()
    
    // Handle Resizing
    if resizeChan != nil {
        go func() {
            for size := range resizeChan {
                err := s.dockerClient.ContainerExecResize(ctx, execIDResp.ID, container.ResizeOptions{
                    Height: uint(size.Height),
                    Width:  uint(size.Width),
                })
                if err != nil {
                    fmt.Printf("Resize error: %v\n", err)
                }
            }
        }()
    }
    
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

func (s *Service) execDocker(ctx context.Context, workspaceID, targetServiceName, cmdStr string, in io.Reader, out io.Writer, resizeChan <-chan remotecommand.TerminalSize) error {
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

    // Handle Resizing
    if resizeChan != nil {
        go func() {
            for size := range resizeChan {
                s.dockerClient.ContainerExecResize(ctx, execIDResp.ID, container.ResizeOptions{
                    Height: uint(size.Height),
                    Width:  uint(size.Width),
                })
            }
        }()
    }

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


// ... existing ExecShell ...

// Queue to bridge channel to remotecommand interface
type channelSizeQueue struct {
    resizeChan <-chan remotecommand.TerminalSize
}

func (q *channelSizeQueue) Next() *remotecommand.TerminalSize {
    size, ok := <-q.resizeChan
    if !ok {
        return nil
    }
    return &size
}

func (s *Service) execKind(ctx context.Context, workspaceID, targetServiceName, cmdStr string, in io.Reader, out io.Writer, resizeChan <-chan remotecommand.TerminalSize) error {
    namespace := fmt.Sprintf("ws-%s", workspaceID)
    
    // ... (rest of logic same until executor.Stream)
    
    // 1. Get Rest Config
    // We try to load from the default location which is updated by 'kind export'
    // If running in-cluster (SaaS), InClusterConfig should work if we have RBAC.
    // For OSS (Kind), we rely on ~/.kube/config.
    
    kubeConfigPath := filepath.Join(os.Getenv("HOME"), ".kube", "config")
    
    // Check if internal kubeconfig exists (created by DeployKubernetes)
    // This is safer if multiple workspaces exist or we want specificity
    internalPath := fmt.Sprintf("/tmp/workspaces/%s/kubeconfig.internal", workspaceID)
    if _, err := os.Stat(internalPath); err == nil {
        kubeConfigPath = internalPath
    }

    config, err := clientcmd.BuildConfigFromFlags("", kubeConfigPath)
    if err != nil {
        // Fallback to in-cluster or default
        config, err = clientcmd.BuildConfigFromFlags("", "")
        if err != nil {
            return fmt.Errorf("failed to build kube config: %w", err)
        }
    }

    // 2. Create Client
    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        return fmt.Errorf("failed to create k8s client: %w", err)
    }

    // 3. Find Pod
    // List pods in namespace to find matching one
    pods, err := clientset.CoreV1().Pods(namespace).List(ctx, metav1.ListOptions{})
    if err != nil {
        return fmt.Errorf("failed to list pods in %s: %w", namespace, err)
    }

    var podName string
    for _, p := range pods.Items {
        if strings.Contains(p.Name, targetServiceName) {
            // Pick the first running one ideally
            if p.Status.Phase == corev1.PodRunning {
                podName = p.Name
                break
            }
            // Fallback to just name match
            if podName == "" {
                podName = p.Name
            }
        }
    }

    if podName == "" {
        return fmt.Errorf("pod not found for service %s in namespace %s", targetServiceName, namespace)
    }

    // 4. Prepare Exec Request
    req := clientset.CoreV1().RESTClient().Post().
        Resource("pods").
        Name(podName).
        Namespace(namespace).
        SubResource("exec")
        
    option := &corev1.PodExecOptions{
        Command: []string{cmdStr},
        Stdin:   true,
        Stdout:  true,
        Stderr:  true,
        TTY:     true,
    }
    
    // If cmdStr is empty, default to /bin/sh (though usually caller provides it)
    if cmdStr == "" {
        option.Command = []string{"/bin/sh"}
    }

    req.VersionedParams(option, scheme.ParameterCodec)

    // 5. Execute SPDY Stream
    executor, err := remotecommand.NewSPDYExecutor(config, "POST", req.URL())
    if err != nil {
        return fmt.Errorf("failed to init executor: %w", err)
    }

    // Stream
    streamOptions := remotecommand.StreamOptions{
        Stdin:  in,
        Stdout: out,
        Stderr: out,
        Tty:    true,
    }
    
    if resizeChan != nil {
        streamOptions.TerminalSizeQueue = &channelSizeQueue{resizeChan: resizeChan}
    }

    err = executor.StreamWithContext(ctx, streamOptions)
    
    return err
}
