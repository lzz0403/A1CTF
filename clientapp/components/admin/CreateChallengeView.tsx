import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "components/ui/form"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "components/ui/select"

import { Input } from "../ui/input";
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "../ui/button";

import { Bitcoin, CircleArrowLeft, FileCode, Github, Save, ScanBarcode, ShieldCheck } from "lucide-react"

import CodeEditor from '@uiw/react-textarea-code-editor';

import { Binary, Bot, Bug, FileSearch, GlobeLock, HardDrive, MessageSquareLock, Radar, Smartphone, SquareCode, BrickWallFire } from "lucide-react"
import { useEffect, useState } from "react";
import { MacScrollbar } from "mac-scrollbar";
import { AdminChallengeConfig } from "utils/A1API";
import { api } from "utils/ApiHelper";
import dayjs from "dayjs";
import { toast } from 'react-toastify/unstyled';
import { useNavigate } from "react-router";
import { useTheme } from "next-themes";
import ThemedEditor from "components/modules/ThemedEditor";

export function CreateChallengeView() {

    const categories: { [key: string]: any } = {
        "MISC": <Radar size={21} />,
        "CRYPTO": <MessageSquareLock size={21} />,
        "PWN": <Bug size={21} />,
        "WEB": <GlobeLock size={21} />,
        "REVERSE": <Binary size={21} />,
        "FORENSICS": <FileSearch size={21} />,
        "BLOCKCHAIN": <Bitcoin size={21} />,
        "HARDWARE": <HardDrive size={21} />,
        "MOBILE": <Smartphone size={21} />,
        "PPC": <SquareCode size={21} />,
        "AI": <Bot size={21} />,
        "PENTEST": <ShieldCheck size={21} />,
        "OSINT": <Github size={21} />,
        "IR": <BrickWallFire size={21} />, // 添加IR分类及其图标
    };

    const formSchema = z.object({
        name: z.string().min(2, { message: "名字最短要两个字符" }),
        description: z.string(),
        create_time: z.date().optional(),
        challenge_id: z.number().optional(),
        category: z.enum(Object.keys(categories) as [string, ...string[]], {
            errorMap: () => ({ message: "需要选择一个有效的题目类别" })
        }),
        judge_config: z.object({
            judge_type: z.enum(["DYNAMIC", "SCRIPT"], {
                errorMap: () => ({ message: "需要选择一个有效的题目类别" })
            }),
            judge_script: z.string().optional(),
            flag_template: z.string().optional(),
        }),
        container_type: z.enum(["DYNAMIC_CONTAINER", "STATIC_CONTAINER", "NO_CONTAINER"]),
        // 新增 container_config 部分
        container_config: z.array(
            z.object({
                name: z.string().min(1, { message: "请输入容器名称" }),
                image: z.string().min(1, { message: "请输入镜像地址" }),
                command: z.string().nullable(),
                env: z.string().nullable(),
                expose_ports: z.array(
                    z.object({
                        name: z.string().min(1, { message: "请输入端口名称" }),
                        port: z.number().min(1).max(65535)
                    })
                ),
            })
        ),
        attachments: z.array(
            z.object({
                attach_hash: z.string().nullable(),
                attach_name: z.string().min(2, { message: "附件名称最少2个字符" }),
                attach_type: z.enum(["STATICFILE", "DYNAMICFILE", "REMOTEFILE", "ATTACHMENTPOOR"], {
                    errorMap: () => ({ message: "需要选择一个有效的附件类型" })
                }),
                attach_url: z.string().nullable(),
                download_hash: z.string().nullable(),
                generate_script: z.string().nullable(),
            })
        ),
        flag_type: z.enum(["FlagTypeDynamic", "FlagTypeStatic"]),
    });

    const string_to_env = (data: string): { name: string, value: string }[] => {
        const env: { name: string, value: string }[] = []

        data.split(",").forEach((item) => {
            const [name, value] = item.split("=")
            env.push({ name, value })
        })

        return env
    }

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            description: "",
            category: "",
            challenge_id: 0,
            judge_config: {
                judge_type: "DYNAMIC",
                judge_script: "",
                flag_template: ""
            },
            container_config: [],
            attachments: [],
            container_type: "NO_CONTAINER",
            create_time: new Date(),
            flag_type: "FlagTypeDynamic",
        }
    })

    const [showScript, setShowScript] = useState(false);

    function onSubmit(values: z.infer<typeof formSchema>) {

        const data_time = dayjs().toISOString();

        const finalData = {
            attachments: values.attachments,
            category: values.category.toUpperCase(),
            challenge_id: 0,
            container_config: values.container_config.map((c) => ({
                command: c.command != "" ? c.command : null,
                env: c.env != "" ? string_to_env(c.env || "") : [],
                expose_ports: c.expose_ports,
                image: c.image,
                name: c.name
            })),
            create_time: data_time,
            description: values.description,
            judge_config: values.judge_config,
            name: values.name,
            type_: 0,
            flag_type: "FlagTypeDynamic"
        };

        api.admin.createChallenge(finalData as AdminChallengeConfig).then(() => {
            toast.success("创建成功")
        })
    }

    const router = useNavigate()

    useEffect(() => {
        // form.reset(challenge_info as any);
        // form.setValue("category", "MISC")
    }, [])

    const { theme } = useTheme()

    return (
        <div className="absolute w-screen h-screen bg-background items-center justify-center flex select-none overflow-x-hidden overflow-hidden">
            <Form {...form}>
                <MacScrollbar className="h-full w-full flex flex-col items-center"
                    skin={theme == "light" ? "light" : "dark"}
                >
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-20 pt-20 w-[80%] flex flex-col">
                        <div className="flex">
                            <Button type="button" variant={"default"} onClick={() => {
                                router(`/admin/challenges`)
                            }}>
                                <CircleArrowLeft />
                                Back to challenges
                            </Button>
                        </div>
                        <span className="text-3xl font-bold">Create Challenge</span>
                        <span className="text-lg font-semibold">基本信息</span>
                        <div className="flex gap-10 items-center">
                            <div className="w-1/3">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center h-[20px]">
                                                <FormLabel>题目名称</FormLabel>
                                                <div className="flex-1" />
                                                <FormMessage className="text-[14px]" />
                                            </div>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                请填写题目名称
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="w-1/3">
                                <FormField
                                    control={form.control}
                                    name="category"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center h-[20px]">
                                                <FormLabel>题目类型</FormLabel>
                                                <div className="flex-1" />
                                                <FormMessage className="text-[14px]" />
                                            </div>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="选择一个题目类别" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="w-full flex">
                                                    {Object.keys(categories).map((category) => (
                                                        <SelectItem key={category} value={category}>
                                                            <div className="w-full flex gap-2 items-center h-[30px]">
                                                                {categories[category]}
                                                                <span className="text-[14px] font-bold">{category.toUpperCase()}</span>
                                                            </div>
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                请选择一个评测模式
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="w-1/3">
                                <FormField
                                    control={form.control}
                                    name="judge_config.judge_type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <div className="flex items-center h-[20px]">
                                                <FormLabel>评测模式</FormLabel>
                                                <div className="flex-1" />
                                                <FormMessage className="text-[14px]" />
                                            </div>
                                            <Select onValueChange={(e) => {
                                                field.onChange(e)
                                                if (e === "SCRIPT") {
                                                    setShowScript(true);
                                                } else {
                                                    setShowScript(false);
                                                }
                                            }} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="选择一个评测模式" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="w-full flex">
                                                    <SelectItem value="DYNAMIC">
                                                        <div className="w-full flex gap-2 items-center h-[25px]">
                                                            <ScanBarcode />
                                                            <span className="text-[12px] font-bold">文字匹配</span>
                                                        </div>
                                                    </SelectItem>
                                                    <SelectItem value="SCRIPT" disabled>
                                                        <div className="w-full flex gap-2 items-center h-[25px]">
                                                            <FileCode />
                                                            <span className="text-[12px] font-bold">脚本匹配</span>
                                                        </div>
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormDescription>
                                                请选择一个类别
                                            </FormDescription>
                                        </FormItem>
                                    )}
                                />
                            </div>
                        </div>
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <div className="flex items-center h-[20px]">
                                        <FormLabel>题目简介</FormLabel>
                                        <div className="flex-1" />
                                        <FormMessage className="text-[14px]" />
                                    </div>
                                    <FormControl>
                                        <ThemedEditor
                                            value={field.value}
                                            onChange={field.onChange}
                                            language="markdown"
                                            className='h-[500px]'
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        题目简介
                                    </FormDescription>
                                </FormItem>
                            )}
                        />
                        {showScript ? (
                            <FormField
                                control={form.control}
                                name="judge_config.judge_script"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center h-[20px]">
                                            <FormLabel>评测脚本</FormLabel>
                                            <div className="flex-1" />
                                            <FormMessage className="text-[14px]" />
                                        </div>
                                        <FormControl>
                                            <CodeEditor
                                                value={field.value}
                                                language="js"
                                                placeholder="在这里输入你的评测脚本"
                                                onChange={(evn) => field.onChange(evn.target.value)}
                                                padding={15}
                                                style={{
                                                    // backgroundColor: "#f5f5f5",
                                                    minHeight: 200,
                                                    borderRadius: 5,
                                                    // fontFamily: 'ui-monospace,SFMono-Regular,SF Mono,Consolas,Liberation Mono,Menlo,monospace',
                                                }}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            如果你选择了动态评测, 你需要提供一份符合格式要求的评测脚本
                                        </FormDescription>
                                    </FormItem>
                                )}
                            />
                        ) : (
                            <FormField
                                control={form.control}
                                name="judge_config.flag_template"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center h-[20px]">
                                            <FormLabel>Flag</FormLabel>
                                            <div className="flex-1" />
                                            <FormMessage className="text-[14px]" />
                                        </div>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <div className="flex flex-col text-[12px] text-foreground/60">
                                            <span>Flag支持模板变量</span>
                                            <span>[team_hash] 部分会被替换成队伍唯一标识符</span>
                                            <span>[team_name] 部分会被替换成队伍名称</span>
                                            <span>[game_id] 部分会被替换成比赛ID</span>
                                            <span>[uuid] 部分会被替换成随机UUID</span>
                                            <span>[random_string_??] 部分会被替换成随机字符串, 其中??表示字符串长度</span>
                                            <span>如果你在题目设置中选择了动态Flag, 将会启用Leet进行反作弊</span>
                                            <span>模板变量部分不会被Leet替换</span>
                                        </div>
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* 动态容器列表 */}
                        {/* <div className="mt-6">
                            <div className="flex items-center mb-4">
                                <span className="text-lg font-semibold">容器列表</span>
                                <div className="flex-1" />
                                <Button
                                    type="button"
                                    variant={"outline"}
                                    className="[&_svg]:size-5"
                                    onClick={() =>
                                        appendContainer({
                                            name: "",
                                            image: "",
                                            command: null,
                                            env: null,
                                            expose_ports: [],
                                        })
                                    }
                                >
                                    <PlusCircle />
                                    添加容器
                                </Button>
                            </div>
                            {containerFields.length > 0 ? containerFields.map((container, index) => (
                                <ContainerForm
                                    key={container.id}
                                    control={form.control}
                                    index={index}
                                    removeContainer={removeContainer}
                                />
                            )) : (
                                <span className="text-sm text-foreground/70">还没有容器哦</span>
                            )}
                        </div>

                        <div className="mt-6">
                            <div className="flex items-center mb-4">
                                <span className="text-lg font-semibold">附件列表</span>
                                <div className="flex-1" />
                                <Button
                                    type="button"
                                    variant={"outline"}
                                    className="[&_svg]:size-5"
                                    onClick={() =>
                                        appendAttachment({
                                            attach_hash: null,
                                            attach_name: "",
                                            attach_type: "STATICFILE",
                                            attach_url: "",
                                            download_hash: "",
                                            generate_script: ""
                                        })
                                    }
                                >
                                    <PlusCircle />
                                    添加附件
                                </Button>
                            </div>
                            {attachmentsFields.length > 0 ? attachmentsFields.map((attachment, index) => (
                                <AttachmentForm
                                    key={index}
                                    control={form.control}
                                    index={index}
                                    form={form}
                                    removeAttachment={removeAttachment}
                                />
                            )) : (
                                <span className="text-sm text-foreground/70">还没有附件哦</span>
                            )}
                        </div> */}

                        <div className="flex">
                            <Button type="submit">
                                <Save />
                                提交
                            </Button>
                        </div>
                    </form>
                </MacScrollbar>
            </Form>
        </div>
    );
}