import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownQueryBlockProps {
  children: string;
  className?: string;
}

const MarkdownQueryBlock: React.FC<MarkdownQueryBlockProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={`rounded-lg bg-muted border border-border p-4 text-[14px] leading-relaxed text-foreground/90 font-medium shadow-sm flex items-center justify-start ${className || ""}`}
      style={{ wordBreak: "break-word", overflowWrap: "anywhere" }}
    >
      <div className="w-full text-left">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              What this query will do:
            </p>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => (
              <p
                style={{ margin: 0, textAlign: "left", fontSize: "15px" }}
                {...props}
              />
            ),
          }}
        >
          {children}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default MarkdownQueryBlock;
