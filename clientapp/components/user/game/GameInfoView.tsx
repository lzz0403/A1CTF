import { Mdx } from "components/MdxCompoents";
import { useGlobalVariableContext } from "contexts/GlobalVariableContext";
import { LibraryBig, QrCode } from "lucide-react";
import { MacScrollbar } from "mac-scrollbar";
import GamePosterInfoModule from "./GamePosterInfoModule";
import GameTeamStatusCard, { LoginFirstCard } from "components/modules/game/GameTeamStatusCard";
import { useTheme } from "next-themes";
import { useGame, useGameDescription } from "hooks/UseGame";
import { useTranslation } from "react-i18next";

export default function GameInfoView(
    {
        gameID,
    }: {
        gameID: number,
    }
) {
    const { gameInfo, gameStatus, teamStatus, isLoading } = useGame(gameID)
    const { gameDescription } = useGameDescription(gameID)

    const { checkLoginStatus } = useGlobalVariableContext()

    const { theme } = useTheme()

    const { t } = useTranslation("game_view")

    if (isLoading) return <></>

    return (
        <div className="w-full h-full">
            <MacScrollbar className="w-full h-full"
                skin={theme == "light" ? "light" : "dark"}
            >
                <div className="px-10 flex">
                    <div className="lg:w-[60%] w-full h-full py-10 pr-5 flex flex-col">
                        <div className="lg:hidden w-full aspect-video mb-10">
                            <GamePosterInfoModule
                                gameInfo={gameInfo}
                                gameStatus={gameStatus}
                                teamStatus={teamStatus}
                            />
                        </div>
                        <div className="flex gap-2 items-center mb-2 border-b-2 pb-4 select-none">
                            <LibraryBig />
                            <span className="text-2xl font-bold">{t("game_info")}</span>
                            <div className="flex-1" />
                            <QrCode />
                        </div>
                        {gameDescription ? (
                            <Mdx source={gameDescription || ""} />
                        ) : (
                            <div className="w-full h-[60vh] flex items-center justify-center select-none">
                                <span className="font-bold text-lg">{t("no_game_info")}</span>
                            </div>
                        )}
                    </div>
                    <div className="lg:w-[40%] hidden lg:block h-full flex-none">
                        <div className="absolute p-5 pt-10 pr-8 pointer-events-none">
                            <GamePosterInfoModule
                                gameInfo={gameInfo}
                                gameStatus={gameStatus}
                                teamStatus={teamStatus}
                            />
                        </div>
                    </div>
                </div>
            </MacScrollbar >
            {checkLoginStatus() ? (
                <div className="absolute bottom-5 right-7 z-10 flex justify-end flex-col gap-[8px]">
                    <GameTeamStatusCard
                        gameID={gameID}
                    />
                </div>
            ) : (
                <div className="absolute bottom-5 right-0 z-10 flex justify-end flex-col gap-[8px]">
                    <LoginFirstCard />
                </div>
            )}
        </div >
    )
}