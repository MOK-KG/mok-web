import { docNumber } from './api';
import { letterhead, letterRef, letterSubject, localNumber } from './letter';
import { type LetterView, LOGO_SVG, signatureSvg, svgDataUri } from './letterHtml';

/** SVG → PNG через canvas: Word надёжно показывает встроенный PNG, а не SVG */
async function svgToPng(svg: string, width: number, height: number): Promise<ArrayBuffer> {
  const img = new Image();
  img.src = svgDataUri(svg);
  await img.decode();
  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('png'))), 'image/png'),
  );
  return blob.arrayBuffer();
}

/**
 * Письмо на бланке в .docx: логотип и подпись встроены в файл картинками (приёмка 11.14).
 * Библиотека docx грузится только при выгрузке.
 */
export async function letterDocx({ doc, letter, signer }: LetterView): Promise<Blob> {
  const {
    AlignmentType,
    BorderStyle,
    Document,
    ImageRun,
    Packer,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import('docx');
  const h = letterhead[letter.lang];
  const number = docNumber(doc);
  const draft = doc.status === 'draft';
  const font = 'Times New Roman';
  const run = (text: string, opts: { bold?: boolean; size?: number; color?: string } = {}) =>
    new TextRun({ text, font, size: opts.size ?? 24, bold: opts.bold, color: opts.color });
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const noBorders = {
    top: none,
    bottom: none,
    left: none,
    right: none,
    insideHorizontal: none,
    insideVertical: none,
  };

  const logo = await svgToPng(LOGO_SVG, 48, 48);
  const signature = draft ? null : await svgToPng(signatureSvg(signer), 120, 46);
  const subject = letterSubject(doc.title, letter.lang);

  const header = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            borders: noBorders,
            children: [
              new Paragraph({
                children: [
                  new ImageRun({
                    type: 'png',
                    data: logo,
                    transformation: { width: 48, height: 48 },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            borders: noBorders,
            children: [
              new Paragraph({ children: [run(h.org, { bold: true, size: 26 })] }),
              new Paragraph({ children: [run(h.contacts, { size: 19, color: '4A5568' })] }),
            ],
          }),
        ],
      }),
    ],
  });

  const body = letter.body.split(/\n{2,}/).map(
    (p) =>
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: { after: 160 },
        children: p
          .split('\n')
          .flatMap((line, i) => [...(i > 0 ? [new TextRun({ break: 1 })] : []), run(line)]),
      }),
  );

  const signRow = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: noBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: noBorders,
            children: [
              new Paragraph({ children: [run(h.signerPosition)] }),
              new Paragraph({ children: [run(h.orgShort)] }),
            ],
          }),
          new TableCell({
            borders: noBorders,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: signature
                  ? [
                      new ImageRun({
                        type: 'png',
                        data: signature,
                        transformation: { width: 120, height: 46 },
                      }),
                    ]
                  : [run('________________')],
              }),
              ...(signature
                ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [run(h.facsimile, { size: 16, color: '718096' })],
                    }),
                  ]
                : []),
            ],
          }),
          new TableCell({
            borders: noBorders,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [run(signer)] })],
          }),
        ],
      }),
    ],
  });

  const document = new Document({
    creator: h.orgShort,
    title: number ?? doc.title,
    sections: [
      {
        properties: {
          page: { margin: { top: 1020, right: 1130, bottom: 1130, left: 1420 } },
        },
        children: [
          header,
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: 'E8112D', space: 4 } },
            children: [],
          }),
          new Paragraph({
            spacing: { before: 200 },
            children: [
              run(letterRef(number, doc.date, letter.lang), { size: 21, color: '2D3748' }),
            ],
          }),
          ...letter.addressee.split('\n').map(
            (line, i) =>
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: i === 0 ? 360 : 0 },
                children: [run(line)],
              }),
          ),
          new Paragraph({
            spacing: { before: 360, after: 200 },
            children: [run(subject, { bold: true })],
          }),
          ...body,
          new Paragraph({ spacing: { before: 400 }, children: [] }),
          signRow,
          ...(doc.fingerprint
            ? [
                new Paragraph({
                  spacing: { before: 480 },
                  children: [
                    run(`${number ? localNumber(number, letter.lang) : ''} · ${doc.fingerprint}`, {
                      size: 16,
                      color: '718096',
                    }),
                  ],
                }),
              ]
            : []),
        ],
      },
    ],
  });
  return Packer.toBlob(document);
}
