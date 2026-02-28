import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

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
  if (!inline) {
    return (
      <div className="w-full overflow-hidden">
        <SyntaxHighlighter
          style={oneLight}
          language="sql"
          PreTag="div"
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            overflow: "hidden",
            wordBreak: "break-all",
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
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
