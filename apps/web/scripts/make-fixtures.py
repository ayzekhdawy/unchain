"""Küçük, özgün içe aktarma örnekleri. fpdf2 yalnız bu betik içindir."""

import struct
import zlib
import zipfile
from pathlib import Path

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "fixtures"
FONT = Path(r"C:\Windows\Fonts\arial.ttf")


def png(width: int, height: int, rgb: tuple[int, int, int]) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(rgb) * width for _ in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def pdf() -> FPDF:
    doc = FPDF(format="A4")
    doc.set_auto_page_break(auto=False)
    doc.add_font("Arial", "", str(FONT))
    return doc


def headed() -> None:
    doc = pdf()
    doc.set_title("Gece pdf")
    doc.set_author("Deneme")
    for index, heading in ((1, "İlk sayfa"), (3, "İkinci bölüm")):
        doc.add_page()
        doc.set_font("Arial", size=11)
        doc.set_xy(15, 6)
        doc.cell(0, 5, "Unchain deneme")
        doc.set_font("Arial", size=22)
        doc.set_xy(15, 28)
        doc.cell(0, 10, heading)
        doc.set_font("Arial", size=12)
        doc.set_xy(15, 48)
        body = "Gün doğmadan kuşlar öttü. Çay soğumadan ğüşıöç sayfası bitti." if index == 1 else "İkinci sayfa da Türkçe: ğüşıöç."
        doc.multi_cell(180, 7, body)
        doc.set_font("Arial", size=10)
        doc.set_xy(100, 285)
        doc.cell(10, 5, str(index), align="C")
        if index == 1:
            doc.add_page()
    doc.output(OUT / "gece-baslik.pdf")


def grouped() -> None:
    doc = pdf()
    doc.set_title("Sayfa grup")
    doc.set_author("Deneme")
    for index, sentence in ((1, "Birinci sayfa düz punto ile akar."), (2, "İkinci sayfa da düz punto ile akar.")):
        doc.add_page()
        doc.set_font("Arial", size=12)
        doc.set_xy(15, 40)
        doc.multi_cell(180, 7, sentence)
        doc.set_xy(100, 285)
        doc.cell(10, 5, str(index), align="C")
    doc.output(OUT / "gece-sayfa.pdf")


def scanned() -> None:
    doc = pdf()
    doc.set_title("Taranmış")
    doc.set_author("Deneme")
    doc.add_page()
    doc.rect(20, 20, 80, 40)
    doc.output(OUT / "gece-taranmis.pdf")


def docx() -> None:
    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>"""
    rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>"""
    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
</Relationships>"""
    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>İlk bölüm</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>Gövde metni Türkçe: ğüşıöç. Cümle bitti.</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>1</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId2"/>
    </w:sectPr>
  </w:body>
</w:document>"""
    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
  </w:style>
</w:styles>"""
    header = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:p><w:r><w:t>ÜSTBİLGİ GİTMESİN</w:t></w:r></w:p>
</w:hdr>"""
    core = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Gece docx</dc:title>
  <dc:creator>Deneme</dc:creator>
</cp:coreProperties>"""
    parts = {
        "[Content_Types].xml": content_types,
        "_rels/.rels": rels,
        "word/_rels/document.xml.rels": doc_rels,
        "word/document.xml": document,
        "word/styles.xml": styles,
        "word/header1.xml": header,
        "docProps/core.xml": core,
    }
    with zipfile.ZipFile(OUT / "gece.docx", "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, text in parts.items():
            archive.writestr(name, text.encode("utf-8"))


def epub() -> None:
    container = """<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>"""
    opf = """<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">urn:unchain:gece-epub</dc:identifier>
    <dc:title>Gece epub</dc:title>
    <dc:creator>Deneme</dc:creator>
    <dc:language>tr</dc:language>
    <meta name="cover" content="cover-img"/>
  </metadata>
  <manifest>
    <item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>
    <item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>
  </manifest>
  <spine>
    <itemref idref="nav"/>
    <itemref idref="c1"/>
    <itemref idref="c2"/>
  </spine>
</package>"""
    nav = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <body>
    <nav epub:type="toc">
      <ol>
        <li><a href="text/c1.xhtml">Birinci gece</a></li>
        <li><a href="text/c2.xhtml">İkinci gece</a></li>
      </ol>
    </nav>
  </body>
</html>"""
    first = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <header><p>ÜSTBİLGİ GİTMESİN</p></header>
    <h1>Birinci gece</h1>
    <p>Gün doğmadan kuşlar öttü. &#231;ay soğumadan sayfa bitti.</p>
    <p class="pagenum">4</p>
  </body>
</html>"""
    second = """<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
  <body>
    <h1>İkinci gece</h1>
    <p>İkinci bölüm de burada durur.</p>
  </body>
</html>"""
    parts = {
        "META-INF/container.xml": container,
        "OEBPS/content.opf": opf,
        "OEBPS/nav.xhtml": nav,
        "OEBPS/text/c1.xhtml": first,
        "OEBPS/text/c2.xhtml": second,
    }
    with zipfile.ZipFile(OUT / "gece.epub", "w") as archive:
        info = zipfile.ZipInfo("mimetype")
        info.compress_type = zipfile.ZIP_STORED
        archive.writestr(info, "application/epub+zip")
        for name, text in parts.items():
            archive.writestr(name, text.encode("utf-8"))
        archive.writestr("OEBPS/cover.png", png(16, 24, (232, 160, 90)))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    headed()
    grouped()
    scanned()
    docx()
    epub()
    (OUT / "gece.txt").write_text("Gece notu\n\nBu düz yazı tarayıcıda kalır.\n", encoding="utf-8")


if __name__ == "__main__":
    main()
