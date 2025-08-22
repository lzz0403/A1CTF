import { motion, AnimatePresence, useAnimate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useGameSwitchContext } from "contexts/GameSwitchContext";
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function GameSwitchHover({ animation }: { animation: boolean }) {

    const { t } = useTranslation()
    const { isChangingGame, curSwitchingGame, posterData } = useGameSwitchContext();

    const [shouldAnime, setShouldAnime] = useState(false)
    const [animeMethod, setAnimeMethod] = useState("easeInOut")
    const [exitAnimationTime, setExitAnimationTime] = useState(0)

    const [scope, _animate] = useAnimate()

    useEffect(() => {
        setShouldAnime(true)
        setAnimeMethod("easeInOut")
        setExitAnimationTime(0.4)
    }, [])

    return (
        <AnimatePresence>
            {isChangingGame && (
                <motion.div className='absolute w-screen h-screen top-0 left-0 z-[100] bg-background overflow-hidden' key="exitAnime"
                    initial={{
                        translateY: "-100%"
                    }}
                    animate={{
                        translateY: "0%"
                    }}
                    exit={{
                        translateY: "-100%"
                    }}
                    transition={{
                        ease: animeMethod,
                        duration: shouldAnime ? exitAnimationTime : 0
                    }}
                >
                    <motion.div ref={scope} className='w-full h-full bg-cover'
                        key="exitscale"
                        style={{
                            backgroundImage: `url(${posterData})`,
                            // backgroundSize: "100%"
                        }}
                        initial={{
                            scale: 1
                        }}
                        animate={{
                            scale: 1.08
                        }}
                        transition={{
                            duration: animation ? 3 : (shouldAnime ? exitAnimationTime : 0),
                            ease: "easeInOut"
                            // delay: 0.6
                        }}
                    >
                    </motion.div>
                    <motion.div
                        className='absolute w-screen h-screen top-0 left-0'
                        initial={{
                            backdropFilter: "blur(5px)",
                            backgroundColor: "rgba(0, 0, 0, 0)"
                        }}
                        animate={{
                            backdropFilter: "blur(8px)",
                            backgroundColor: "rgba(0, 0, 0, 0.4)"
                        }}
                        transition={{
                            duration: animation ? 3 : (shouldAnime ? exitAnimationTime : 0),
                            ease: "easeInOut"
                            // delay: 0.6
                        }}
                    >
                    </motion.div>
                    <div className='absolute top-0 left-0 w-screen h-screen flex items-center justify-center'>
                        <motion.div
                            // initial={{ scale: 1, translateY: fromY }}
                            // animate={{ scale: 1, translateY: 0 }}
                            // transition={{
                            //     duration: shouldAnime ? 0.5 : 0,
                            //     ease: 'easeInOut',
                            //     delay: shouldAnime ? 0.4 : 0
                            // }}
                            className="flex flex-col z-20 items-center text-white p-10 w-full overflow-hidden"
                        >
                            <motion.div
                                initial={{
                                    opacity: 0,
                                    translateY: "-10%"
                                }}
                                animate={{
                                    opacity: 1,
                                    translateY: "0%"
                                }}
                                transition={{
                                    duration: animation ? 0.5 : 0,
                                    delay: animation ? 0.5 : 0
                                }}
                            >
                                <img
                                    className="mb-5 rounded-xl shadow-lg flex-shrink-0 flex-grow-0"
                                    src={posterData}
                                    alt="game-cover"
                                    width={700}
                                    height={100}
                                />
                            </motion.div>
                            <motion.div className='flex flex-col w-full items-center overflow-hidden'
                                initial={{
                                    height: "0px"
                                }}
                                animate={{
                                    height: "100%"
                                }}
                                transition={{
                                    duration: animation ? 0.5 : 0,
                                    delay: animation ? 1.2 : 0,
                                    ease: "easeInOut"
                                }}
                            >
                                <span className="text-3xl font-bold">{curSwitchingGame.name}</span>
                                <p className="mt-2">{curSwitchingGame.summary}</p>
                                <div className='flex mt-4'>
                                    <Loader2 className="animate-spin" />
                                    <span className="font-bold ml-3">{t("loading")}</span>
                                </div>
                            </motion.div>
                        </motion.div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
