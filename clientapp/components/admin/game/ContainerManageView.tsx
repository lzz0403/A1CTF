import {
    ColumnDef,
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from "@tanstack/react-table"

import { ArrowLeft, ArrowRight, ArrowUpDown, ChevronDown, MoreHorizontal, CopyIcon, ClockIcon, ClipboardList, ZapOff, Terminal, Package, RefreshCw } from "lucide-react"

import * as React from "react"

import { Button } from "components/ui/button"
import { Checkbox } from "components/ui/checkbox"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
    DropdownMenuGroup,
} from "components/ui/dropdown-menu"

import { Input } from "components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "components/ui/table"

import { api } from "utils/ApiHelper";
import { Badge } from "components/ui/badge";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "components/ui/alert-dialog";
import { AdminContainerItem, AdminListContainersPayload, ContainerStatus } from "utils/A1API";
import { toast } from 'react-toastify/unstyled';
import dayjs from "dayjs";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "components/ui/hover-card";
import { AxiosResponse } from "axios";
import { Label } from "components/ui/label";
import copy from "copy-to-clipboard";
import { copyWithResult } from "utils/ToastUtil";
import ContainerTerminal from "components/modules/terminal/Terminal";

export type ContainerModel = {
    ID: string,
    TeamName: string,
    GameName: string,
    ChallengeName: string,
    Status: ContainerStatus,
    ExpireTime: Date,
    Ports: string,
    PodID: string,
};

interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    description
}) => (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={onConfirm}>确认</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
);

export function ContainerManageView({
    gameId,
    challengeID
}: {
    gameId: number,
    challengeID?: number
}) {
    const [data, setData] = React.useState<AdminContainerItem[]>([]);
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});

    const [pageSize, _setPageSize] = React.useState(30);
    const [curPage, setCurPage] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);

    const [showFailedContainer, setShowFailedContainer] = React.useState(false);

    const [searchKeyword, setSearchKeyword] = React.useState("");
    const [debouncedSearchKeyword, setDebouncedSearchKeyword] = React.useState("");

    const [confirmDialog, setConfirmDialog] = React.useState({
        isOpen: false,
        title: "",
        description: "",
        onConfirm: () => { },
    });

    // 多终端数组
    type TerminalInstance = {
        id: string;
        podName: string;
        containerName: string;
        isOpen: boolean;
    };
    const [terminals, setTerminals] = React.useState<TerminalInstance[]>([]);

    // 防抖处理搜索关键词
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchKeyword(searchKeyword);
            setCurPage(0);
        }, 200);
        return () => clearTimeout(timer);
    }, [searchKeyword]);

    // 容器操作
    const handleDeleteContainer = (containerId: string) => {
        setConfirmDialog({
            isOpen: true,
            title: "确认停止",
            description: "您确定要停止这个容器吗？",
            onConfirm: () => {
                toast.promise(
                    api.admin.adminDeleteContainer({ container_id: containerId }),
                    {
                        pending: '正在停止容器...',
                        success: {
                            render({ data: _data }) {
                                fetchContainers();
                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                                return '容器正在停止';
                            }
                        },
                        error: '停止容器失败'
                    }
                );
            }
        });
    };

    const handleBatchDeleteContainers = () => {
        const selectedRows = table.getFilteredSelectedRowModel().rows;
        const selectedContainerIds = selectedRows.map(row => row.original.container_id);

        if (selectedContainerIds.length === 0) {
            toast.error("请至少选择一个容器");
            return;
        }

        setConfirmDialog({
            isOpen: true,
            title: "确认批量停止",
            description: `您确定要停止选中的 ${selectedContainerIds.length} 个容器吗？`,
            onConfirm: () => {
                const promises = selectedContainerIds.map(containerId =>
                    api.admin.adminDeleteContainer({ container_id: containerId })
                );

                toast.promise(
                    Promise.allSettled(promises),
                    {
                        pending: `正在停止 ${selectedContainerIds.length} 个容器...`,
                        success: {
                            render({ data: results }: { data: PromiseSettledResult<AxiosResponse>[] }) {
                                const successCount = results.filter(r => r.status === 'fulfilled').length;
                                const failCount = results.length - successCount;

                                fetchContainers();
                                setRowSelection({});
                                setConfirmDialog(prev => ({ ...prev, isOpen: false }));

                                if (failCount === 0) return `成功停止 ${successCount} 个容器`;
                                else return `成功停止 ${successCount} 个容器，${failCount} 个失败`;
                            }
                        },
                        error: '批量停止容器失败'
                    }
                );
            }
        });
    };

    const submitExtendContainer = (containerId: string) => {
        toast.promise(
            api.admin.adminExtendContainer({ container_id: containerId }),
            {
                pending: '正在延长容器生命周期...',
                success: { render() { fetchContainers(); return '容器生命周期已延长'; } },
                error: '延长容器生命周期失败'
            }
        );
    };

    const handleGetContainerFlag = (containerId: string) => {
        toast.promise(
            api.admin.adminGetContainerFlag({ container_id: containerId }),
            {
                pending: '正在获取容器Flag...',
                success: {
                    render({ data: response }: { data: AxiosResponse }) {
                        const flagContent = response.data.data.flag_content;
                        copy(flagContent);
                        return `Flag已复制到剪贴板`;
                    }
                },
                error: '获取容器Flag失败'
            }
        );
    };

    const getStatusColorAndText = (status: ContainerStatus) => {
        switch (status) {
            case ContainerStatus.ContainerRunning: return { color: "#52C41A", text: "运行中" };
            case ContainerStatus.ContainerStopped: return { color: "#8C8C8C", text: "已停止" };
            case ContainerStatus.ContainerStarting: return { color: "#1890FF", text: "启动中" };
            case ContainerStatus.ContainerError: return { color: "#FF4D4F", text: "错误" };
            case ContainerStatus.ContainerStopping: return { color: "#FAAD14", text: "停止中" };
            case ContainerStatus.ContainerQueueing: return { color: "#722ED1", text: "队列中" };
            case ContainerStatus.NoContainer: return { color: "#D9D9D9", text: "无容器" };
            default: return { color: "#D9D9D9", text: "未知" };
        }
    };

    // 表格列
    const columns: ColumnDef<AdminContainerItem>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="全选"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="选择行"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            accessorKey: "TeamName",
            header: "队伍名称",
            cell: ({ row }) => {
                return (
                    <div className="flex gap-2 items-center">
                        {row.original.team_name}
                        <Badge
                            variant="outline"
                            className="text-xs select-none hover:bg-blue/10 hover:border-blue/30 cursor-pointer transition-all duration-200 rounded-md px-2 py-1 font-mono"
                            onClick={() => {
                                copyWithResult(row.original.team_id)
                            }}
                        >
                            #{row.original.team_id}
                        </Badge>
                    </div>
                )
            },
        },
        {
            accessorKey: "ChallengeName",
            header: "题目名称",
            cell: ({ row }) => (
                <div className="flex gap-2 items-center">
                    {row.original.challenge_name}
                    <Badge
                        variant="outline"
                        className="text-xs select-none hover:bg-blue/10 hover:border-blue/30 cursor-pointer transition-all duration-200 rounded-md px-2 py-1 font-mono"
                        onClick={() => {
                            copyWithResult(row.original.challenge_id)
                        }}
                    >
                        #{row.original.challenge_id}
                    </Badge>
                </div>
            ),
        },
        {
            accessorKey: "Status",
            header: "状态",
            cell: ({ row }) => {
                const status = row.original.container_status as ContainerStatus;
                const { color, text } = getStatusColorAndText(status);
                return (
                    <Badge
                        className="capitalize w-[60px] px-[5px] flex justify-center select-none"
                        style={{ backgroundColor: color }}
                    >
                        {text}
                    </Badge>
                )
            },
        },
        {
            accessorKey: "ExpireTime",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    >
                        过期时间
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => {
                const expireTime = row.original.container_expiretime;
                return <div>{dayjs(expireTime).format('YYYY-MM-DD HH:mm:ss')} ({dayjs(expireTime).diff(dayjs(), 'minutes')}mins)</div>
            },
            sortingFn: (rowA, rowB, _columnId) => {
                const dateA = dayjs(rowA.original.container_expiretime);
                const dateB = dayjs(rowB.original.container_expiretime);
                return dateA.isBefore(dateB) ? -1 : 1;
            }
        },
        {
            accessorKey: "Ports",
            header: "访问入口",
            cell: ({ row }) => {

                let ports: string[] = []
                if (row.original.container_ports && row.original.container_ports.length > 0) {
                    ports = row.original.container_ports.map(port =>
                        `${port.ip}:${port.port} (${port.port_name})`
                    );
                }

                return (
                    <HoverCard openDelay={100} closeDelay={100}>
                        <HoverCardTrigger asChild>
                            <Button variant="link" className="px-0 py-0 h-auto font-normal select-none">
                                @links
                            </Button>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-full p-4">
                            <div className="space-y-2">
                                <h4 className="text-sm font-semibold">访问入口</h4>
                                {ports ? (
                                    <div className="text-sm">
                                        {ports.map((port, index) => (
                                            <div key={index} className="flex items-center py-1 gap-2 border-b border-gray-100 last:border-0">
                                                <span>{port}</span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6 ml-auto"
                                                    onClick={() => {
                                                        copyWithResult(port.split(" ")[0])
                                                    }}
                                                >
                                                    <CopyIcon className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-sm text-muted-foreground">无可用链接</div>
                                )}
                            </div>
                        </HoverCardContent>
                    </HoverCard>
                );
            },
        },
        {
            id: "actions",
            header: "操作",
            enableHiding: false,
            cell: ({ row }) => {
                const container = row.original;

                return (
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleGetContainerFlag(container.container_id)}
                            data-tooltip-id="my-tooltip"
                            data-tooltip-content="复制Flag"
                            data-tooltip-place="top"
                        >
                            <span className="sr-only">复制Flag</span>
                            <CopyIcon className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    className="h-8 w-8 p-0 text-blue-600"
                                    data-tooltip-id="my-tooltip"
                                    data-tooltip-content="容器终端"
                                    data-tooltip-place="top"
                                >
                                    <span className="sr-only">容器终端</span>
                                    <Terminal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="mr-5 p-2 select-none" align="start">
                                <DropdownMenuLabel>选择一个容器</DropdownMenuLabel>
                                <DropdownMenuGroup>
                                    {container.container_name_list?.map((e) => (
                                        <DropdownMenuItem key={e} onClick={() => {
                                            const id = `${container.pod_id}-${e}`;
                                            setTerminals(prev => {
                                                const existing = prev.find(t => t.id === id);
                                                if (existing) {
                                                    // 重新打开已存在的终端
                                                    return prev.map(t => t.id === id ? { ...t, isOpen: true } : t);
                                                }
                                                return [...prev, { id, podName: container.pod_id ?? "", containerName: e, isOpen: true }];
                                            });
                                        }}>
                                            <Package />
                                            {e}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuGroup>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="ghost"
                            className="h-8 w-8 p-0 text-red-600"
                            onClick={() => handleDeleteContainer(container.container_id)}
                            data-tooltip-id="my-tooltip"
                            data-tooltip-content="停止容器"
                            data-tooltip-place="top"
                        >
                            <span className="sr-only">停止容器</span>
                            <ZapOff className="h-4 w-4" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">打开菜单</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" >
                                <DropdownMenuLabel>操作</DropdownMenuLabel>
                                <DropdownMenuItem
                                    onClick={() => {
                                        copyWithResult(container.container_id)
                                    }}
                                >
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    复制容器ID
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => copyWithResult(container.pod_id)}
                                >
                                    <ClipboardList className="h-4 w-4 mr-2" />
                                    复制PodID
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => submitExtendContainer(container.container_id)}
                                    className="text-blue-600"
                                >
                                    <ClockIcon className="h-4 w-4 mr-2" />
                                    延长生命周期
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )
            },
        },
    ]

    const fetchContainers = () => {
        const payload: AdminListContainersPayload = {
            game_id: gameId,
            size: pageSize,
            offset: pageSize * curPage,
            challenge_id: challengeID ?? -1,
            show_failed: showFailedContainer
        };
        if (debouncedSearchKeyword.trim()) payload.search = debouncedSearchKeyword.trim();

        api.admin.adminListContainers(payload).then((res: any) => {
            setTotalCount(res.data.total ?? 0);
            setData(res.data.data);
        });
    };

    const handleSearch = (value: string) => setSearchKeyword(value);

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
        },
    });

    React.useEffect(() => {
        table.setPageSize(pageSize);
        fetchContainers();
    }, [curPage, pageSize, gameId, debouncedSearchKeyword, showFailedContainer]);

    return (
        <>
            {/* 渲染多终端 */}
            {terminals.map(t => t.isOpen && (
                <ContainerTerminal
                    key={t.id}
                    podName={t.podName}
                    containerName={t.containerName}
                    isOpen={t.isOpen}
                    setIsOpen={(open) => {
                        if (!open) setTerminals(prev => prev.map(x => x.id === t.id ? { ...x, isOpen: false } : x));
                    }}
                    setTerminalPod={() => { }}
                    setTerminalContainer={() => { }}
                />
            ))}

            <div className="w-full flex flex-col gap-4">
                <div className="flex items-center justify-end space-x-2 select-none">
                    <div className="flex-1 text-sm text-muted-foreground flex items-center">
                        {table.getFilteredSelectedRowModel().rows.length} / {" "}
                        {table.getFilteredRowModel().rows.length} 行已选择
                    </div>
                    <div className="flex gap-3 items-center">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurPage(curPage - 1)}
                            disabled={curPage == 0}
                        >
                            <ArrowLeft />
                        </Button>
                        <div className="text-sm text-muted-foreground">
                            {curPage + 1} / {Math.ceil(totalCount / pageSize)}
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurPage(curPage + 1)}
                            disabled={curPage >= Math.ceil(totalCount / pageSize) - 1}
                        >
                            <ArrowRight />
                        </Button>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="flex flex-col gap-2">
                        <Input
                            placeholder="请输入关键词"
                            value={searchKeyword}
                            onChange={(event) => handleSearch(event.target.value)}
                            className="max-w-lg"
                        />
                        <span className="text-xs text-muted-foreground">支持队伍ID, PodID, 容器ID, 队伍名称, 题目名称, 题目ID, 队伍ID</span>
                    </div>
                    <div className="flex gap-2 ml-auto items-center">
                        <Label className="hover:bg-accent/50 cursor-pointer flex items-start gap-3 rounded-lg border p-[10px] has-[[aria-checked=true]]:border-red-600 has-[[aria-checked=true]]:bg-red-50 dark:has-[[aria-checked=true]]:border-red-900 dark:has-[[aria-checked=true]]:bg-red-950">
                            <Checkbox
                                id="toggle-2"
                                checked={showFailedContainer}
                                onCheckedChange={(e) => {
                                    setShowFailedContainer(e.valueOf() as boolean);
                                }}
                                className="data-[state=checked]:border-red-600 data-[state=checked]:bg-red-600 data-[state=checked]:text-white dark:data-[state=checked]:border-red-700 dark:data-[state=checked]:bg-red-700"
                            />
                            <div className="grid gap-1.5 font-normal">
                                <p className="text-sm leading-none font-medium">
                                    显示错误容器
                                </p>
                            </div>
                        </Label>
                        <Button
                            variant="destructive"
                            className="select-none"
                            onClick={handleBatchDeleteContainers}
                            disabled={table.getFilteredSelectedRowModel().rows.length === 0}
                        >
                            <ZapOff className="h-4 w-4 mr-2" />
                            批量停止 ({table.getFilteredSelectedRowModel().rows.length})
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline">
                                    显示项目 <ChevronDown />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="select-none">
                                {table
                                    .getAllColumns()
                                    .filter((column) => column.getCanHide())
                                    .map((column) => {
                                        return (
                                            <DropdownMenuCheckboxItem
                                                key={column.id}
                                                className="capitalize"
                                                checked={column.getIsVisible()}
                                                onCheckedChange={(value) =>
                                                    column.toggleVisibility(!!value)
                                                }
                                            >
                                                {column.id}
                                            </DropdownMenuCheckboxItem>
                                        )
                                    })}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button variant="outline" size={"icon"} onClick={() => fetchContainers()}>
                            <RefreshCw />
                        </Button>
                    </div>
                </div>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext()
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="h-24 text-center"
                                    >
                                        暂无数据
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>


            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                description={confirmDialog.description}
            />
        </>
    );
}
