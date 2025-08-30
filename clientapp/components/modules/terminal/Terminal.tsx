// ContainerTerminal.tsx
import React, {
    Dispatch,
    SetStateAction,
    useEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { Rnd } from "react-rnd";
import { TerminalSquare, Minus, Maximize2, X } from "lucide-react";
import { cn } from "lib/utils";
import { useXTerm } from "react-xtermjs";
import { FitAddon } from "@xterm/addon-fit";

type Props = {
    podName: string;
    containerName: string;
    isOpen: boolean;
    setIsOpen: Dispatch<SetStateAction<boolean>>;
    setTerminalPod: Dispatch<SetStateAction<string | null>>;
    setTerminalContainer: Dispatch<SetStateAction<string | null>>;
};

function MyTerminal({
    podName,
    containerName,
    fitRef,
    wsRef,
}: {
    podName: string;
    containerName: string;
    fitRef: React.MutableRefObject<FitAddon>;
    wsRef: React.MutableRefObject<WebSocket | null>;
}) {
    const { instance, ref } = useXTerm();
    const pingTimerRef = useRef<number | null>(null);
    const dataHandlerBoundRef = useRef<boolean>(false);
    const decoderRef = useRef(new TextDecoder());
    useEffect(() => {
        if (!instance || !podName || !containerName) return;

        const fitAddon = fitRef.current!;
        instance.loadAddon(fitAddon);
        setTimeout(() => fitAddon.fit(), 1000);

        const clearTimers = () => {
            if (pingTimerRef.current) {
                window.clearInterval(pingTimerRef.current);
                pingTimerRef.current = null;
            }
        };

        const setupDataHandlersOnce = () => {
            if (dataHandlerBoundRef.current) return;
            dataHandlerBoundRef.current = true;

            instance.onData((data: string) => {
                const s = wsRef.current;
                if (s && s.readyState === WebSocket.OPEN) {
                    s.send(JSON.stringify({ op: "input", data }));
                }
            });

            instance.onResize(({ cols, rows }) => {
                const s = wsRef.current;
                if (s && s.readyState === WebSocket.OPEN) {
                    s.send(JSON.stringify({ op: "resize", cols, rows }));
                }
            });
        };

        instance.writeln("Connecting....");

        const https_enabled = window.location.protocol === "https:";
        const baseURL = window.location.host;
        const socket = new WebSocket(
            `${https_enabled ? "wss" : "ws"}://${baseURL}/api/pod/${podName}/${containerName}/exec`
        );
        socket.binaryType = "arraybuffer";
        wsRef.current = socket;

        socket.onopen = () => {
            instance.writeln("\r\nConnected!\r\n");
            setupDataHandlersOnce();
            const cols = (instance as any)?.cols;
            const rows = (instance as any)?.rows;
            if (cols && rows) {
                socket.send(JSON.stringify({ op: "resize", cols, rows }));
            }

            if (!pingTimerRef.current) {
                pingTimerRef.current = window.setInterval(() => {
                    const s = wsRef.current;
                    if (s && s.readyState === WebSocket.OPEN) {
                        s.send(JSON.stringify({ op: "ping", t: Date.now() }));
                    }
                }, 20000);
            }
        };

        socket.onmessage = (event) => {
            if (event.data instanceof ArrayBuffer) {
                const text = decoderRef.current.decode(new Uint8Array(event.data));
                instance.write(text);
                return;
            }
            if (event.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => instance.write(reader.result as string);
                reader.readAsText(event.data);
                return;
            }
            if (typeof event.data === "string") {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.op === "error") {
                        instance.write(`\r\nError: ${msg.data}\r\n`);
                        return;
                    }
                } catch {
                    // noop
                }
                instance.write(event.data);
                return;
            }
            try {
                instance.write(String(event.data));
            } catch { }
        };

        socket.onclose = () => {
            instance.write("\r\nConnection closed\r\n");
            clearTimers();
        };
        socket.onerror = () => {
            instance.write("\r\nWebSocket error\r\n");
        };

        const handleWindowResize = () => fitAddon.fit();
        window.addEventListener("resize", handleWindowResize);

        return () => {
            clearTimers();
            window.removeEventListener("resize", handleWindowResize);
            try {
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({ op: "exit" }));
                }
            } catch { }
            setTimeout(() => wsRef.current?.close(), 200);
        };
    }, [instance, podName, containerName, fitRef, wsRef]);

    return (
        <div
            ref={ref as any}
            className="w-full h-full bg-[#0f1720] p-2 rounded-b-md text-white"
            style={{ width: '100%', height: '100%', minHeight: 120 }}
        />
    );
}

export default function ContainerTerminal({
    podName,
    containerName,
    isOpen,
    setIsOpen,
    setTerminalPod,
    setTerminalContainer,
}: Props) {
    const [minimized, setMinimized] = useState(false);
    const [maximized, setMaximized] = useState(false);

    const initialW = Math.min(Math.round(window.innerWidth * 0.75), 1100);
    const initialH = Math.min(Math.round(window.innerHeight * 0.72), 720);
    const initialX = Math.round((window.innerWidth - initialW) / 2);
    const initialY = Math.round((window.innerHeight - initialH) / 2);

    const [pos, setPos] = useState({ x: initialX, y: initialY });
    const [size, setSize] = useState({ width: initialW, height: initialH });
    const lastBoundsRef = useRef({ x: initialX, y: initialY, width: initialW, height: initialH });

    const fitRef = useRef<FitAddon>(new FitAddon());
    const rndRef = useRef<any>(null);
    const wsRef = useRef<WebSocket | null>(null);

    if (!isOpen) return null;

    const portalRoot = typeof document !== "undefined" ? document.body : null;

    const onDragStop = (_: any, d: { x: number; y: number }) => {
        setPos({ x: d.x, y: d.y });
        lastBoundsRef.current = { ...lastBoundsRef.current, x: d.x, y: d.y };
    };

    const onResizeStop = (
        _event: MouseEvent | TouchEvent | PointerEvent,
        _direction: any,
        ref: HTMLElement,
        _delta: any,
        position: { x: number; y: number }
    ) => {
        const w = ref.offsetWidth;
        const h = ref.offsetHeight;
        setSize({ width: w, height: h });
        setPos({ x: position.x, y: position.y });
        lastBoundsRef.current = { x: position.x, y: position.y, width: w, height: h };

        // fit terminal 并发送 resize
        setTimeout(() => {
            const fitAddon = fitRef.current;
            fitAddon?.fit();
            // 用 xterm 本身实例获取 cols/rows
            const term: any = (fitAddon as any)._terminal;
            if (term && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ op: 'resize', cols: term.cols, rows: term.rows }));
            }
        }, 150);
    };

    const handleMinimize = () => setMinimized(true);
    const handleRestoreFromMin = () => {
        setMinimized(false);
        setTimeout(() => fitRef.current?.fit(), 50);
    };

    const handleToggleMaximize = () => {
        if (!maximized) {
            lastBoundsRef.current = { ...lastBoundsRef.current, x: pos.x, y: pos.y, width: size.width, height: size.height };
            setPos({ x: 0, y: 0 });
            setSize({ width: window.innerWidth, height: window.innerHeight });
            setMaximized(true);
            setTimeout(() => fitRef.current?.fit(), 50);
        } else {
            const last = lastBoundsRef.current;
            setPos({ x: last.x, y: last.y });
            setSize({ width: last.width, height: last.height });
            setMaximized(false);
            setTimeout(() => fitRef.current?.fit(), 50);
        }
    };

    const handleClose = () => {
        setTerminalPod(null);
        setTerminalContainer(null);
        setIsOpen(false);
    };

    const rndNode = (
        <Rnd
            ref={rndRef}
            position={{ x: pos.x, y: pos.y }}
            size={{ width: size.width, height: size.height }}
            bounds="window"
            onDragStop={onDragStop}
            onResizeStop={onResizeStop}
            enableResizing={!maximized}
            disableDragging={maximized}
            className={cn(
                "shadow-2xl rounded-lg flex flex-col border overflow-hidden",
                "bg-white text-black dark:bg-[#0b1220] dark:text-white",
                "z-[9999]"
            )}
            style={{
                display: minimized ? "none" : "block",
                position: "fixed",
            }}
        >
            {/* 标题栏 */}
            <div className="flex justify-between items-center px-3 py-2 border-b cursor-move bg-gray-100 dark:bg-[#0f1720] rounded-t-md select-none">
                <div className="flex items-center gap-2">
                    <TerminalSquare className="w-4 h-4" />
                    <span className="text-sm font-medium">
                        [Terminal] {podName} / {containerName}
                    </span>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleMinimize} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                        <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={handleToggleMaximize} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition">
                        <Maximize2 className="w-4 h-4" />
                    </button>
                    <button onClick={handleClose} className="p-1 rounded hover:bg-red-600 hover:text-white transition">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* 终端容器 */}
            <div className="w-full h-full">
                <MyTerminal podName={podName} containerName={containerName} fitRef={fitRef} wsRef={wsRef} />
            </div>
        </Rnd>
    );

    return (
        <>
            {portalRoot && createPortal(rndNode, portalRoot)}

            {minimized && (
                <div
                    className="absolute bottom-4 right-4 px-3 py-2 bg-gray-200 dark:bg-gray-800 rounded shadow cursor-pointer flex items-center gap-2"
                    onClick={handleRestoreFromMin}
                    title="Restore terminal"
                >
                    <TerminalSquare className="w-4 h-4" />
                    <span className="text-sm">{podName}</span>
                </div>
            )}
        </>
    );
}
