"""Generate synthetic fixtures, containing no real user data."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
from xml.sax.saxutils import escape
r=Path(__file__).parent
text='Ana Demo - Frontend developer. React, TypeScript and Node.js. Built a task management application with automated tests. English A2.'
def pdf(path,pages=1,content=text):
 objects=['<< /Type /Catalog /Pages 2 0 R >>','']
 kids=[]
 for page in range(pages):
  page_id=len(objects)+1; stream_id=page_id+1
  kids.append(f'{page_id} 0 R')
  objects.append(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents {stream_id} 0 R >>')
  stream=f'BT /F1 10 Tf 30 700 Td ({content}) Tj ET' if content else ''
  objects.append(f'<< /Length {len(stream)} >>\nstream\n{stream}\nendstream')
 objects[1]=f'<< /Type /Pages /Kids [{" ".join(kids)}] /Count {pages} >>'
 output=b'%PDF-1.4\n';offsets=[0]
 for i,obj in enumerate(objects,1):
  offsets.append(len(output));output+=f'{i} 0 obj\n{obj}\nendobj\n'.encode('ascii')
 xref=len(output);output+=f'xref\n0 {len(objects)+1}\n0000000000 65535 f \n'.encode()
 for off in offsets[1:]:output+=f'{off:010d} 00000 n \n'.encode()
 output+=f'trailer\n<< /Size {len(objects)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
 (r/path).write_bytes(output)
def docx(path,content):
 with ZipFile(r/path,'w',ZIP_DEFLATED) as z:
  z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  z.writestr('_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  z.writestr('word/document.xml',f'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{escape(content)}</w:t></w:r></w:p></w:body></w:document>')
pdf('cv.pdf');pdf('blank.pdf',content='');pdf('many-pages.pdf',pages=31)
docx('cv.docx',text+' Español: información y formación. <script>alert(1)</script>')
docx('long.docx','Experiencia React. '*1100)
with ZipFile(r/'not-docx.docx','w',ZIP_DEFLATED) as z:z.writestr('other.txt','Not a Word file')
