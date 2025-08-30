import { Dispatch, SetStateAction, useEffect, useRef } from "react"
import {
    Dialog,
    DialogContent,
} from "components/ui/dialog"
import { TerminalSquare } from "lucide-react"
import { cn } from "lib/utils"
import { useXTerm } from 'react-xtermjs'
import { FitAddon } from '@xterm/addon-fit'

export default function ContainerTerminal(
    {
        podName,
        containerName,
        className = "",
        isOpen,
        setIsOpen,
        setTerminalPod,
        setTerminalContainer
    }: {
        podName: string,
        containerName: string,
        className?: string,
        isOpen: boolean,
        setIsOpen: Dispatch<SetStateAction<boolean>>,
        setTerminalPod: Dispatch<SetStateAction<string | null>>,
        setTerminalContainer: Dispatch<SetStateAction<string | null>>,
    }
) {

    const MyTerminal = () => {
        const { instance, ref } = useXTerm()
        const wsRef = useRef<WebSocket | null>(null)
        const pingTimerRef = useRef<number | null>(null)
        const reconnectTimerRef = useRef<number | null>(null)
        const dataHandlerBoundRef = useRef<boolean>(false)
        const decoderRef = useRef(new TextDecoder())
        const fitAddon = new FitAddon()

        useEffect(() => {
            if (!instance) return;
            if (!podName || !containerName) return;

            const clearTimers = () => {
                if (pingTimerRef.current) {
                    window.clearInterval(pingTimerRef.current)
                    pingTimerRef.current = null
                }
                if (reconnectTimerRef.current) {
                    window.clearTimeout(reconnectTimerRef.current)
                    reconnectTimerRef.current = null
                }
            }

            const setupDataHandlersOnce = () => {
                if (dataHandlerBoundRef.current) return
                dataHandlerBoundRef.current = true
                instance.onData((data: any) => {
                    const s = wsRef.current
                    if (s && s.readyState === WebSocket.OPEN) {
                        s.send(JSON.stringify({ op: 'input', data }))
                    }
                })
                instance.onResize(({ cols, rows }: { cols: number, rows: number }) => {
                    const s = wsRef.current
                    if (s && s.readyState === WebSocket.OPEN) {
                        s.send(JSON.stringify({ op: 'resize', cols, rows }))
                    }
                })
            }

            instance.writeln("Connecting....")

            const https_enabled = window.location.protocol == "https:"
            const baseURL = window.location.host
            const socket = new WebSocket((`${https_enabled ? "wss" : "ws"}://${baseURL}/api/pod/${podName}/${containerName}/exec`))
            socket.binaryType = 'arraybuffer'
            wsRef.current = socket

            socket.onopen = () => {
                instance.writeln("\r\nConnected!\r\n")

                setupDataHandlersOnce()

                // 初始上报终端尺寸
                const cols = (instance as any)?.cols
                const rows = (instance as any)?.rows
                socket.send(JSON.stringify({ op: 'resize', cols, rows }))

                // 客户端保活心跳：每 20s 发送一次
                if (!pingTimerRef.current) {
                    pingTimerRef.current = window.setInterval(() => {
                        const s = wsRef.current
                        if (s && s.readyState === WebSocket.OPEN) {
                            s.send(JSON.stringify({ op: 'ping', t: Date.now() }))
                        }
                    }, 20000)
                }
            }

            socket.onmessage = (event) => {
                if (event.data instanceof ArrayBuffer) {
                    const text = decoderRef.current.decode(new Uint8Array(event.data))
                    instance.write(text)
                    return
                }

                // 兼容 Blob
                if (event.data instanceof Blob) {
                    const reader = new FileReader();
                    reader.onload = () => {
                        instance.write(reader.result as string);
                    };
                    reader.readAsText(event.data);
                    return
                }

                // 字符串消息
                if (typeof event.data === 'string') {
                    try {
                        const msg = JSON.parse(event.data);
                        if (msg.op === 'error') {
                            instance.write(`\r\nError: ${msg.data}\r\n`);
                            return;
                        }
                    } catch { /* noop */ }
                    instance.write(event.data);
                    return
                }

                // 兜底
                try {
                    instance.write(String(event.data))
                } catch { /* noop */ }
            }

            socket.onclose = (_error) => {
                instance.write('\r\nConnection closed\r\n');
                clearTimers()
            }

            socket.onerror = (_error) => {
                instance.write(`\r\nWebSocket error\r\n`);
            }

            instance.loadAddon(fitAddon)
            fitAddon.fit()

            const handleResize = () => fitAddon.fit()
            window.addEventListener('resize', handleResize)

            return () => {
                clearTimers()
                window.removeEventListener('resize', handleResize)
                try {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                        // 先发送 exit 命令
                        wsRef.current.send(JSON.stringify({ op: 'exit' }))
                    }
                } catch { /* ignore */ }

                // 稍微延迟一下再关闭，确保 exit 已经发出去
                setTimeout(() => {
                    try { wsRef.current?.close() } catch { /* noop */ }
                }, 200)
            }
        }, [instance, podName, containerName, isOpen])

        return <div ref={ref as any} style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1e1e1e',
            padding: "10px",
            borderRadius: "5px",
        }} />
    }

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(e) => {
                if (e == false) {
                    setTerminalPod(null);
                    setTerminalContainer(null);
                }
                setIsOpen(false)
            }}
        >
            <DialogContent className={cn("w-[80vw]! h-[80vh]! max-w-none!", className)}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                aria-describedby={undefined}
            >
                <div className="w-full h-full flex flex-col gap-4">
                    <div className="flex gap-4 items-center w-full">
                        <TerminalSquare />
                        <span>Terminal {podName} / {containerName}</span>
                    </div>
                    {isOpen ? <MyTerminal /> : <></>}
                </div>
            </DialogContent>
        </Dialog>
    )
}