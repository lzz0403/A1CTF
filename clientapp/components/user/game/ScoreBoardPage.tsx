import { ChartArea, Download } from 'lucide-react'


import React, { useEffect, useRef, useState, useCallback } from 'react';
import dayjs from 'dayjs';
import { useTheme } from 'next-themes';
import { ScoreTable } from 'components/ScoreTable';
import * as XLSX from 'xlsx-js-style';

import { Tooltip } from 'react-tooltip';
import { Button } from 'components/ui/button';

import { randomInt } from "mathjs";
import { MacScrollbar } from 'mac-scrollbar';
import BetterChart from 'components/BetterChart';

import { useGlobalVariableContext } from 'contexts/GlobalVariableContext';
import { api } from 'utils/ApiHelper';
import { GameScoreboardData, TeamScore, UserFullGameInfo, UserSimpleGameChallenge, GameGroupSimple, PaginationInfo } from 'utils/A1API';
import { useIsMobile } from 'hooks/use-mobile';
import { ScoreTableMobile } from 'components/ScoreTableMobile';
import { toast } from 'react-toastify/unstyled';

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "components/ui/select"
import TeamScoreDetailPage from './TeamScoreDetailPage';
import { useTranslation } from 'react-i18next';

export default function ScoreBoardPage(
    { gmid }
        :
        { gmid: number }
) {
    const { theme } = useTheme();
    const { t } = useTranslation("game_view")

    const [gameInfo, setGameInfo] = useState<UserFullGameInfo | undefined>(undefined)
    const [challenges, setChallenges] = useState<Record<string, UserSimpleGameChallenge[]>>({})
    const [scoreBoardModel, setScoreBoardModel] = useState<GameScoreboardData>()

    // 分组和分页相关状态
    const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(undefined)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize, setPageSize] = useState(20)
    const [groups, setGroups] = useState<GameGroupSimple[]>([])
    const [pagination, setPagination] = useState<PaginationInfo | undefined>(undefined)
    // 方向(类别)筛选
    const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined)

    const lastTimeLine = useRef<string>()
    const [isChartFullscreen, setIsChartFullscreen] = useState(false)
    const [isChartFloating, setIsChartFloating] = useState(false)
    const [isChartMinimized, setIsChartMinimized] = useState(false)
    const [isNormalChartMinimized, setIsNormalChartMinimized] = useState(false)
    const [isDownloading, setIsDownloading] = useState(false)
    const [showUserDetail, setShowUserDetail] = useState<TeamScore>({})

    const isMobile = useIsMobile()
    // 换页加载状态
    const [pageLoading, setPageLoading] = useState(false)

    // const serialOptions = useRef<echarts.SeriesOption[]>([])

    const { serialOptions } = useGlobalVariableContext()

    // 使用useMemo稳定gameInfo引用，避免BetterChart不必要的重新渲染
    const stableGameInfo = React.useMemo(() => gameInfo, [
        gameInfo?.game_id,
        gameInfo?.name,
        gameInfo?.start_time,
        gameInfo?.end_time
    ]);

    // 使用useCallback优化函数props，避免BetterChart不必要的重新渲染
    const handleToggleFullscreen = useCallback(() => {
        setIsChartFullscreen(!isChartFullscreen);
    }, [isChartFullscreen]);

    const handleToggleFloating = useCallback(() => {
        setIsChartFloating(!isChartFloating);
        // 切换到悬浮窗模式时重置正常模式最小化状态
        if (!isChartFloating) {
            setIsNormalChartMinimized(false);
        }
    }, [isChartFloating]);

    const handleFloatingToggleFloating = useCallback(() => {
        setIsChartFloating(!isChartFloating);
        // 退出悬浮窗模式时重置悬浮窗最小化状态
        if (isChartFloating) {
            setIsChartMinimized(false);
        }
    }, [isChartFloating]);

    const handleNormalMinimize = useCallback(() => {
        setIsNormalChartMinimized(true);
    }, []);

    const handleFloatingMinimize = useCallback(() => {
        setIsChartMinimized(true);
    }, []);

    const handleNormalRestore = useCallback(() => {
        setIsNormalChartMinimized(false);
    }, []);

    const handleFloatingRestore = useCallback(() => {
        setIsChartMinimized(false);
    }, []);

    // 下载积分榜XLSX功能
    const downloadScoreboardXLSX = useCallback(async () => {
        if (!gameInfo || isDownloading) return;

        setIsDownloading(true);
        // 获取完整的积分榜数据（不分页，获取所有数据用于导出）
        const params: any = {};
        if (selectedGroupId) {
            params.group_id = selectedGroupId;
        }
        params.page = 1;
        params.size = (pagination?.total_count ?? 0) + 100; // 获取大量数据用于导出
        // 注意：当选择了学校且未选择方向时，我们将生成多文件（每个方向一个），
        // 此时不在请求中携带 category，以获取全部题目用于拆分。
        if (!selectedGroupId && selectedCategory) {
            params.category = selectedCategory;
        }


        api.user.userGetGameScoreboard(gmid, params).then((response) => {
            const data = response.data.data as GameScoreboardData;

            if (!data?.teams || !data?.challenges) {
                throw new Error(`${t('scoreboard.filename').trim()}${t('scoreboard.data_error')}`);
            }

            // 如果筛选了学校：导出为多文件（每个方向一个）。
            if (selectedGroupId) {
                // 汇总所有方向（从挑战列表收集）
                const categoriesSet = new Set<string>();
                (data.challenges || []).forEach((ch) => {
                    const cat = ch.category?.toLowerCase() || 'misc';
                    categoriesSet.add(cat);
                });
                const categories = selectedCategory
                    ? [selectedCategory.toLowerCase()]
                    : Array.from(categoriesSet).sort();

                const groupName = data.current_group?.group_name || 'GROUP';

                // 逐方向生成与下载
                categories.forEach((cat) => {
                    const workbook = generateScoreboardXLSXByGroupAndCategory(data, selectedGroupId, cat);

                    const filename = `${gameInfo.name}_${groupName}${t('group')}_${cat.toUpperCase()}_${t('scoreboard.filename').trim()}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
                    XLSX.writeFile(workbook, filename);
                });

                toast.success(`${t('scoreboard.title')}${t('scoreboard.download_success')} (${categories.length})`);
                return;
            }

            // 未筛选学校：维持单文件导出（工作簿内多工作表）
            const workbook = generateScoreboardXLSX(data);
            const directionSuffix = selectedCategory ? `_${selectedCategory.toUpperCase()}` : '';
            const filename = `${gameInfo.name}${directionSuffix}_${t('scoreboard.filename').trim()}_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`;
            XLSX.writeFile(workbook, filename);
            toast.success(`${t('scoreboard.title')}${t('scoreboard.download_success')} ${filename}`);
        }).finally(() => {
            setIsDownloading(false);
        })
    }, [gameInfo, gmid, isDownloading, selectedGroupId, selectedCategory, pagination]);

    // 分组选择处理
    const handleGroupChange = useCallback((value: string) => {
        const groupId = value === "all" ? undefined : parseInt(value);
        setSelectedGroupId(groupId);
        setCurrentPage(1); // 重置到第一页
    }, []);

    // 页面大小变化处理
    const handlePageSizeChange = useCallback((size: string) => {
        const newSize = parseInt(size);
        setPageSize(newSize);
        setCurrentPage(1); // 重置到第一页

        if (pagination && pagination.current_page > 1) {
            toast.info(t("scoreboard.resize_success"));
        }
    }, [pagination]);

    // 方向筛选变化处理
    const handleCategoryChange = useCallback((value: string) => {
        const cat = value === "all" ? undefined : value;
        setSelectedCategory(cat);
        setCurrentPage(1);
    }, []);

    // 生成XLSX工作簿（按学校/分组与方向分别生成不同工作表）
    const generateScoreboardXLSX = (data: GameScoreboardData): XLSX.WorkBook => {
        const teams = data.teams || [];
        const challenges = data.challenges || [];
        const groupsList = data.groups || [];

        // 构建 challengeId -> category 映射
        const challengeIdToCategory = new Map<number, string>();
        challenges.forEach(ch => {
            const cat = ch.category?.toLowerCase() || 'misc';
            challengeIdToCategory.set(ch.challenge_id, cat);
        });

        // 按类别分组题目，后续用于生成列
        const challengesByCategory: Record<string, UserSimpleGameChallenge[]> = {};
        challenges.forEach(ch => {
            const cat = ch.category?.toLowerCase() || 'misc';
            if (!challengesByCategory[cat]) challengesByCategory[cat] = [];
            challengesByCategory[cat].push(ch);
        });

        // 计算需要导出的分组（学校）集合
        const exportGroups = selectedGroupId
            ? groupsList.filter(g => g.group_id === selectedGroupId)
            : groupsList.length > 0
                ? groupsList
                : (data.current_group ? [data.current_group] : []);

        // 计算需要导出的方向集合
        const allCategories = Object.keys(challengesByCategory).sort();
        const exportCategories = selectedCategory
            ? [selectedCategory.toLowerCase()]
            : allCategories;

        // 创建工作簿
        const workbook = XLSX.utils.book_new();

        // 遍历 分组 × 方向，分别生成工作表
        exportGroups.forEach(group => {
            const groupTeams = teams.filter(t => t.group_id === group.group_id);

            exportCategories.forEach(cat => {
                const catChallenges = challengesByCategory[cat] || [];

                // 表头：基础列 + 当前方向题目列
                const headers = (t("scoreboard.excel_headers", { returnObjects: true }) as string[]).slice();
                catChallenges.forEach(ch => {
                    headers.push(`${cat.toUpperCase()}-${ch.challenge_name}`);
                });

                // 表数据
                const sheetData: any[][] = [];

                // 头部样式行
                const headerRow = headers.map(h => ({
                    v: h,
                    t: 's',
                    s: {
                        font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
                        fill: { patternType: "solid", fgColor: { rgb: "4F46E5" } },
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "000000" } },
                            bottom: { style: "thin", color: { rgb: "000000" } },
                            left: { style: "thin", color: { rgb: "000000" } },
                            right: { style: "thin", color: { rgb: "000000" } }
                        }
                    }
                }));
                sheetData.push(headerRow);

                // 计算团队在当前方向的分数，用于排序和显示“总分”列
                const dirScoreByTeam: Record<number, number> = {};
                groupTeams.forEach(team => {
                    let sum = 0;
                    (team.solved_challenges || []).forEach(sc => {
                        if (challengeIdToCategory.get(sc.challenge_id) === cat) {
                            sum += sc.score || 0;
                        }
                    });
                    dirScoreByTeam[team.team_id] = sum;
                });

                // 按当前方向分数降序排序，生成组内排名
                const orderedTeams = [...groupTeams].sort((a, b) => {
                    const sa = dirScoreByTeam[a.team_id] || 0;
                    const sb = dirScoreByTeam[b.team_id] || 0;
                    if (sb !== sa) return sb - sa;
                    // 次要排序：总分降序 -> 原始 rank（稳定性）
                    if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
                    return (a.rank || 0) - (b.rank || 0);
                });

                // 填充数据行
                orderedTeams.forEach((team, idx) => {
                    const row: any[] = [];

                    const rank = idx + 1;
                    let rankStyle: any = {
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "E5E7EB" } },
                            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                            left: { style: "thin", color: { rgb: "E5E7EB" } },
                            right: { style: "thin", color: { rgb: "E5E7EB" } }
                        }
                    };
                    if (rank === 1) {
                        rankStyle.fill = { patternType: "solid", fgColor: { rgb: "FEF3C7" } };
                        rankStyle.font = { bold: true, color: { rgb: "D97706" } };
                    } else if (rank === 2) {
                        rankStyle.fill = { patternType: "solid", fgColor: { rgb: "F3F4F6" } };
                        rankStyle.font = { bold: true, color: { rgb: "6B7280" } };
                    } else if (rank === 3) {
                        rankStyle.fill = { patternType: "solid", fgColor: { rgb: "FED7AA" } };
                        rankStyle.font = { bold: true, color: { rgb: "EA580C" } };
                    } else if (idx % 2 === 0) {
                        rankStyle.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
                    }
                    row.push({ v: rank, t: 'n', s: rankStyle });

                    // 队伍名称
                    let nameStyle: any = {
                        alignment: { horizontal: "left", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "E5E7EB" } },
                            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                            left: { style: "thin", color: { rgb: "E5E7EB" } },
                            right: { style: "thin", color: { rgb: "E5E7EB" } }
                        }
                    };
                    if (idx % 2 === 0 && rank > 3) {
                        nameStyle.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
                    }
                    row.push({ v: team.team_name || '', t: 's', s: nameStyle });

                    // 当前方向总分
                    let scoreStyle: any = {
                        alignment: { horizontal: "center", vertical: "center" },
                        border: {
                            top: { style: "thin", color: { rgb: "E5E7EB" } },
                            bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                            left: { style: "thin", color: { rgb: "E5E7EB" } },
                            right: { style: "thin", color: { rgb: "E5E7EB" } }
                        }
                    };
                    if (idx % 2 === 0 && rank > 3) {
                        scoreStyle.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
                    }
                    row.push({ v: dirScoreByTeam[team.team_id] || 0, t: 'n', s: scoreStyle });

                    // 题目分数（仅当前方向）
                    catChallenges.forEach(ch => {
                        const solved = team.solved_challenges?.find(s => s.challenge_id === ch.challenge_id);
                        const val = solved ? (solved.score || 0) : 0;
                        let st: any = {
                            alignment: { horizontal: "center", vertical: "center" },
                            border: {
                                top: { style: "thin", color: { rgb: "E5E7EB" } },
                                bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                                left: { style: "thin", color: { rgb: "E5E7EB" } },
                                right: { style: "thin", color: { rgb: "E5E7EB" } }
                            }
                        };
                        if (val > 0) {
                            st.fill = { patternType: "solid", fgColor: { rgb: "DCFCE7" } };
                            st.font = { color: { rgb: "166534" }, bold: true };
                        } else if (idx % 2 === 0 && rank > 3) {
                            st.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
                        }
                        row.push({ v: val, t: 'n', s: st });
                    });

                    sheetData.push(row);
                });

                // 工作表与列宽
                const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
                const colWidths = [
                    { wch: 8 },
                    { wch: 20 },
                    { wch: 10 },
                ];
                catChallenges.forEach(() => colWidths.push({ wch: 15 }));
                worksheet['!cols'] = colWidths;

                // 追加到工作簿
                const safeGroup = (group.group_name || 'GROUP').replace(/[\\/:*?\[\]]/g, '-');
                const safeCat = (cat || 'CAT').toUpperCase().replace(/[\\/:*?\[\]]/g, '-');
                let sheetName = `${safeGroup}-${safeCat}`;
                if (sheetName.length > 31) sheetName = sheetName.slice(0, 31);
                XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            });
        });

        // 设置属性
        workbook.Props = {
            Title: `${gameInfo?.name || 'CTF'} ${t('scoreboard.filename').trim()}`,
            Subject: `${t('scoreboard.subject')}${t('scoreboard.filename')}`,
            Author: "A1CTF System",
            CreatedDate: new Date()
        };

        return workbook;
    };

    // 生成单学校单方向工作簿（仅包含一个工作表）
    const generateScoreboardXLSXByGroupAndCategory = (
        data: GameScoreboardData,
        groupId: number,
        cat: string
    ): XLSX.WorkBook => {
        const teams = data.teams || [];
        const challenges = data.challenges || [];

        // 构建 challengeId -> category 映射
        const challengeIdToCategory = new Map<number, string>();
        challenges.forEach(ch => {
            const cc = ch.category?.toLowerCase() || 'misc';
            challengeIdToCategory.set(ch.challenge_id, cc);
        });

        // 当前方向的题目集合
        const catChallenges = challenges.filter(ch => (ch.category?.toLowerCase() || 'misc') === cat);

        // 当前学校的团队集合
        const groupTeams = teams.filter(t => t.group_id === groupId);

        // 计算每队在当前方向的分数
        const dirScoreByTeam: Record<number, number> = {};
        groupTeams.forEach(team => {
            let sum = 0;
            (team.solved_challenges || []).forEach(sc => {
                if (challengeIdToCategory.get(sc.challenge_id) === cat) {
                    sum += sc.score || 0;
                }
            });
            dirScoreByTeam[team.team_id] = sum;
        });

        // 按方向分数降序排序，生成排名
        const orderedTeams = [...groupTeams].sort((a, b) => {
            const sa = dirScoreByTeam[a.team_id] || 0;
            const sb = dirScoreByTeam[b.team_id] || 0;
            if (sb !== sa) return sb - sa;
            if ((b.score || 0) !== (a.score || 0)) return (b.score || 0) - (a.score || 0);
            return (a.rank || 0) - (b.rank || 0);
        });

        // 表头：基础列 + 当前方向题目列
        const headers = (t("scoreboard.excel_headers", { returnObjects: true }) as string[]).slice();
        catChallenges.forEach(ch => headers.push(`${cat.toUpperCase()}-${ch.challenge_name}`));

        const sheetData: any[][] = [];
        const headerRow = headers.map(h => ({
            v: h,
            t: 's',
            s: {
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 12 },
                fill: { patternType: "solid", fgColor: { rgb: "4F46E5" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                }
            }
        }));
        sheetData.push(headerRow);

        orderedTeams.forEach((team, idx) => {
            const row: any[] = [];
            const rank = idx + 1;

            let rankStyle: any = {
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "E5E7EB" } },
                    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                    left: { style: "thin", color: { rgb: "E5E7EB" } },
                    right: { style: "thin", color: { rgb: "E5E7EB" } }
                }
            };
            if (rank === 1) {
                rankStyle.fill = { patternType: "solid", fgColor: { rgb: "FEF3C7" } };
                rankStyle.font = { bold: true, color: { rgb: "D97706" } };
            } else if (rank === 2) {
                rankStyle.fill = { patternType: "solid", fgColor: { rgb: "F3F4F6" } };
                rankStyle.font = { bold: true, color: { rgb: "6B7280" } };
            } else if (rank === 3) {
                rankStyle.fill = { patternType: "solid", fgColor: { rgb: "FED7AA" } };
                rankStyle.font = { bold: true, color: { rgb: "EA580C" } };
            } else if (idx % 2 === 0) {
                rankStyle.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
            }
            row.push({ v: rank, t: 'n', s: rankStyle });

            let nameStyle: any = {
                alignment: { horizontal: "left", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "E5E7EB" } },
                    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                    left: { style: "thin", color: { rgb: "E5E7EB" } },
                    right: { style: "thin", color: { rgb: "E5E7EB" } }
                }
            };
            if (idx % 2 === 0 && rank > 3) {
                nameStyle.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
            }
            row.push({ v: team.team_name || '', t: 's', s: nameStyle });

            let scoreStyle: any = {
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "E5E7EB" } },
                    bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                    left: { style: "thin", color: { rgb: "E5E7EB" } },
                    right: { style: "thin", color: { rgb: "E5E7EB" } }
                }
            };
            if (idx % 2 === 0 && rank > 3) {
                scoreStyle.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
            }
            row.push({ v: (team.team_id ? (dirScoreByTeam[team.team_id] || 0) : 0), t: 'n', s: scoreStyle });

            // 题目分数（仅当前方向）
            catChallenges.forEach(ch => {
                const solved = team.solved_challenges?.find(s => s.challenge_id === ch.challenge_id);
                const val = solved ? (solved.score || 0) : 0;
                let st: any = {
                    alignment: { horizontal: "center", vertical: "center" },
                    border: {
                        top: { style: "thin", color: { rgb: "E5E7EB" } },
                        bottom: { style: "thin", color: { rgb: "E5E7EB" } },
                        left: { style: "thin", color: { rgb: "E5E7EB" } },
                        right: { style: "thin", color: { rgb: "E5E7EB" } }
                    }
                };
                if (val > 0) {
                    st.fill = { patternType: "solid", fgColor: { rgb: "DCFCE7" } };
                    st.font = { color: { rgb: "166534" }, bold: true };
                } else if (idx % 2 === 0 && rank > 3) {
                    st.fill = { patternType: "solid", fgColor: { rgb: "F9FAFB" } };
                }
                row.push({ v: val, t: 'n', s: st });
            });

            sheetData.push(row);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
        const colWidths = [{ wch: 8 }, { wch: 20 }, { wch: 10 }];
        catChallenges.forEach(() => colWidths.push({ wch: 15 }));
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        let sheetName = `${(data.current_group?.group_name || 'GROUP').replace(/[\\/:*?\[\]]/g, '-')}-${cat.toUpperCase().replace(/[\\/:*?\[\]]/g, '-')}`;
        if (sheetName.length > 31) sheetName = sheetName.slice(0, 31);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        workbook.Props = {
            Title: `${gameInfo?.name || 'CTF'} ${t('scoreboard.filename').trim()}`,
            Subject: `${t('scoreboard.subject')}${t('scoreboard.filename')}`,
            Author: "A1CTF System",
            CreatedDate: new Date()
        };

        return workbook;
    };

    // 获取 gameInfo
    useEffect(() => {
        api.user.userGetGameInfoWithTeamInfo(gmid).then((res) => {
            setGameInfo(res.data.data)
        })
    }, [gmid])

    useEffect(() => {

        if (!gameInfo?.name) return
        if (dayjs() < dayjs(gameInfo.start_time)) return

        const updateScoreBoard = (silent: boolean = false) => {
            // 设置加载状态
            if (!silent) setPageLoading(true);

            // 构建查询参数
            const params: any = {
                page: currentPage,
                size: pageSize
            };

            if (selectedGroupId) {
                params.group_id = selectedGroupId;
            }
            if (selectedCategory) {
                params.category = selectedCategory;
            }

            api.user.userGetGameScoreboard(gmid, params).then((res) => {

                // 依据筛选后的顺序重算排名（考虑分页偏移），避免显示原始总榜名次
                const data = res.data.data as GameScoreboardData;
                const page = data?.pagination?.current_page ?? currentPage;
                const size = data?.pagination?.page_size ?? pageSize;
                if (Array.isArray(data?.teams)) {
                    const recalculated = data.teams.map((team, index) => ({
                        ...team,
                        rank: (Math.max(page, 1) - 1) * Math.max(size, 1) + (index + 1),
                    }));
                    data.teams = recalculated;
                }

                setScoreBoardModel(data)

                // 设置分组信息
                if (res.data.data?.groups) {
                    setGroups(res.data.data.groups);
                }

                // 设置分页信息
                if (res.data.data?.pagination) {
                    setPagination(res.data.data.pagination);
                }

                const groupedChallenges: Record<string, UserSimpleGameChallenge[]> = {};
                res.data.data?.challenges?.forEach((challenge: UserSimpleGameChallenge) => {
                    const category = challenge.category?.toLowerCase() || "misc";
                    if (!groupedChallenges[category]) {
                        groupedChallenges[category] = [];
                    }
                    groupedChallenges[category].push(challenge);
                });
                setChallenges(groupedChallenges)

                const current = dayjs()
                let end = dayjs(gameInfo.end_time).diff(current) > 0 ? current : dayjs(gameInfo.end_time)

                const curTimeLine = JSON.stringify(res.data.data?.top10_timelines)

                lastTimeLine.current = curTimeLine

                serialOptions.current = [
                    {
                        type: 'line',
                        step: 'end',
                        data: [],
                        markLine:
                            dayjs(gameInfo.end_time).diff(dayjs(), 's') < 0
                                ? undefined
                                : {
                                    symbol: 'none',
                                    data: [
                                        {
                                            xAxis: +end.toDate(),
                                            // lineStyle: {
                                            //     color: colorScheme === 'dark' ? "#FFFFFF" : "#000000",
                                            //     wight: 2,
                                            // },
                                            label: {
                                                textBorderWidth: 0,
                                                fontWeight: 500,
                                                color: theme === 'dark' ? '#94a3b8' : '#64748b',
                                                formatter: (time: any) => dayjs(time.value).format('YYYY-MM-DD HH:mm'),
                                            },
                                        },
                                    ],
                                },
                    },
                    ...(res.data.data?.top10_timelines?.map((team, index) => {

                        const lastRecordTime = team.scores?.[team.scores?.length - 1]?.record_time;
                        const lastScore = team.scores?.[team.scores?.length - 1]?.score || 0;

                        const shouldAddEnd = lastRecordTime && dayjs(lastRecordTime).isBefore(end);

                        let data = [
                            [+dayjs(gameInfo.start_time).toDate(), 0],
                            ...(team.scores?.map((item) => [
                                +(item.record_time ? dayjs(item.record_time).toDate() : 0),
                                item.score || 0
                            ]) || []),
                        ];

                        if (shouldAddEnd) {
                            data.push([+end.toDate(), lastScore]);
                        }

                        return {
                            name: team.team_name,
                            type: 'line',
                            showSymbol: false,
                            step: 'end',
                            data: data,
                            lineStyle: {
                                width: 4
                            },
                            endLabel: {
                                show: true,
                                formatter: `${team.team_name} - ${team.scores![team.scores!.length - 1]?.score ?? 0} pts`,
                                color: theme === 'dark' ? '#f1f5f9' : '#0f172a',
                                fontWeight: 'bold',
                                fontSize: 12, // 稍微减小字体避免重叠
                                distance: 15 + (index % 3) * 8, // 动态调整距离，错开标签位置
                                verticalAlign: index % 2 === 0 ? 'middle' : (index % 4 < 2 ? 'top' : 'bottom'), // 垂直错开
                                backgroundColor: theme === 'dark' ? 'rgba(15, 23, 42, 0.9)' : 'rgba(248, 250, 252, 0.95)', // 更好的背景对比度
                                borderColor: theme === 'dark' ? '#334155' : '#cbd5e1',
                                borderWidth: 1,
                                borderRadius: 6,
                                padding: [4, 8], // 增加内边距提高可读性
                                shadowBlur: theme === 'dark' ? 8 : 4, // 添加阴影增强层次感
                                shadowColor: theme === 'dark' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                                shadowOffsetX: 0,
                                shadowOffsetY: 2,
                                rich: {
                                    // 富文本样式，用于更好的标签显示
                                    teamName: {
                                        fontWeight: 'bold',
                                        fontSize: 12,
                                        color: theme === 'dark' ? '#f1f5f9' : '#0f172a'
                                    },
                                    score: {
                                        color: theme === 'dark' ? '#94a3b8' : '#64748b',
                                        fontSize: 11
                                    }
                                }
                            },
                            smooth: true,
                        }
                    }) || [])
                ] as echarts.SeriesOption[]

                // 结束加载状态
                setTimeout(() => setPageLoading(false), 200)
            }).catch((_error) => {
                // 出错时也要结束加载状态
                setPageLoading(false);
            })
        }

        updateScoreBoard(false)
        const scoreBoardInter = setInterval(() => {
            // if (visibleRef.current) updateScoreBoard()
            updateScoreBoard(true)
        }, randomInt(4000, 5000))

        return () => {
            clearInterval(scoreBoardInter)
        }
    }, [gameInfo, currentPage, selectedGroupId, selectedCategory, pageSize, theme])

    return (
        <>
            {/* <LoadingPage visible={loadingVisiblity} /> */}
            <TeamScoreDetailPage
                showUserDetail={showUserDetail}
                setShowUserDetail={setShowUserDetail}
                scoreBoardModel={scoreBoardModel}
                gameInfo={gameInfo}
                challenges={challenges}
            />
            <div className='absolute top-0 left-0 h-full w-full transition-colors duration-300'>
                <Tooltip id="challengeTooltip" opacity={0.9} className='z-[200]' />
                <MacScrollbar
                    className="w-full h-full overflow-y-auto"
                    skin={theme == "light" ? "light" : "dark"}
                    suppressScrollX
                >
                    <div className='w-full flex flex-col relative gap-2 py-10'>
                        <div id='scoreHeader' className='w-full h-[60px] flex items-center px-10 mb-6 '>
                            <span className='text-3xl font-bold [text-shadow:_hsl(var(--foreground))_1px_1px_20px] select-none'>{t("scoreboard.title")}</span>
                            <div className='flex-1' />
                            {/* 下载积分榜按钮 */}
                            {gameInfo && (
                                <Button
                                    onClick={downloadScoreboardXLSX}
                                    disabled={isDownloading}
                                    className={`mr-4 transition-all duration-300 hover:scale-110 ${isDownloading ? 'opacity-50 cursor-not-allowed' : ''
                                        }`}
                                    variant="outline"
                                    size="sm"
                                >
                                    <Download size={18} className={`mr-2 ${isDownloading ? 'animate-spin' : ''}`} />
                                    {isDownloading ? t("scoreboard.downloading") : t("scoreboard.download")}
                                </Button>
                            )}
                        </div>
                        {gameInfo ? (
                            <>
                                {/* 图表区域 - 根据模式显示 */}
                                {!isChartFloating && !isNormalChartMinimized && (
                                    <div className={`mx-auto transition-all duration-300 ${isChartFullscreen
                                        ? 'absolute top-0 left-0 w-full h-screen z-50 px-4 py-4'
                                        : 'container px-10 aspect-[16/7] min-h-[450px]'
                                        }`}>
                                        <BetterChart
                                            theme={theme == "dark" ? "dark" : "light"}
                                            gameInfo={stableGameInfo!}
                                            isFullscreen={isChartFullscreen}
                                            isFloating={isChartFloating}
                                            onToggleFullscreen={handleToggleFullscreen}
                                            onToggleFloating={handleToggleFloating}
                                            onMinimize={handleNormalMinimize}
                                        />
                                    </div>
                                )}

                                {/* 悬浮窗图表 */}
                                {isChartFloating && !isChartMinimized && (
                                    <div className="fixed top-0 left-0 w-[500px] h-[350px] z-50 pointer-events-none">
                                        <div className="pointer-events-auto">
                                            <BetterChart
                                                theme={theme == "dark" ? "dark" : "light"}
                                                gameInfo={stableGameInfo!}
                                                isFullscreen={isChartFullscreen}
                                                isFloating={isChartFloating}
                                                onToggleFullscreen={handleToggleFullscreen}
                                                onToggleFloating={handleFloatingToggleFloating}
                                                onMinimize={handleFloatingMinimize}
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* 正常模式最小化图表恢复按钮 */}
                                {!isChartFloating && isNormalChartMinimized && (
                                    <div className="fixed bottom-4 right-4 z-50">
                                        <Button
                                            onClick={handleNormalRestore}
                                            className={`p-3 rounded-full shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 ${theme === 'dark'
                                                ? 'bg-slate-800/90 border border-slate-600/50 text-slate-200 hover:bg-slate-700/90'
                                                : 'bg-white/90 border border-gray-300/50 text-slate-700 hover:bg-gray-50/90'
                                                }`}
                                            title={t("scoreboard.show")}
                                        >
                                            <ChartArea className="w-5 h-5" />
                                            <span className="text-sm">{t("scoreboard.show")}</span>
                                        </Button>
                                    </div>
                                )}

                                {/* 最小化图表恢复按钮 */}
                                {isChartFloating && isChartMinimized && (
                                    <div className="fixed bottom-4 right-4 z-50">
                                        <Button
                                            onClick={handleFloatingRestore}
                                            className={`p-3 rounded-full shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 ${theme === 'dark'
                                                ? 'bg-slate-800/90 border border-slate-600/50 text-slate-200 hover:bg-slate-700/90'
                                                : 'bg-white/90 border border-gray-300/50 text-slate-700 hover:bg-gray-50/90'
                                                }`}
                                            title={t("scoreboard.show")}
                                        >
                                            <ChartArea className="w-5 h-5" />
                                            <span className="text-sm">{t("scoreboard.show")}</span>
                                        </Button>
                                    </div>
                                )}

                                {/* 积分榜区域 - 悬浮窗模式下不受全屏影响 */}
                                {((!isChartFullscreen && !isNormalChartMinimized) || isChartFloating || isNormalChartMinimized) && (
                                    <>
                                        {/* 分组选择器和分页信息 */}
                                        <div className={`w-full lg:max-w-[90vw] mx-auto px-10 mb-4 select-none ${!isNormalChartMinimized ? "mt-6" : ""}`}>
                                            <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap'>
                                                <div className='flex flex-wrap items-center gap-4'>
                                                    {/* 分组选择器 */}
                                                    {groups.length > 0 && (
                                                        <div className='flex items-center gap-2'>
                                                            <span className='text-sm font-medium'>{t("scoreboard.groups")}:</span>
                                                            <Select value={selectedGroupId?.toString() || "all"} onValueChange={handleGroupChange} disabled={pageLoading}>
                                                                <SelectTrigger className="w-[180px]">
                                                                    <SelectValue placeholder={t("scoreboard.select_groups")} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="all">{t("scoreboard.all_groups")}</SelectItem>
                                                                    {groups.map((group) => (
                                                                        <SelectItem key={group.group_id} value={group.group_id.toString()}>
                                                                            {group.group_name} ({group.team_count}{t("team")})
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* 页面大小选择器 */}
                                                    {pagination && (
                                                        <div className='flex items-center gap-2'>
                                                            <span className='text-sm font-medium hidden sm:inline'>{t("scoreboard.pages")}:</span>
                                                            <span className='text-sm font-medium sm:hidden'>{t("scoreboard.per_page")}:</span>
                                                            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange} disabled={pageLoading}>
                                                                <SelectTrigger className="w-[70px] h-8 text-xs sm:text-sm">
                                                                    <SelectValue placeholder={t("scoreboard.page_count")} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="10">10</SelectItem>
                                                                    <SelectItem value="15">15</SelectItem>
                                                                    <SelectItem value="20">20</SelectItem>
                                                                    <SelectItem value="50">50</SelectItem>
                                                                    <SelectItem value="100">100</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}

                                                    {/* 方向筛选按钮（放在每页显示旁边） */}
                                                    {challenges && (
                                                        <div className='flex items-center gap-2'>
                                                            <span className='text-sm font-medium'>{t("scoreboard.directions")}:</span>
                                                            <Select value={selectedCategory || "all"} onValueChange={handleCategoryChange} disabled={pageLoading}>
                                                                <SelectTrigger className="w-[120px] h-8 text-xs sm:text-sm">
                                                                    <SelectValue placeholder={t("scoreboard.select_directions")} />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="all">{t("scoreboard.all_directions")}</SelectItem>
                                                                    {Object.keys(challenges).sort().map((cat) => (
                                                                        <SelectItem key={cat} value={cat}>{cat.toUpperCase()}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* 分页信息 */}
                                                {pagination && (
                                                    <div className='flex items-center'>
                                                        <span className='text-xs sm:text-sm text-muted-foreground'>
                                                            {t("scoreboard.page_info", { count: pagination.total_count, cur_page: pagination.current_page, pages: pagination.total_pages })}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className='flex lg:max-w-[90vw] w-full mx-auto overflow-y-auto overflow-x-hidden justify-center px-10'>
                                            <div className='flex overflow-hidden w-full'>
                                                <div className='flex flex-1 overflow-hidden'>
                                                    {scoreBoardModel ? (!isMobile ? (
                                                        <>
                                                            <ScoreTable
                                                                scoreBoardModel={scoreBoardModel}
                                                                setShowUserDetail={setShowUserDetail}
                                                                challenges={selectedCategory ? { [selectedCategory]: challenges[selectedCategory] || [] } : challenges}
                                                                pageSize={pageSize}
                                                                pagination={pagination}
                                                                curPage={currentPage}
                                                                setCurPage={setCurrentPage}
                                                                isLoading={pageLoading}
                                                            />
                                                        </>
                                                    ) : (
                                                        <ScoreTableMobile
                                                            scoreBoardModel={scoreBoardModel}
                                                            setShowUserDetail={setShowUserDetail}
                                                            challenges={selectedCategory ? { [selectedCategory]: challenges[selectedCategory] || [] } : challenges}
                                                        />
                                                    )) : (
                                                        <></>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </>
                        ) : (<></>)}
                    </div>
                </MacScrollbar>

            </div>
        </>
    )
}