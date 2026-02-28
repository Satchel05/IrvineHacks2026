import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (typeof content === 'object' && content !== null) {
    return JSON.stringify(content, null, 2);
  }
  return String(content ?? '');
}

export const MarkdownWrapper = ({ content }: { content: unknown }) => {
  const safeContent = stringifyContent(content);
  return (
    <div className='prose max-w-2xl mx-auto p-4'>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{safeContent}</ReactMarkdown>
    </div>
  );
};