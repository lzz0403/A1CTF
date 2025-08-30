import { EditGameView } from "components/admin/EditGameView";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { AdminFullGameInfo } from "utils/A1API";
import { api } from "utils/ApiHelper";
import { LoadingPage } from "components/LoadingPage";


export default function GameSettings() {

    const { game_id } = useParams();
    const navigate = useNavigate()

    if (!game_id) {
        navigate("/404")
        return
    }

    const [gameInfo, setGameInfo] = useState<AdminFullGameInfo>();
    const [gameInfoFetchError, setGameInfoFetchError] = useState(false);
    const gid = parseInt(game_id);

    useEffect(() => {
        // Fetch challenge info
        api.admin.getGameInfo(gid).then((res) => {
            setGameInfo(res.data.data);
        }).catch((_) => {
            setGameInfoFetchError(true)
        })
    }, [game_id])

    if (!gameInfo) {
        if (gameInfoFetchError) {
            navigate("/404")
            return
        }
        return <LoadingPage visible={true} />;
    }

    return (
        <div className="w-screen h-screen">
            <EditGameView game_info={gameInfo} />
        </div>
    );
}