import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { okaidia } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "./theme-provider";

interface CodeBlockProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

const CodeBlock = ({
  node,
  inline,
  className,
  children,
  ...props
}: CodeBlockProps) => {
      const { theme } = useTheme()
  if (!inline) {
    return (
      <div className="w-full overflow-hidden">
        <SyntaxHighlighter
          style={theme === "dark" ? okaidia : oneLight}
          language="sql"
          PreTag="div"
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            overflow: "hidden",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            backgroundColor: theme === "dark" ? "#000" : "#f8f8f8"
          }}
          codeTagProps={{
            style: {
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              overflowWrap: "anywhere",
            },
          }}
          {...props}
        >
          {String(children).replace(/\n$/, "")}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
};

export default CodeBlock;
