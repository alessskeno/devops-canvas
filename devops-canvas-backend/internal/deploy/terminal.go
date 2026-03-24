package deploy

import (
	"context"
	"fmt"
	"io"
	"strings"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"

	"k8s.io/client-go/tools/remotecommand"
)

// ExecShell attaches to a container shell and streams input/output.
// It blocks until the session ends.
func (s *Service) ExecShell(ctx context.Context, workspaceID, componentID, cmdStr string, in io.Reader, out io.Writer, resizeChan <-chan remotecommand.TerminalSize) error {
	targetServiceName := ""

	// Resolve Component ID to Service Name (same as in compose: default type-id4 or custom ServiceName from component settings)
	canvas, err := s.workspaceRepo.GetCanvas(ctx, workspaceID)
	if err == nil {
		for _, node := range canvas.Nodes {
			if node.ID == componentID {
				targetServiceName = resolveServiceNameForNode(node)
				break
			}
		}
	}

	if targetServiceName == "" {
		return fmt.Errorf("invalid component ID for shell execution")
	}

	fmt.Printf("[ExecShell] Docker Mode. Target: %s\n", targetServiceName)
	return s.execDocker(ctx, workspaceID, targetServiceName, cmdStr, in, out, resizeChan)
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
		Tty:         true,
		ConsoleSize: &[2]uint{24, 80},
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
