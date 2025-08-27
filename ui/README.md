# ArachneJS Interactive Analysis UI

A modern React-based web application for visualizing JavaScript deobfuscation analysis results from ArachneJS.

## Features

- **Interactive CFG Visualization**: D3.js-powered control flow graphs with multiple layout options
- **Code Comparison**: Side-by-side and unified diff views with syntax highlighting
- **Pass Explorer**: Step-through interface for analyzing each deobfuscation pass
- **Real-time Metrics**: Performance metrics and impact visualization
- **Export Capabilities**: HTML and JSON export formats
- **Responsive Design**: Works on desktop and mobile devices
- **Accessibility**: WCAG 2.1 AA compliant interface

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Generate analysis data:**
   ```bash
   # From the main ArachneJS directory
   npm run dev analyze sample.js --json-out analysis.json
   ```

4. **Load the analysis.json file** in the web interface at http://localhost:3000

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run type-check` - TypeScript type checking
- `npm run lint` - ESLint code checking
- `npm run lint:fix` - Auto-fix ESLint issues

## Technology Stack

- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Code Editor**: Monaco Editor
- **Visualization**: D3.js
- **UI Components**: Radix UI primitives
- **Icons**: Lucide React

## Architecture

```
src/
├── components/          # React components
│   ├── CFGVisualization.tsx    # D3.js control flow graph
│   ├── CodeViewer.tsx          # Monaco editor wrapper
│   ├── DiffViewer.tsx          # Side-by-side diff view
│   └── PassExplorer.tsx        # Pass step-through UI
├── utils/               # Utility functions
│   ├── dataParser.ts           # JSON data validation
│   ├── graphUtils.ts           # D3.js graph algorithms
│   └── export.ts               # Export functionality
├── types/               # TypeScript definitions
│   └── analysis.ts             # Data structure interfaces
└── App.tsx              # Main application component
```

## Data Format

The UI expects analysis data in this format:

```typescript
interface AnalysisData {
  originalCode: string;
  finalCode: string;
  passes: PassResult[];
  cfg: SerializedCFG;
  metadata: AnalysisMetadata;
}
```

Generate this data using the ArachneJS CLI:

```bash
arachnejs analyze input.js --json-out analysis.json
```

## Development

### Adding New Visualizations

1. Create component in `src/components/`
2. Add data types to `src/types/analysis.ts`
3. Implement utility functions in `src/utils/`
4. Integrate with main App component

### Styling Guidelines

- Use Tailwind CSS utility classes
- Follow existing color scheme
- Ensure responsive design
- Test accessibility with screen readers

### Performance Considerations

- Large analysis files are handled with virtualization
- D3.js visualizations are optimized for 1000+ nodes
- Code editors use Monaco's built-in lazy loading
- Export functions process data in chunks

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT - see main project LICENSE file