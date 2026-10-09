import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { pagesToBlocks, type PdfPage } from "../lib/structure";

const require = createRequire(import.meta.url);
const worker = require.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function spokenOf(book: { chapters: { title: string; sentences: { text: string }[] }[] }): string {
  return book.chapters
    .flatMap((chapter) => [chapter.title, ...chapter.sentences.map((sentence) => sentence.text)])
    .join(" ");
}

async function main() {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(worker).href;
  const { ImportError, importFile, loadPdfPages } = await import("../lib/import");

  const synthetic: PdfPage[] = [
    {
      number: 1,
      height: 800,
      lines: [
        { text: "Unchain deneme", size: 11, y: 780 },
        { text: "İlk sayfa", size: 22, y: 700 },
        { text: "Gün doğmadan kuşlar öttü. Çay soğumadan sayfa bitti.", size: 12, y: 640 },
        { text: "1", size: 10, y: 20 }
      ]
    },
    {
      number: 2,
      height: 800,
      lines: [
        { text: "Unchain deneme", size: 11, y: 780 },
        { text: "2", size: 10, y: 20 }
      ]
    },
    {
      number: 3,
      height: 800,
      lines: [
        { text: "Unchain deneme", size: 11, y: 780 },
        { text: "İkinci bölüm", size: 22, y: 700 },
        { text: "İkinci sayfa da Türkçe: ğüşıöç.", size: 12, y: 640 },
        { text: "3", size: 10, y: 20 }
      ]
    }
  ];
  const structured = pagesToBlocks(synthetic);
  const structuredText = structured.blocks.map((block) => block.text).join(" ");
  assert(structured.emptyPages === 1, `emptyPages ${structured.emptyPages} | ${structuredText}`);
  assert(structuredText.includes("İlk sayfa") && structuredText.includes("İkinci bölüm"), structuredText);
  assert(!structuredText.includes("Unchain deneme"), structuredText);
  assert(!structured.blocks.some((block) => block.text === "1" || block.text === "2" || block.text === "3"), structuredText);

  const root = path.resolve("fixtures");
  const cases: { file: string; title: string; author: string; must: string[]; mustNot: string[]; warning: boolean }[] = [
    {
      file: "gece-baslik.pdf",
      title: "Gece pdf",
      author: "Deneme",
      must: ["İlk sayfa", "ğüşıöç"],
      mustNot: ["Unchain deneme"],
      warning: true
    },
    {
      file: "gece-sayfa.pdf",
      title: "Sayfa grup",
      author: "Deneme",
      must: ["Sayfa 1", "Sayfa 2", "düz punto"],
      mustNot: ["Unchain deneme"],
      warning: false
    },
    {
      file: "gece.epub",
      title: "Gece epub",
      author: "Deneme",
      must: ["Birinci gece", "İkinci gece", "çay"],
      mustNot: ["ÜSTBİLGİ GİTMESİN"],
      warning: false
    },
    {
      file: "gece.docx",
      title: "Gece docx",
      author: "Deneme",
      must: ["İlk bölüm", "ğüşıöç"],
      mustNot: ["ÜSTBİLGİ GİTMESİN"],
      warning: false
    },
    {
      file: "gece.txt",
      title: "gece",
      author: "Profil",
      must: ["düz yazı"],
      mustNot: [],
      warning: false
    }
  ];

  for (const item of cases) {
    const bytes = readFileSync(path.join(root, item.file));
    const file = new File([bytes], item.file);
    try {
      const result = await importFile(file, "Profil");
      const text = spokenOf(result.book);
      assert(result.book.title === item.title, `${item.file} title «${result.book.title}» | ${text}`);
      assert(result.book.author === item.author, `${item.file} author «${result.book.author}»`);
      for (const needle of item.must) assert(text.includes(needle), `${item.file} missing ${needle} | ${text}`);
      for (const needle of item.mustNot) assert(!text.includes(needle), `${item.file} leaked ${needle} | ${text}`);
      assert(Boolean(result.warning) === item.warning, `${item.file} warning «${result.warning ?? ""}»`);
      if (item.file.endsWith(".epub")) assert(result.book.cover.startsWith("linear-gradient"), result.book.cover);
      if (item.file.endsWith(".docx")) assert(!result.book.chapters.some((chapter) => chapter.sentences.some((sentence) => sentence.text === "1")), text);
    } catch (err) {
      if (item.file.endsWith(".pdf")) {
        const loaded = await loadPdfPages(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
        const dump = loaded.pages
          .map((page) => page.lines.map((line) => `${line.y.toFixed(1)}/${line.size.toFixed(1)}:${line.text}`).join(" | "))
          .join("\n");
        console.error(dump);
      }
      throw err;
    }
  }

  const scanned = readFileSync(path.join(root, "gece-taranmis.pdf"));
  let threw = false;
  try {
    await importFile(new File([scanned], "gece-taranmis.pdf"), "Profil");
  } catch (err) {
    threw = true;
    assert(err instanceof ImportError, String(err));
    assert(err instanceof ImportError && err.message.includes("seçilebilir metin"), err instanceof ImportError ? err.message : "");
  }
  assert(threw, "taranmış PDF kitap üretti");
  console.log("check:import ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
