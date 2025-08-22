import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "components/ui/alert-dialog"
import { Asterisk } from "lucide-react"
import { ReactNode } from "react"
import { useTranslation } from "react-i18next"

export default function AlertConformer(
    {
        children,
        title = "",
        description = "",
        type = "default",
        onConfirm,
        onCancel,
    }: {
        children: ReactNode,
        title?: string,
        description?: string,
        type?: "danger" | "default",
        onConfirm?: () => void,
        onCancel?: () => void
    }
) {
    const { t } = useTranslation()
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                {children}
            </AlertDialogTrigger>
            <AlertDialogContent className="select-none">
                <AlertDialogHeader>
                    <AlertDialogTitle>
                        <div
                            className={`flex gap-2 items-center ${type == "danger" ? "text-red-500" : ""}`}
                        >
                            <Asterisk size={30} />
                            {title}
                        </div>
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        className="cursor-pointer"
                        onClick={() => {
                            if (onCancel) onCancel()
                        }}
                    >{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => {
                            if (onConfirm) onConfirm()
                        }}
                        className={`${type == "danger" ? "bg-destructive hover:bg-destructive/90 cursor-pointer" : ""}`}
                    >{t("continue")}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}