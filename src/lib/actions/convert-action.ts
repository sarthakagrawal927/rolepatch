'use server';

export async function convertLatexToTypst(latexSource: string): Promise<string> {
  let s = latexSource;

  // Strip preamble: everything before \begin{document}
  s = s.replace(/[\s\S]*?\\begin\{document\}/, '');
  // Strip \end{document}
  s = s.replace(/\\end\{document\}/, '');

  // Remove LaTeX comments (lines starting with %)
  s = s.replace(/^%.*$/gm, '');

  // Strip remaining \usepackage, \input, \pagestyle, \fancyhf, \renewcommand, \addtolength,
  // \setlength, \urlstyle, \raggedbottom, \raggedright, \titleformat, \newcommand blocks
  // These are all preamble leftovers that have no Typst equivalent
  s = s.replace(/\\(?:usepackage|input|pagestyle|fancyhf|fancyfoot|renewcommand|addtolength|setlength|urlstyle|raggedbottom|raggedright|titleformat|newcommand|labelitemii)\b[^\n]*\n?/g, '');

  // Remove \begin{center} / \end{center}
  s = s.replace(/\\begin\{center\}/g, '#align(center)[');
  s = s.replace(/\\end\{center\}/g, ']');

  // \section{Title} → = Title
  s = s.replace(/\\section\{([^}]+)\}/g, '= $1');

  // Remove itemize/enumerate wrappers and custom list commands
  s = s.replace(/\\(?:resumeSubHeadingListStart|resumeSubHeadingListEnd|resumeItemListStart|resumeItemListEnd)/g, '');
  s = s.replace(/\\begin\{itemize\}(?:\[[^\]]*\])?/g, '');
  s = s.replace(/\\end\{itemize\}/g, '');
  s = s.replace(/\\begin\{enumerate\}(?:\[[^\]]*\])?/g, '');
  s = s.replace(/\\end\{enumerate\}/g, '');

  // \resumeSubheading{title}{date}{subtitle}{location}
  s = replaceMultiArgCommand(s, 'resumeSubheading', 4, (args) => {
    const [title, date, subtitle, location] = args;
    let out = `#grid(columns: (1fr, auto), text(weight: "bold")[${title}], [${date}])\n`;
    if (subtitle || location) {
      out += `#grid(columns: (1fr, auto), text(style: "italic", size: 9pt)[${subtitle}], text(style: "italic", size: 9pt)[${location}])\n`;
    }
    return out;
  });

  // \resumeProjectHeading{title}{date}
  s = replaceMultiArgCommand(s, 'resumeProjectHeading', 2, (args) => {
    const [title, date] = args;
    return `#grid(columns: (1fr, auto), [${title}], [${date}])\n`;
  });

  // \resumeItem{text} → - text
  s = replaceCommand(s, 'resumeItem', (content) => `- ${content}`);

  // \resumeSubItem{text} → - text
  s = replaceCommand(s, 'resumeSubItem', (content) => `- ${content}`);

  // \item text → - text
  s = s.replace(/\\item\s*/g, '- ');

  // \textbf{X} → *X*
  s = replaceCommand(s, 'textbf', (content) => `*${content}*`);

  // \textit{X} → _X_
  s = replaceCommand(s, 'textit', (content) => `_${content}_`);

  // \emph{X} → _X_
  s = replaceCommand(s, 'emph', (content) => `_${content}_`);

  // \small X — just remove \small
  s = s.replace(/\\small\b\s*/g, '');

  // \footnotesize — remove
  s = s.replace(/\\footnotesize\b\s*/g, '');

  // \scshape — remove (Typst doesn't have a direct equivalent inline)
  s = s.replace(/\\scshape\b\s*/g, '');

  // \Huge, \huge, \Large, \large — remove
  s = s.replace(/\\(?:Huge|huge|Large|large|LARGE|normalsize)\b\s*/g, '');

  // \href{url}{text} → #link("url")[text]
  s = s.replace(/\\href\{([^}]*)\}\{([^}]*)\}/g, '#link("$1")[$2]');

  // \icon{url}{iconname}{text} → #link("url")[text]
  s = s.replace(/\\icon\{([^}]*)\}\{[^}]*\}\{([^}]*)\}/g, '#link("$1")[$2]');

  // \faIcon{name} → remove (no icon support in basic Typst)
  s = s.replace(/\\faIcon\{[^}]*\}/g, '');

  // \vspace{X} → #v(X)
  s = s.replace(/\\vspace\{([^}]*)\}/g, '#v($1)');

  // \hspace{X} → #h(X)
  s = s.replace(/\\hspace\{([^}]*)\}/g, '#h($1)');

  // \quad → #h(1em)
  s = s.replace(/\\quad\b/g, '#h(1em)');

  // LaTeX line break \\ → Typst line break \
  s = s.replace(/\\\\\s*$/gm, ' \\');
  s = s.replace(/\\\\/g, ' \\');

  // \& → &
  s = s.replace(/\\&/g, '&');

  // \% → %
  s = s.replace(/\\%/g, '%');

  // \$ → $
  s = s.replace(/\\\$/g, '\\$');

  // $..$ inline math (simple) → $..$ (Typst uses same delimiters)
  // Already handled by leaving $ as-is

  // \begin{tabular*}...\end{tabular*} — strip these (content already extracted by subheading)
  s = s.replace(/\\begin\{tabular\*?\}[^\n]*\n?/g, '');
  s = s.replace(/\\end\{tabular\*?\}[^\n]*/g, '');

  // Remove @ in email by escaping
  s = s.replace(/mailto:([^\]"]*)/g, (m) => m.replace(/@/g, '\\@'));

  // Clean up stray LaTeX commands
  s = s.replace(/\\(?:centering|noindent|par)\b/g, '');

  // Remove empty braces {}
  s = s.replace(/\{\}/g, '');

  // Add page setup header
  const header = `#set page(paper: "us-letter", margin: (x: 0.5in, y: 0.5in))
#set text(size: 10pt)
#set par(leading: 0.5em)
#show heading.where(level: 1): it => {
  v(-4pt)
  text(size: 12pt, weight: "bold", smallcaps(it.body))
  v(-8pt)
  line(length: 100%, stroke: 0.5pt)
  v(-5pt)
}

`;

  // Collapse multiple blank lines
  s = s.replace(/\n{3,}/g, '\n\n');

  return header + s.trim() + '\n';
}

/** Replace \\cmd{content} handling nested braces */
function replaceCommand(s: string, cmd: string, fn: (content: string) => string): string {
  const pattern = new RegExp(`\\\\${cmd}\\{`, 'g');
  let match;
  while ((match = pattern.exec(s)) !== null) {
    const start = match.index;
    const braceStart = start + match[0].length;
    const end = findClosingBrace(s, braceStart);
    if (end === -1) break;
    const content = s.slice(braceStart, end);
    const replacement = fn(content);
    s = s.slice(0, start) + replacement + s.slice(end + 1);
    pattern.lastIndex = start + replacement.length;
  }
  return s;
}

/** Find matching closing brace, handling nesting */
function findClosingBrace(s: string, start: number): number {
  let depth = 1;
  for (let i = start; i < s.length; i++) {
    if (s[i] === '{' && s[i - 1] !== '\\') depth++;
    else if (s[i] === '}' && s[i - 1] !== '\\') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Replace \cmd{arg1}{arg2}...{argN} handling nested braces */
function replaceMultiArgCommand(s: string, cmd: string, argCount: number, fn: (args: string[]) => string): string {
  const pattern = new RegExp(`\\\\${cmd}\\s*\\{`, 'g');
  let match;
  while ((match = pattern.exec(s)) !== null) {
    const start = match.index;
    let pos = start + match[0].length;
    const args: string[] = [];
    let ok = true;
    // Parse first arg (we're already past the opening brace)
    const end0 = findClosingBrace(s, pos);
    if (end0 === -1) { ok = false; break; }
    args.push(s.slice(pos, end0));
    pos = end0 + 1;
    // Parse remaining args
    for (let i = 1; i < argCount; i++) {
      // Skip whitespace between args
      const nextBrace = s.indexOf('{', pos);
      if (nextBrace === -1 || s.slice(pos, nextBrace).trim() !== '') { ok = false; break; }
      pos = nextBrace + 1;
      const end = findClosingBrace(s, pos);
      if (end === -1) { ok = false; break; }
      args.push(s.slice(pos, end));
      pos = end + 1;
    }
    if (!ok) break;
    const replacement = fn(args);
    s = s.slice(0, start) + replacement + s.slice(pos);
    pattern.lastIndex = start + replacement.length;
  }
  return s;
}
