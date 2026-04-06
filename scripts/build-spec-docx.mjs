import fs from 'node:fs'
import path from 'node:path'
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Numbering,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TableOfContents,
  TextRun,
  WidthType,
} from 'docx'

const rootDir = process.cwd()
const specPath = path.join(rootDir, 'docs', 'SPEC-v11.md')

function readSpec() {
  return fs.readFileSync(specPath, 'utf8').replace(/\r\n/g, '\n')
}

function extractMetadata(markdown) {
  const titleMatch = markdown.match(/^#\s+(.+)$/m)
  const snapshotMatch = markdown.match(/^Snapshot date:\s*(\d{4}-\d{2}-\d{2})$/m)
  const versionMatch = markdown.match(/\bv(\d+)\b/i)
  if (!titleMatch) throw new Error('Could not find spec title')
  if (!snapshotMatch) throw new Error('Could not find snapshot date')
  if (!versionMatch) throw new Error('Could not infer spec version')

  return {
    title: titleMatch[1].trim(),
    snapshotDate: snapshotMatch[1],
    version: versionMatch[1],
  }
}

function toHeadingLevel(level) {
  if (level === 1) return HeadingLevel.HEADING_1
  if (level === 2) return HeadingLevel.HEADING_2
  return HeadingLevel.HEADING_3
}

function createCodeParagraph(line) {
  return new Paragraph({
    spacing: { after: 80 },
    shading: { fill: 'F4F6F8', type: 'clear' },
    border: {
      left: { color: 'D9DEE3', size: 8, space: 1 },
      right: { color: 'D9DEE3', size: 8, space: 1 },
      top: { color: 'D9DEE3', size: 8, space: 1 },
      bottom: { color: 'D9DEE3', size: 8, space: 1 },
    },
    children: [
      new TextRun({
        text: line.length > 0 ? line : ' ',
        font: 'Consolas',
        size: 20,
      }),
    ],
  })
}

function createBodyParagraph(text) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({
        text,
        font: 'Arial',
        size: 22,
      }),
    ],
  })
}

function parseMarkdown(markdown) {
  const lines = markdown.split('\n')
  const bodyLines = lines.filter((line, index) => !(index === 0 && line.startsWith('# ')))
  const paragraphs = []
  let inCodeBlock = false

  for (const rawLine of bodyLines) {
    const line = rawLine.replace(/\t/g, '    ')

    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock
      continue
    }

    if (inCodeBlock) {
      paragraphs.push(createCodeParagraph(line))
      continue
    }

    if (!line.trim()) continue

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      const depth = headingMatch[1].length
      paragraphs.push(
        new Paragraph({
          heading: toHeadingLevel(depth),
          spacing: { before: depth === 1 ? 320 : 240, after: 120 },
          children: [
            new TextRun({
              text: headingMatch[2].trim(),
              font: 'Arial',
            }),
          ],
        }),
      )
      continue
    }

    const bulletMatch = line.match(/^\-\s+(.+)$/)
    if (bulletMatch) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 80 },
          numbering: { reference: 'parkly-bullets', level: 0 },
          children: [
            new TextRun({
              text: bulletMatch[1].trim(),
              font: 'Arial',
              size: 22,
            }),
          ],
        }),
      )
      continue
    }

    const numberMatch = line.match(/^\d+\.\s+(.+)$/)
    if (numberMatch) {
      paragraphs.push(
        new Paragraph({
          spacing: { after: 80 },
          numbering: { reference: 'parkly-numbers', level: 0 },
          children: [
            new TextRun({
              text: numberMatch[1].trim(),
              font: 'Arial',
              size: 22,
            }),
          ],
        }),
      )
      continue
    }

    paragraphs.push(createBodyParagraph(line.trim()))
  }

  return paragraphs
}

async function main() {
  const markdown = readSpec()
  const metadata = extractMetadata(markdown)
  const snapshotStamp = metadata.snapshotDate.replaceAll('-', '')
  const outputDir = path.join(rootDir, 'docs', 'spec')
  const outputPath = path.join(outputDir, `Parkly_Project_Snapshot_v${metadata.version}_${snapshotStamp}.docx`)

  fs.mkdirSync(outputDir, { recursive: true })

  const doc = new Document({
    creator: 'Codex',
    title: metadata.title,
    description: `Parkly enterprise project snapshot v${metadata.version}`,
    styles: {
      default: {
        document: {
          run: {
            font: 'Arial',
            size: 22,
          },
          paragraph: {
            spacing: { after: 120 },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 34, bold: true },
          paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 28, bold: true },
          paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Arial', size: 24, bold: true },
          paragraph: { spacing: { before: 220, after: 100 }, outlineLevel: 2 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'parkly-bullets',
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: '-',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
        {
          reference: 'parkly-numbers',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
            },
            margin: { top: 1440, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: 'Parkly Enterprise Snapshot',
                    font: 'Arial',
                    size: 18,
                    color: '5B6670',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Parkly v11 snapshot | ',
                    font: 'Arial',
                    size: 18,
                    color: '5B6670',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: 'Arial',
                    size: 18,
                    color: '5B6670',
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 2800, after: 200 },
            children: [
              new TextRun({
                text: metadata.title,
                font: 'Arial',
                size: 40,
                bold: true,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: `Snapshot date: ${metadata.snapshotDate}`,
                font: 'Arial',
                size: 24,
                color: '4D5B68',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
              new TextRun({
                text: 'Generated from docs/SPEC-v11.md',
                font: 'Arial',
                size: 22,
                color: '4D5B68',
              }),
            ],
          }),
          new Paragraph({ children: [new PageBreak()] }),
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Contents', font: 'Arial' })],
          }),
          new TableOfContents('Contents', {
            hyperlink: true,
            headingStyleRange: '1-3',
          }),
          new Paragraph({ children: [new PageBreak()] }),
          ...parseMarkdown(markdown),
        ],
      },
    ],
  })

  const buffer = await Packer.toBuffer(doc)
  fs.writeFileSync(outputPath, buffer)
  console.log(`[docs:spec:docx] Wrote ${path.relative(rootDir, outputPath)}`)
}

main().catch((error) => {
  console.error('[docs:spec:docx] FAIL', error)
  process.exitCode = 1
})
