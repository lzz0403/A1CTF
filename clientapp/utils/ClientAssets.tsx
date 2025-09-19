import { Binary, Bitcoin, Bot, Bug, FileSearch, Github, GlobeLock, HardDrive, MessageSquareLock, Rabbit, Radar, ShieldCheck, Smartphone, SquareCode, BrickWallFire } from "lucide-react"

export const challengeCategoryColorMap : { [key: string]: string } = {
    "ALL": "rgb(32, 201, 151)",
    "MISC": "rgb(32, 201, 151)",
    "CRYPTO": "rgb(132, 94, 247)",
    "PWN": "rgb(255, 107, 107)",
    "WEB": "rgb(51, 154, 240)",
    "REVERSE": "rgb(252, 196, 25)",
    "FORENSICS": "rgb(92, 124, 250)",
    "HARDWARE": "rgb(208, 208, 208)",
    "MOBILE": "rgb(240, 101, 149)",
    "PPC": "rgb(34, 184, 207)",
    "AI": "rgb(148, 216, 45)",
    "PENTEST": "rgb(204, 93, 232)",
    "OSINT": "rgb(255, 146, 43)",
    "BLOCKCHAIN": "rgb(75, 192, 192)",
    "IR": "rgb(255, 69, 58)",
};

export const challengeCategoryIcons : { [key: string]: any } = {
    "All": <Rabbit size={23} />,
    "MISC": <Radar size={23} />,
    "CRYPTO": <MessageSquareLock size={23} />,
    "PWN": <Bug size={23} />,
    "WEB": <GlobeLock size={23} />,
    "REVERSE": <Binary size={23} />,
    "FORENSICS": <FileSearch size={23} />,
    "BLOCKCHAIN": <Bitcoin size={21} />,
    "HARDWARE": <HardDrive size={23} />,
    "MOBILE": <Smartphone size={23} />,
    "PPC": <SquareCode size={23} />,
    "AI": <Bot size={23} />,
    "PENTEST": <ShieldCheck size={23} />,
    "OSINT": <Github size={23} />,
    "IR": <BrickWallFire size={23} />,
};