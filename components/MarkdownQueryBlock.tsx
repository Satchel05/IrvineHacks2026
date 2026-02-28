import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      className={`rounded-lg bg-[#f6f7fb] border border-[#e3e6f0] p-4 text-[13px] leading-relaxed text-foreground/90 font-medium shadow-sm flex items-center justify-start ${className || ''}`}
      style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      <div className="w-full text-left">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => (
              <p
                style={{ margin: 0, textAlign: 'left', fontSize: '13px' }}
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
