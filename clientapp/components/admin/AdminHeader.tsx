import { Cable, ContactRound, Dices, Flag, Home, Settings } from "lucide-react";
import { Button } from "../ui/button";
import { useLocation, useNavigate } from "react-router";
import ThemeSwitcher from "components/ToggleTheme";

export function AdminHeader() {

    const path = useLocation().pathname.split("/").slice(-1)[0];
    const navigate = useNavigate()

    const get_button_style = function (name: string) {
        return path == name ? "default" : "ghost";
    }

    const move_to_page = function (name: string) {
        if (path != name) navigate(`/admin/${name}`)
    }

    return (
        <header className="h-14 backdrop-blur-sm select-none flex-shrink-0">
            <div className="w-full h-full flex items-center px-4 border-b-[1px] gap-2">
                <div className="flex gap-2 items-center mr-4"
                    onClick={() => move_to_page("")}
                >
                    <img
                        src={"/images/A1natas.svg"}
                        alt={"A1CTF"}
                        width={32}
                        height={32}
                        className="dark:invert"
                    />
                    <span className="text-lg font-bold">A1CTF Admin</span>
                </div>
                <Button variant={get_button_style("games")} onClick={() => move_to_page("games")} className="font-bold"><Flag />比赛管理</Button>
                <Button variant={get_button_style("challenges")} onClick={() => move_to_page("challenges")} className="font-bold"><Dices />题目管理</Button>
                <Button variant={get_button_style("users")} onClick={() => move_to_page("users")} className="font-bold"><ContactRound />用户管理</Button>
                {/* <Button variant={get_button_style("teams")} onClick={() => move_to_page("teams")} className="font-bold"><UsersRound/>队伍管理</Button> */}
                {/* <Button variant={get_button_style("containers")} onClick={() => move_to_page("containers")} className="font-bold"><Package/>容器管理</Button> */}
                <Button variant={get_button_style("logs")} onClick={() => move_to_page("logs")} className="font-bold"><Cable />系统日志</Button>
                <div className="flex-1" />
                <Button variant={get_button_style("system")} onClick={() => move_to_page("system/basic")} className="font-bold"><Settings />系统设置</Button>
                <Button variant={get_button_style("system")} onClick={() => navigate("/")} className="font-bold"><Home />返回主页</Button>
                <ThemeSwitcher />
            </div>
        </header>
    )
}