import { Binary, Bitcoin, Bot, Bug, FileSearch, Github, GlobeLock, HardDrive, MessageSquareLock, Rabbit, Radar, ShieldCheck, Smartphone, SquareCode, BrickWallFire } from "lucide-react"

export const challengeCategoryColorMap : { [key: string]: string } = {
    "All": "rgb(32, 201, 151)",
    "Misc": "rgb(32, 201, 151)",
    "Crypto": "rgb(132, 94, 247)",
    "Pwn": "rgb(255, 107, 107)",
    "Web": "rgb(51, 154, 240)",
    "Reverse": "rgb(252, 196, 25)",
    "Forensics": "rgb(92, 124, 250)",
    "Hardware": "rgb(208, 208, 208)",
    "Mobile": "rgb(240, 101, 149)",
    "PPC": "rgb(34, 184, 207)",
    "AI": "rgb(148, 216, 45)",
    "Pentest": "rgb(204, 93, 232)",
    "OSINT": "rgb(255, 146, 43)",
    "Blockchain": "rgb(75, 192, 192)",
    "IR": "rgb(255, 69, 58)",
};

export const challengeCategoryIcons : { [key: string]: any } = {
    "All": <Rabbit size={23} />,
    "Misc": <Radar size={23} />,
    "Crypto": <MessageSquareLock size={23} />,
    "Pwn": <Bug size={23} />,
    "Web": <GlobeLock size={23} />,
    "Reverse": <Binary size={23} />,
    "Forensics": <FileSearch size={23} />,
    "Blockchain": <Bitcoin size={21} />,
    "Hardware": <HardDrive size={23} />,
    "Mobile": <Smartphone size={23} />,
    "PPC": <SquareCode size={23} />,
    "AI": <Bot size={23} />,
    "Pentest": <ShieldCheck size={23} />,
    "OSINT": <Github size={23} />,
    "IR": <BrickWallFire size={23} />,
};