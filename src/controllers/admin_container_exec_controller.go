package controllers

import (
	k8stool "a1ctf/src/utils/k8s_tool"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/remotecommand"
	"k8s.io/kubectl/pkg/scheme"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// TerminalSizeQueue 实现 remotecommand.TerminalSizeQueue 接口
type TerminalSizeQueue struct {
	sizeChan chan remotecommand.TerminalSize
	ctx      context.Context
}

func (t *TerminalSizeQueue) Next() *remotecommand.TerminalSize {
	select {
	case size := <-t.sizeChan:
		return &size
	case <-t.ctx.Done():
		return nil
	case <-time.After(time.Second):
		return nil
	}
}

func newTerminalSizeQueue(ctx context.Context) *TerminalSizeQueue {
	return &TerminalSizeQueue{
		sizeChan: make(chan remotecommand.TerminalSize, 1),
		ctx:      ctx,
	}
}

func AdminHandleContainerExec(c *gin.Context) {
	podName := c.Param("pod_name")
	containerName := c.Param("container_name")

	if podName == "" || containerName == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"code":    400,
			"message": "Invalid pod name or container name",
		})
		return
	}

	ws, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer ws.Close()

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	var writeMu sync.Mutex

	ws.SetCloseHandler(func(code int, text string) error {
		cancel()
		return nil
	})

	// WebSocket 保活
	pingInterval := 25 * time.Second
	go func() {
		ticker := time.NewTicker(pingInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				writeMu.Lock()
				_ = ws.WriteControl(websocket.PingMessage, []byte("ping"), time.Now().Add(5*time.Second))
				writeMu.Unlock()
			}
		}
	}()

	clientset, err := k8stool.GetClient()
	if err != nil {
		sendErrorMessage(ws, &writeMu, fmt.Sprintf("Failed to get k8s client: %v", err))
		return
	}

	req := clientset.CoreV1().RESTClient().Post().
		Resource("pods").
		Name(podName).
		Namespace("a1ctf-challenges").
		SubResource("exec").
		VersionedParams(&metav1.CreateOptions{}, scheme.ParameterCodec)

	req.Param("container", containerName)
	req.Param("stdin", "true")
	req.Param("stdout", "true")
	req.Param("stderr", "true")
	req.Param("tty", "true")
	req.Param("command", "/bin/sh")

	sizeQueue := newTerminalSizeQueue(ctx)

	exec, err := remotecommand.NewSPDYExecutor(k8stool.GetClientConfig(), "POST", req.URL())
	if err != nil {
		sendErrorMessage(ws, &writeMu, fmt.Sprintf("Failed to create executor: %v", err))
		return
	}

	reader := newWebSocketReader(ws, sizeQueue, ctx)
	defer reader.close()

	writer := newWebSocketWriter(ws, &writeMu)

	streamOpts := remotecommand.StreamOptions{
		Stdin:             reader,
		Stdout:            writer,
		Stderr:            writer,
		Tty:               true,
		TerminalSizeQueue: sizeQueue,
	}

	err = exec.StreamWithContext(ctx, streamOpts)
	if err != nil && ctx.Err() == nil { // 只有当错误不是由于上下文取消时才报告
		sendErrorMessage(ws, &writeMu, fmt.Sprintf("Exec stream error: %v", err))
	}
}

// webSocketReader 实现 io.Reader 接口
type webSocketReader struct {
	ws        *websocket.Conn
	sizeQueue *TerminalSizeQueue
	ctx       context.Context
	inputChan chan []byte
	cancel    context.CancelFunc
}

func newWebSocketReader(ws *websocket.Conn, sizeQueue *TerminalSizeQueue, ctx context.Context) *webSocketReader {
	readerCtx, cancel := context.WithCancel(ctx)
	reader := &webSocketReader{
		ws:        ws,
		sizeQueue: sizeQueue,
		ctx:       readerCtx,
		inputChan: make(chan []byte, 1024),
		cancel:    cancel,
	}
	go reader.readLoop()
	return reader
}

func (r *webSocketReader) readLoop() {
	defer close(r.inputChan)

	for {
		select {
		case <-r.ctx.Done():
			return
		default:
			_, message, err := r.ws.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseNormalClosure) {
					log.Printf("WebSocket read error: %v", err)
				}
				return
			}

			// 解析JSON消息
			var msg map[string]interface{}
			if err := json.Unmarshal(message, &msg); err == nil {
				// 处理终端resize
				if op, ok := msg["op"].(string); ok && op == "resize" {
					if cols, ok := msg["cols"].(float64); ok {
						if rows, ok := msg["rows"].(float64); ok {
							size := remotecommand.TerminalSize{
								Width:  uint16(cols),
								Height: uint16(rows),
							}
							select {
							case r.sizeQueue.sizeChan <- size:
							case <-r.ctx.Done():
								return
							case <-time.After(100 * time.Millisecond):
							}
							continue // resize消息不传递给stdin
						}
					}
				}

				// 忽略心跳包
				if op, ok := msg["op"].(string); ok && op == "ping" {
					// 收到心跳，不转发到容器标准输入
					continue
				}

				// 处理输入数据
				if op, ok := msg["op"].(string); ok && op == "input" {
					if data, ok := msg["data"].(string); ok {
						select {
						case r.inputChan <- []byte(data):
						case <-r.ctx.Done():
							return
						}
						continue
					}
				}
			}

			// 普通输入
			select {
			case r.inputChan <- message:
			case <-r.ctx.Done():
				return
			}
		}
	}
}

func (r *webSocketReader) Read(p []byte) (int, error) {
	select {
	case data, ok := <-r.inputChan:
		if !ok {
			return 0, fmt.Errorf("websocket closed")
		}
		return copy(p, data), nil
	case <-r.ctx.Done():
		return 0, r.ctx.Err()
	}
}

func (r *webSocketReader) close() {
	r.cancel()
}

type webSocketWriter struct {
	ws *websocket.Conn
	mu *sync.Mutex
}

func newWebSocketWriter(ws *websocket.Conn, mu *sync.Mutex) *webSocketWriter {
	return &webSocketWriter{ws: ws, mu: mu}
}

func (w *webSocketWriter) Write(p []byte) (int, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	err := w.ws.WriteMessage(websocket.BinaryMessage, p)
	if err != nil {
		return 0, err
	}
	return len(p), nil
}

func sendErrorMessage(ws *websocket.Conn, mu *sync.Mutex, message string) {
	errorMsg := map[string]string{
		"op":   "error",
		"data": message,
	}
	msg, _ := json.Marshal(errorMsg)
	mu.Lock()
	_ = ws.WriteMessage(websocket.TextMessage, msg)
	mu.Unlock()
}
