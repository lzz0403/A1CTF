import ReactMarkdown from 'react-markdown'

import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'; // To handle line breaks
import rehypeRaw from 'rehype-raw' // 新增：用于解析 HTML

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

import { useTheme } from 'next-themes';

import ImageLoader from './ImageLoader';
import { useGlobalVariableContext } from 'contexts/GlobalVariableContext';

export function Mdx({ source }: { source: string }) {

    const { theme, resolvedTheme } = useTheme();
    const { clientConfig } = useGlobalVariableContext()

    // 延迟渲染，直到 theme 确定
    if (!theme && !resolvedTheme) {
        return null; // 或者加载指示器
    }

    return (
        <div className='markdown-body'>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                rehypePlugins={[rehypeRaw]}
                components={{
                    code: ({ children = [], className, ...props }) => {
                        // 
                        const match = /language-(\w+)/.exec(className || '')
                        return match ? (<SyntaxHighlighter
                            language={match?.[1]}
                            showLineNumbers={true}
                            style={theme == "dark" ? (oneDark as any) : (oneLight as any)}
                            PreTag='div'
                            className='syntax-hight-wrapper transition-colors duration-300'
                        >
                            {children as string[]}
                        </SyntaxHighlighter>) : (
                            <code {...props} className={className}>
                                {children}
                            </code>
                        )
                    },
                    // blockquote: ({ node, ...props }) => (
                    //     <blockquote className={`
                    //     rounded-sm
                    //     my-4 p-4 border-l-4 
                    //     bg-gray-50/80 dark:bg-gray-800/50
                    //     border-gray-300 dark:border-gray-600
                    //     text-gray-700 dark:text-gray-300
                    //     transition-colors duration-300
                    // `} {...props} />
                    // ),
                    // h1: ({ node, ...props }) => (
                    //     <h1 className="text-3xl font-bold mt-6 mb-4 transition-colors duration-300" {...props} />
                    // ),
                    // h2: ({ node, ...props }) => (
                    //     <h2 className="text-2xl font-semibold mt-5 mb-3 transition-colors duration-300" {...props} />
                    // ),
                    // h3: ({ node, ...props }) => (
                    //     <h3 className="text-xl font-medium mt-4 mb-3 transition-colors duration-300" {...props} />
                    // ),
                    // h4: ({ node, ...props }) => (
                    //     <h4 className="text-lg font-medium mt-4 mb-2 transition-colors duration-300" {...props} />
                    // ),
                    // h5: ({ node, ...props }) => (
                    //     <h5 className="text-base font-normal mt-3 mb-2 transition-colors duration-300" {...props} />
                    // ),
                    // p: ({ node, ...props }) => (
                    //     <>
                    //         <span className="text-base font-normal transition-colors duration-300" {...props} />
                    //         <br />
                    //     </>
                    // ),
                    // a: ({ node, href, ...props }) => (
                    //     <a
                    //         href={href}
                    //         className="text-orange-500 underline hover:text-orange-700 transition-colors duration-300"
                    //         target="_blank"
                    //         rel="noopener noreferrer"
                    //         {...props}
                    //     />
                    // ),
                    // table: ({ node, ...props }) => (
                    //     <div className="w-full overflow-x-auto">
                    //         <table className="w-full border-collapse border-t border-b transition-[border-color,background] duration-300">
                    //             {props.children}
                    //         </table>
                    //     </div>
                    // ),
                    // thead: ({ node, ...props }) => (
                    //     <thead className="bg-gray-100 dark:bg-gray-800">
                    //         {props.children}
                    //     </thead>
                    // ),
                    // tr: ({ node, ...props }) => (
                    //     <tr className="border-t border-b transition-[border-color,background] duration-300">
                    //         {props.children}
                    //     </tr>
                    // ),
                    // th: ({ node, ...props }) => (
                    //     <th className="px-4 py-2 text-left font-semibold border-none">
                    //         {props.children}
                    //     </th>
                    // ),
                    // td: ({ node, ...props }) => (
                    //     <td className="px-4 py-2 border-none">
                    //         {props.children}
                    //     </td>
                    // ),
                    // ul: ({ node, ...props }) => (
                    //     <ul className="list-disc list-inside pl-5 my-1">
                    //         {props.children}
                    //     </ul>
                    // ),
                    // ol: ({ node, ...props }) => (
                    //     <ol className="list-decimal list-inside pl-5 my-1">
                    //         {props.children}
                    //     </ol>
                    // ),
                    img: ({ node: _node, ...props }) => (
                        <ImageLoader
                            src={props.src || clientConfig.DefaultBGImage}
                            alt={props.alt || ""}
                            className="w-full h-full object-cover"
                        />
                    ),
                }}
                skipHtml={false}
            >{source.replace(/<br\s*\/?>/g, "\n")}</ReactMarkdown>
        </div>
    )
}