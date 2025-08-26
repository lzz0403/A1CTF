import { Button } from "components/ui/button";
import copy from "copy-to-clipboard";
import dayjs from "dayjs";
import i18n from "i18n";
import { CalendarClock, CircleX, FileType2, LetterText, MailCheck, PackageOpen, Text } from "lucide-react";
import { Dispatch, SetStateAction } from "react";
import { toast } from "react-toastify/unstyled";
import { toast as OldToast } from 'sonner'

export function toastNewNotice({ title, time, openNotices }: { title: string, time: string, openNotices: Dispatch<SetStateAction<boolean>> }) {

    OldToast.custom((t) => (
        <div className="bg-background border-2 rounded-2xl w-full relative">
            <div className="flex flex-col justify-center gap-2 p-4 pl-4 pr-4">
                <div className="flex gap-2 items-center">
                    <MailCheck size={20} />
                    <span className="text-sm">{i18n.t("toast.notice.title")}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <CalendarClock size={20} />
                    <span className="text-sm">{time}</span>
                </div>
                <div className="flex gap-2">
                    <FileType2 size={20} className="flex-none" />
                    <span className="text-sm">{title.substring(0, Math.min(title.length, 50)) + ((title.length > 50) ? "…" : "")}</span>
                </div>
                <div className="flex gap-4 mt-2 justify-center">
                    <Button variant="outline" className="flex" onClick={() => {
                        toast.dismiss(t)
                        setTimeout(() => {
                            openNotices(true)
                        }, 300)
                    }}>
                        <div className="flex items-center gap-1">
                            <PackageOpen />
                            <span>{i18n.t("toast.notice.open")}</span>
                        </div>
                    </Button>
                    <Button variant="outline" onClick={() => toast.dismiss(t)}><CircleX /> {i18n.t("close")}</Button>
                </div>
            </div>
        </div>
    ), {
        duration: 600000,
        position: "top-center",
    })

}

export function toastNewHint({ challenges, time, openNotices: _openNotices }: { challenges: string[], time: number, openNotices: Dispatch<SetStateAction<boolean>> }) {

    OldToast.custom((t) => (
        <div className="bg-background border-2 rounded-2xl w-full relative">
            <div className="flex flex-col justify-center gap-2 p-4 pl-4 pr-4">
                <div className="flex gap-2 items-center">
                    <Text size={20} />
                    <span className="text-sm">{i18n.t("toast.hint.title")}</span>
                </div>
                <div className="flex gap-2 items-center">
                    <CalendarClock size={20} />
                    <span className="text-sm">{dayjs(time * 1000).format("YYYY-MM-DD HH:mm:ss")}</span>
                </div>
                <div className="flex gap-2">
                    <LetterText size={20} className="flex-none" />
                    <span className="text-sm">{i18n.t("toast.hint.content", { name: challenges.join(", ") })}</span>
                </div>
                <div className="flex gap-4 mt-2 justify-center">
                    <Button variant="outline" onClick={() => toast.dismiss(t)}><CircleX /> {i18n.t("close")}</Button>
                </div>
            </div>
        </div>
    ), {
        duration: 600000,
        position: "top-center",
    })

}

export const copyWithResult = (text: any) => {
    copy(text?.toString() ?? "") ?
        toast.success(i18n.t("toast.copy_success")) :
        toast.error(i18n.t("toast.copy_failed"))
};