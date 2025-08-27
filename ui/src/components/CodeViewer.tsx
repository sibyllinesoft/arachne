import React, { useEffect, useRef } from 'react';
import { Editor, type OnMount } from '@monaco-editor/react';
import type { CodeViewerProps } from '@/types/analysis';

const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  language = 'javascript',
  readOnly = true,
  highlightedLines = [],
  onLineClick
}) => {
  const editorRef = useRef<any>(null);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Configure editor options
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
      lineNumbers: 'on',
      minimap: { enabled: true },
      folding: true,
      wordWrap: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      readOnly,
      theme: 'vs-dark',
    });

    // Add click handler for lines
    if (onLineClick) {
      editor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
          const lineNumber = e.target.position?.lineNumber;
          if (lineNumber) {
            onLineClick(lineNumber);
          }
        }
      });
    }

    // Set up custom theme
    monaco.editor.defineTheme('arachne-dark', {
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
        'editor.lineHighlightBackground': '#2D2D30',
        'editorLineNumber.foreground': '#858585',
        'editorLineNumber.activeForeground': '#C6C6C6',
        'editorGutter.background': '#1E1E1E',
      }
    });

    monaco.editor.setTheme('arachne-dark');
  };

  // Update highlighted lines
  useEffect(() => {
    if (editorRef.current && highlightedLines.length > 0) {
      const decorations = highlightedLines.map(lineNumber => ({
        range: new (editorRef.current.getModel().constructor.Range)(
          lineNumber,
          1,
          lineNumber,
          1
        ),
        options: {
          isWholeLine: true,
          className: 'highlighted-line',
          glyphMarginClassName: 'highlighted-line-glyph',
        }
      }));

      editorRef.current.deltaDecorations([], decorations);
    }
  }, [highlightedLines]);

  return (
    <div className="h-full w-full relative">
      <Editor
        height="100%"
        language={language}
        value={code}
        onMount={handleEditorDidMount}
        options={{
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Consolas, Monaco, monospace',
          lineNumbers: 'on',
          minimap: { enabled: true },
          folding: true,
          wordWrap: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          readOnly,
        }}
      />

      {/* Custom styles for highlighted lines */}
      <style jsx>{`
        .highlighted-line {
          background: rgba(255, 255, 0, 0.1) !important;
        }
        .highlighted-line-glyph {
          background: #ffff00 !important;
          width: 3px !important;
        }
      `}</style>
    </div>
  );
};

export default CodeViewer;