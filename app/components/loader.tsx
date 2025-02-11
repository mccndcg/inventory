import { LinksFunction } from "@remix-run/node";
import styles from "~/loader.css?url";



export const links: LinksFunction = () => [
    { rel: "stylesheet", href: styles },
];

export function Loader() {
    return <div className="w-25 h-25 loader" />
}