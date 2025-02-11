import { useEffect, useMemo, useState } from "react";
import {
    Links,
} from "@remix-run/react";
import type { LinksFunction } from "@remix-run/node";
import styles from "~/blink.css?url";

interface Props {
    text: string
}



export const links: LinksFunction = () => [
    { rel: "stylesheet", href: styles },
];


const pause_speed = 2000
const useTypewriter = (text: string, speed = 100) => {
    const [index, setIndex] = useState(0);
    const [isReverse, setIsReverse] = useState(false)
    const displayText = useMemo(() => text.slice(0, index), [index]);
    useEffect(() => {
        let timeoutId: any
        if (index == text.length ) {
            setIsReverse(true)
            timeoutId = setTimeout(() => {
                setIndex(i => i - 1)
            }, pause_speed);
        }
        else if (index == 0 && isReverse) {
            setIsReverse(false)
            timeoutId = setTimeout(() => {
                setIndex(1)
            }, pause_speed);
        }

        else {
            timeoutId = setTimeout(() => {
                isReverse ? setIndex(i => i - 1) : setIndex(i => i + 1);
            }, speed);
        }
        return () => {
            clearTimeout(timeoutId);
        };

    }, [index, text, speed]);

    return { displayText, index };
};

const TypingEffect = ({ text }: Props) => {
    const { displayText, index } = useTypewriter(text)

    return (
        <div className="typing-container">
            <div>{displayText}</div>
            {<div className={`${displayText.endsWith(" ") && 'ml-4'} cursor`}>|</div>}
        </div>
    );
};

export default function Test() {
    const text = "What bank do you use"
    return (<div>
        <div className="App">
            <TypingEffect text={text} />
        </div>
    </div>)
}