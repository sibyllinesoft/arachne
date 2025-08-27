import React, { useEffect, useRef } from 'react';
import { Editor, DiffEditor, type OnMount } from '@monaco-editor/react';
import { diffLines } from 'diff';
import type { DiffViewerProps, CodeDiff } from '@/types/analysis';

const DiffViewer: React.FC<DiffViewerProps> = ({
  originalCode,
  modifiedCode,
  mode = 'side-by-side',
  language = 'javascript'
}) => {
  const editorRef = useRef<any>(null);

  const handleDiffEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure diff editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
      lineNumbers: 'on',
      minimap: { enabled: false },
      folding: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly: true,
      renderSideBySide: mode === 'side-by-side',
      ignoreTrimWhitespace: false,
      renderWhitespace: 'selection',
      diffWordWrap: 'on',
    });

    // Set up custom theme
    monaco.editor.defineTheme('arachne-diff-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'diffEditor.insertedTextBackground': '#144212',
        'diffEditor.removedTextBackground': '#441212',
        'diffEditor.insertedLineBackground': '#0E2F1C22',
        'diffEditor.removedLineBackground': '#2F0E1C22',
        'diffEditor.border': '#444444',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
      }
    });

    monaco.editor.setTheme('arachne-diff-dark');
  };

  // For unified diff mode, we'll create a custom unified diff view
  const renderUnifiedDiff = () => {
    const diffs = diffLines(originalCode, modifiedCode);
    let unifiedContent = '';
    let lineNumber = 0;

    diffs.forEach((part: CodeDiff) => {
      const lines = part.value.split('\n').filter(line => line.length > 0 || part.value.endsWith('\n'));
      
      lines.forEach(line => {
        lineNumber++;
        const prefix = part.added ? '+' : part.removed ? '-' : ' ';
        unifiedContent += `${prefix} ${line}\n`;
      });
    });

    return unifiedContent;
  };

  if (mode === 'unified') {
    const unifiedContent = renderUnifiedDiff();
    
    return (
      <div className="h-full w-full relative">
        <Editor
          height="100%"
          language="diff"
          value={unifiedContent}
          options={{
            fontSize: 14,
            fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
            lineNumbers: 'on',
            minimap: { enabled: false },
            folding: false,
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            readOnly: true,
            theme: 'arachne-diff-dark',
          }}
        />
      </div>
    );
  }

  // Side-by-side mode
  return (
    <div className="h-full w-full relative">
      <DiffEditor
        height="100%"
        language={language}
        original={originalCode}
        modified={modifiedCode}
        onMount={handleDiffEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
          lineNumbers: 'on',
          minimap: { enabled: false },
          folding: true,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly: true,
          renderSideBySide: true,
          ignoreTrimWhitespace: false,
          renderWhitespace: 'selection',
          diffWordWrap: 'on',
        }}
      />

      {/* Diff statistics overlay */}
      <DiffStats originalCode={originalCode} modifiedCode={modifiedCode} />
    </div>
  );
};

/**
 * Component to display diff statistics
 */
const DiffStats: React.FC<{ originalCode: string; modifiedCode: string }> = ({
  originalCode,
  modifiedCode
}) => {
  const stats = React.useMemo(() => {
    const diffs = diffLines(originalCode, modifiedCode);
    
    let added = 0;
    let removed = 0;
    let modified = 0;

    diffs.forEach((part: CodeDiff) => {
      const lineCount = part.value.split('\n').length - 1;
      
      if (part.added) {
        added += lineCount;
      } else if (part.removed) {
        removed += lineCount;
      } else {
        // Check if there are both additions and removals (modifications)
        const hasNext = diffs[diffs.indexOf(part) + 1];
        if (hasNext && ((part.added && hasNext.removed) || (part.removed && hasNext.added))) {
          modified += lineCount;
        }
      }
    });

    return { added, removed, modified };
  }, [originalCode, modifiedCode]);

  return (
    <div className="absolute top-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg px-3 py-2 text-sm shadow-lg text-white">
      <div className="space-y-1">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
          <span>+{stats.added} lines</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <span>-{stats.removed} lines</span>
        </div>
        {stats.modified > 0 && (
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
            <span>~{stats.modified} modified</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DiffViewer;