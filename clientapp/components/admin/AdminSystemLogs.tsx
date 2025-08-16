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

import { ArrowLeft, ArrowRight, ArrowUpDown, ChevronDown, MoreHorizontal, Filter, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle, ScanEye } from "lucide-react"

import * as React from "react"

import { Button } from "components/ui/button"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
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

import { MacScrollbar } from "mac-scrollbar";
import { Skeleton } from "../ui/skeleton";
import { Badge } from "../ui/badge";
import { SystemLogItem, LogCategory, SystemLogStats } from "utils/A1API";

import { api } from "utils/ApiHelper";
import { toast } from 'react-toastify/unstyled';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "components/ui/card";
import { useTheme } from "next-themes"
import EditorDialog from "components/modules/EditorDialog"
import copy from "copy-to-clipboard"

interface LogTableRow {
    id: string;
    category: LogCategory;
    username: string | null;
    action: string;
    resource_type: string;
    resource_id: string | null;
    status: string;
    ip_address: string | null;
    create_time: string;
    details: any;
    full_data: any;
    error_message: string | null;
}

export function AdminSystemLogs() {
    const [data, setData] = React.useState<LogTableRow[]>([])
    const [sorting, setSorting] = React.useState<SortingState>([])
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
    const [rowSelection, setRowSelection] = React.useState({})

    const [pageSize, _setPageSize] = React.useState(20);
    const [curPage, setCurPage] = React.useState(0);
    const [totalCount, setTotalCount] = React.useState(0);
    const [searchKeyword, setSearchKeyword] = React.useState("");
    const [debouncedSearchKeyword, setDebouncedSearchKeyword] = React.useState("");

    // 筛选条件
    const [categoryFilter, setCategoryFilter] = React.useState<LogCategory | "">("");
    const [statusFilter, setStatusFilter] = React.useState<string>("");

    const [isLoading, setIsLoading] = React.useState(false);
    const [stats, setStats] = React.useState<SystemLogStats | null>(null);

    // 防抖处理搜索关键词
    React.useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchKeyword(searchKeyword);
            setCurPage(0);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchKeyword]);

    // 获取日志统计
    const fetchStats = React.useCallback(async () => {
        api.admin.adminGetSystemLogStats().then((res) => {
            setStats(res.data.data);
        })
    }, []);

    // 获取日志数据
    const fetchLogs = React.useCallback(async () => {
        setIsLoading(true);

        const params: any = {
            offset: curPage * pageSize,
            size: pageSize,
        };

        if (debouncedSearchKeyword != "") {
            params.keyword = debouncedSearchKeyword;
        }
        if (categoryFilter != "") {
            params.category = categoryFilter;
        }
        if (statusFilter != "") {
            params.status = statusFilter;
        }

        api.admin.adminGetSystemLogs(params).then((response) => {
            if (response.data.code === 200) {
                const logs = response.data.data.logs;
                setTotalCount(response.data.data.total);

                // 转换数据格式
                const tableData: LogTableRow[] = logs.map((log: SystemLogItem) => ({
                    id: log.log_id.toString(),
                    category: log.log_category,
                    username: log.username ?? null,
                    action: log.action,
                    resource_type: log.resource_type,
                    resource_id: log.resource_id ?? null,
                    status: log.status,
                    full_data: log,
                    ip_address: log.ip_address ?? null,
                    create_time: log.create_time,
                    details: log.details,
                    error_message: log.error_message ?? null,
                }));
                setData(tableData);
            }
        }).finally(() => {
            setIsLoading(false);
        })
    }, [curPage, pageSize, debouncedSearchKeyword, categoryFilter, statusFilter]);

    // 页面加载时获取数据
    React.useEffect(() => {
        fetchLogs();
        fetchStats();
    }, [fetchLogs, fetchStats]);

    // 获取状态对应的颜色和图标
    const getStatusBadge = (status: string) => {
        switch (status) {
            case "SUCCESS":
                return (
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        成功
                    </Badge>
                );
            case "FAILED":
                return (
                    <Badge variant="destructive">
                        <XCircle className="w-3 h-3 mr-1" />
                        失败
                    </Badge>
                );
            case "WARNING":
                return (
                    <Badge variant="outline" className="border-yellow-300 text-yellow-800">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        警告
                    </Badge>
                );
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    // 获取类别对应的颜色
    const getCategoryBadge = (category: LogCategory) => {
        const categoryMap = {
            ADMIN: { color: "bg-red-100 text-red-800 border-red-300", text: "管理员" },
            USER: { color: "bg-blue-100 text-blue-800 border-blue-300", text: "用户" },
            SYSTEM: { color: "bg-gray-100 text-gray-800 border-gray-300", text: "系统" },
            CONTAINER: { color: "bg-purple-100 text-purple-800 border-purple-300", text: "容器" },
            JUDGE: { color: "bg-orange-100 text-orange-800 border-orange-300", text: "判题" },
            SECURITY: { color: "bg-yellow-100 text-yellow-800 border-yellow-300", text: "安全" },
        };

        const config = categoryMap[category] || { color: "bg-gray-100 text-gray-800", text: category };
        return (
            <Badge variant="outline" className={config.color}>
                {config.text}
            </Badge>
        );
    };

    // 表格列定义
    const columns: ColumnDef<LogTableRow>[] = [
        {
            accessorKey: "category",
            header: "类别",
            cell: ({ row }) => getCategoryBadge(row.getValue("category")),
        },
        {
            accessorKey: "username",
            header: "用户",
            cell: ({ row }) => (
                <div className="font-medium">
                    {row.getValue("username") || "系统"}
                </div>
            ),
        },
        {
            accessorKey: "action",
            header: "操作",
            cell: ({ row }) => (
                <div className="text-sm">
                    <span
                    // data-tooltip-content={row.getValue("action")}
                    // data-tooltip-placement="top"
                    // data-tooltip-id="my-tooltip"
                    >
                        {/* {t(`${row.getValue("action")}`)} */}
                        {row.getValue("action")}
                    </span>

                </div>
            ),
        },
        {
            accessorKey: "resource_type",
            header: "资源类型",
            cell: ({ row }) => (
                <Badge variant="outline">
                    {row.getValue("resource_type")}
                </Badge>
            ),
        },
        {
            accessorKey: "status",
            header: "状态",
            cell: ({ row }) => getStatusBadge(row.getValue("status")),
        },
        {
            accessorKey: "ip_address",
            header: "IP地址",
            cell: ({ row }) => (
                <div className="font-mono text-sm text-muted-foreground">
                    {row.getValue("ip_address") || "-"}
                </div>
            ),
        },
        {
            accessorKey: "create_time",
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                        className="h-8 p-0"
                    >
                        时间
                        <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                )
            },
            cell: ({ row }) => (
                <div className="text-sm text-muted-foreground">
                    {new Date(row.getValue("create_time")).toLocaleString('zh-CN')}
                </div>
            ),
        },
        {
            id: "actions",
            header: "操作",
            enableHiding: false,
            cell: ({ row }) => {
                const log = row.original.full_data as unknown as SystemLogItem;

                const containerOperations = (
                    <>
                        <DropdownMenuItem
                            onClick={() => {
                                copy(log.resource_id || '') ? toast.success('容器ID已复制到剪切板') : toast.error('复制失败');
                            }}
                        >
                            复制容器ID
                        </DropdownMenuItem>
                    </>
                )

                const getDetailedLog = () => {
                    const newLog = Object.assign({}, log)
                    const binaryString = atob(newLog.details as any)
                    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0))
                    const decodedString = new TextDecoder('utf-8').decode(bytes)
                    newLog.details = JSON.parse(decodedString)
                    return JSON.stringify(newLog, null, 4)
                }

                return (
                    <div className="flex gap-2 items-center">
                        <EditorDialog
                            value={getDetailedLog()}
                            onChange={() => { }}
                            language="json"
                            title={`查看详细信息`}
                            options={{
                                readOnly: true,
                                wordWrap: "on"
                            }}
                        >
                            <Button variant="ghost" size="icon" className='cursor-pointer'
                                title="查看详细信息"
                            >
                                <ScanEye />
                            </Button>
                        </EditorDialog>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">打开菜单</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuLabel>操作</DropdownMenuLabel>
                                {log.user_id && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            copy(log.user_id || '') ? toast.success('用户ID已复制到剪切板') : toast.error('复制失败');
                                        }}
                                    >
                                        复制用户ID
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuItem
                                    onClick={() => {
                                        const detailsText = atob(log.details as unknown as string);
                                        const bytes = Uint8Array.from(detailsText, c => c.charCodeAt(0))
                                        const decodedString = new TextDecoder('utf-8').decode(bytes);
                                        const detail = JSON.stringify(JSON.parse(decodedString), null, 4);
                                        copy(detail || '') ? toast.success('详细信息已复制到剪切板') : toast.error('复制失败');

                                    }}
                                >
                                    复制详细信息
                                </DropdownMenuItem>
                                {log.error_message && (
                                    <DropdownMenuItem
                                        onClick={() => {
                                            copy(log.error_message || '') ? toast.success('错误信息已复制到剪切板') : toast.error('复制失败');
                                        }}
                                    >
                                        复制错误信息
                                    </DropdownMenuItem>
                                )}
                                {log.resource_type == "CONTAINER" && containerOperations}
                                <DropdownMenuItem
                                    onClick={() => {
                                        copy(getDetailedLog()) ? toast.success('原始数据已复制到剪切板') : toast.error('复制失败');
                                    }}
                                >
                                    复制Raw
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                );
            },
        },
    ];

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

    const { theme } = useTheme()

    return (
        <MacScrollbar className="w-full h-full" skin={theme == "light" ? "light" : "dark"}>
            <div className="w-full space-y-6 p-10 mb-10">
                {/* 统计卡片 */}
                {stats && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">总日志数</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.total_logs}</div>
                                <p className="text-xs text-muted-foreground">最近24小时</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">成功</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{stats.success_logs}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">失败</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">{stats.failed_logs}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">管理员</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-600">{stats.admin_logs}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">用户</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">{stats.user_logs}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">安全</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-yellow-600">{stats.security_logs}</div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* 筛选和搜索 */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-4 w-[30%]">
                        <Search className="h-6 w-6 text-gray-500 flex-none" />
                        <Input
                            placeholder="搜索日志。支持用户名, 资源ID, 资源类型, 操作"
                            value={searchKeyword}
                            onChange={(event) => setSearchKeyword(event.target.value)}
                            className="flex-1"
                        />
                    </div>

                    <Select value={categoryFilter} onValueChange={(value) => {
                        if (value == "ALL") {
                            setCategoryFilter("")
                        } else {
                            setCategoryFilter(value as LogCategory | "")
                        }
                    }}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="类别" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">全部类别</SelectItem>
                            <SelectItem value="ADMIN">管理员</SelectItem>
                            <SelectItem value="USER">用户</SelectItem>
                            <SelectItem value="SYSTEM">系统</SelectItem>
                            <SelectItem value="CONTAINER">容器</SelectItem>
                            <SelectItem value="JUDGE">判题</SelectItem>
                            <SelectItem value="SECURITY">安全</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={(value) => {
                        if (value == "ALL") {
                            setStatusFilter("")
                        } else {
                            setStatusFilter(value as LogCategory | "")
                        }
                    }}>
                        <SelectTrigger className="w-32">
                            <SelectValue placeholder="状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">全部状态</SelectItem>
                            <SelectItem value="SUCCESS">成功</SelectItem>
                            <SelectItem value="FAILED">失败</SelectItem>
                            <SelectItem value="WARNING">警告</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        onClick={() => {
                            setCategoryFilter("");
                            setStatusFilter("");
                            setSearchKeyword("");
                        }}
                    >
                        <Filter className="h-4 w-4 mr-2" />
                        清除筛选
                    </Button>

                    <Button
                        variant="outline"
                        onClick={() => {
                            fetchLogs();
                            fetchStats();
                        }}
                        disabled={isLoading}
                    >
                        <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        刷新
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="ml-auto">
                                列显示 <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
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
                </div>

                {/* 表格 */}
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
                            {isLoading ? (
                                Array.from({ length: pageSize }).map((_, index) => (
                                    <TableRow key={index}>
                                        {columns.map((_, colIndex) => (
                                            <TableCell key={colIndex}>
                                                <Skeleton className="h-4 w-20" />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : table.getRowModel().rows?.length ? (
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

                {/* 分页 */}
                <div className="flex items-center justify-between space-x-2 py-4">
                    <div className="text-sm text-muted-foreground">
                        共 {totalCount} 条记录，第 {curPage + 1} / {Math.ceil(totalCount / pageSize)} 页
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurPage(Math.max(0, curPage - 1))}
                            disabled={curPage === 0 || isLoading}
                        >
                            <ArrowLeft className="h-4 w-4" />
                            上一页
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurPage(curPage + 1)}
                            disabled={curPage >= Math.ceil(totalCount / pageSize) - 1 || isLoading}
                        >
                            下一页
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </MacScrollbar>
    );
}